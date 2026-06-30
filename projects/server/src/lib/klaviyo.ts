/**
 * Server-side Klaviyo integration — pushes lifecycle events + profiles into
 * Klaviyo so its Flows (welcome series, trial nudges, winback) can target
 * Trace users.
 *
 * Mirrors lib/ad-conversions.ts: fire-and-forget, never throws, so a Klaviyo
 * outage can't break signup or webhook processing. Two safety gates:
 *   1. Skips entirely unless getEnv() === "prod" — staging/test signups must
 *      never reach the real Klaviyo account.
 *   2. No-ops (with a structured WARNING) when KLAVIYO_PRIVATE_API_KEY is unset.
 *
 * The Events API upserts the profile from the inline `profile` block, so
 * trackKlaviyoEvent() both records the event AND creates/updates the customer.
 * subscribeKlaviyoProfile() additionally opts the profile into email marketing
 * (single opt-in) so Flows can actually send — it requires KLAVIYO_LIST_ID and
 * no-ops without it.
 *
 * Secrets (set via `firebase functions:secrets:set`):
 *   - KLAVIYO_PRIVATE_API_KEY   (pk_...)   — required for any call
 *   - KLAVIYO_LIST_ID                       — required only for subscribe()
 */
import { getEnv } from "../env";
import { colRef } from "../firebase";

const KLAVIYO_BASE = "https://a.klaviyo.com/api";
// Pinned API revision — bump deliberately when adopting newer Klaviyo features.
const KLAVIYO_REVISION = "2026-04-15";

export interface KlaviyoProfile {
  /** Firebase userId — Klaviyo profile external_id. */
  externalId: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  /**
   * Custom profile properties (e.g. { home_airport: "SLC" }) — set on the
   * Klaviyo profile so templates can reference `{{ person.<key> }}`. Distinct
   * from the per-event `properties` arg, which lives on the event, not the
   * profile.
   */
  properties?: Record<string, unknown>;
}

function klaviyoHeaders(key: string): Record<string, string> {
  return {
    Authorization: `Klaviyo-API-Key ${key}`,
    revision: KLAVIYO_REVISION,
    "Content-Type": "application/json",
    accept: "application/json",
  };
}

function profileBlock(p: KlaviyoProfile): Record<string, unknown> {
  const block: Record<string, unknown> = { external_id: p.externalId };
  if (p.email) block.email = p.email;
  if (p.firstName) block.first_name = p.firstName;
  if (p.lastName) block.last_name = p.lastName;
  if (p.properties && Object.keys(p.properties).length > 0) {
    block.properties = p.properties;
  }
  return block;
}

/**
 * Returns the API key if Klaviyo should fire for this call, else null (and
 * logs why). Gates:
 *   - KLAVIYO_PRIVATE_API_KEY must be set.
 *   - prod    → send to anyone.
 *   - staging → send ONLY to addresses on the sandbox email whitelist
 *               (`sandboxEmailWhitelist`, managed in the admin portal), so
 *               test sends can never reach real users. No email → can't be
 *               whitelisted → skip.
 */
async function gate(
  op: string,
  email: string | null | undefined
): Promise<string | null> {
  const key = process.env.KLAVIYO_PRIVATE_API_KEY;
  if (!key) {
    console.warn(
      JSON.stringify({
        severity: "WARNING",
        message: `[Klaviyo] ${op} skipped — KLAVIYO_PRIVATE_API_KEY not set`,
      })
    );
    return null;
  }

  if (getEnv() === "prod") return key;

  // staging — only whitelisted test addresses may receive email.
  const normalized = email?.trim().toLowerCase();
  if (!normalized) {
    console.log(
      JSON.stringify({
        severity: "INFO",
        message: `[Klaviyo] staging: ${op} skipped — no email to match against sandbox whitelist`,
      })
    );
    return null;
  }
  try {
    const snap = await colRef("sandboxEmailWhitelist")
      .where("email", "==", normalized)
      .limit(1)
      .get();
    if (snap.empty) {
      console.log(
        JSON.stringify({
          severity: "INFO",
          message: `[Klaviyo] staging: ${op} skipped — ${normalized} not on sandbox whitelist`,
        })
      );
      return null;
    }
    return key;
  } catch (err) {
    console.error(
      JSON.stringify({
        severity: "ERROR",
        message: "[Klaviyo] staging whitelist check failed",
        error: String((err as { message?: string })?.message ?? err),
      })
    );
    return null;
  }
}

/**
 * Record a metric event for a user. Upserts the profile from `profile`.
 * `metric` is the human-readable event name shown in Klaviyo (e.g. "Started
 * Trial") and is what Flows trigger on.
 */
export async function trackKlaviyoEvent(
  metric: string,
  profile: KlaviyoProfile,
  properties: Record<string, unknown> = {},
  value?: number
): Promise<void> {
  if (!profile.email && !profile.externalId) return; // need an identifier
  const key = await gate(`event "${metric}"`, profile.email);
  if (!key) return;

  // metric + profile are JSON:API relationships — each must be wrapped as
  // { data: { type, attributes } }. (Flat objects 400 with "'data' key
  // missing in relationship".)
  const body = {
    data: {
      type: "event",
      attributes: {
        properties,
        ...(value != null ? { value } : {}),
        time: new Date().toISOString(),
        metric: { data: { type: "metric", attributes: { name: metric } } },
        profile: { data: { type: "profile", attributes: profileBlock(profile) } },
      },
    },
  };

  try {
    const res = await fetch(`${KLAVIYO_BASE}/events`, {
      method: "POST",
      headers: klaviyoHeaders(key),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(
        JSON.stringify({
          severity: "ERROR",
          message: "[Klaviyo] event rejected",
          metric,
          http_status: res.status,
          response: text.slice(0, 600),
        })
      );
    } else {
      console.log(
        JSON.stringify({
          severity: "INFO",
          message: "[Klaviyo] event accepted",
          metric,
          external_id: profile.externalId,
        })
      );
    }
  } catch (err) {
    console.error(
      JSON.stringify({
        severity: "ERROR",
        message: "[Klaviyo] event fetch threw",
        metric,
        error: String((err as { message?: string })?.message ?? err),
      })
    );
  }
}

/**
 * Opt a profile into email marketing (single opt-in) on the configured list.
 * No-ops without an email or KLAVIYO_LIST_ID. Required for Flows to actually
 * send mail — tracking an event alone leaves the profile unsubscribed.
 */
export async function subscribeKlaviyoProfile(
  email: string | null | undefined,
  externalId: string
): Promise<void> {
  if (!email) return;
  const key = await gate("subscribe", email);
  if (!key) return;
  const listId = process.env.KLAVIYO_LIST_ID;
  if (!listId) {
    console.warn(
      JSON.stringify({
        severity: "WARNING",
        message: "[Klaviyo] subscribe skipped — KLAVIYO_LIST_ID not set",
      })
    );
    return;
  }

  const body = {
    data: {
      type: "profile-subscription-bulk-create-job",
      attributes: {
        profiles: {
          data: [
            {
              type: "profile",
              // The bulk-subscribe profile only accepts email / phone_number /
              // subscriptions / age_gated_date_of_birth — NOT external_id (it
              // 400s). The profile is matched by email here; the "Signed Up"
              // event sets external_id on the same profile separately. The
              // `externalId` param is kept for call-site stability / future use.
              attributes: {
                email,
                subscriptions: { email: { marketing: { consent: "SUBSCRIBED" } } },
              },
            },
          ],
        },
      },
      relationships: { list: { data: { type: "list", id: listId } } },
    },
  };

  try {
    const res = await fetch(`${KLAVIYO_BASE}/profile-subscription-bulk-create-jobs`, {
      method: "POST",
      headers: klaviyoHeaders(key),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(
        JSON.stringify({
          severity: "ERROR",
          message: "[Klaviyo] subscribe rejected",
          http_status: res.status,
          response: text.slice(0, 600),
        })
      );
    } else {
      console.log(
        JSON.stringify({
          severity: "INFO",
          message: "[Klaviyo] subscribed to list",
          external_id: externalId,
        })
      );
    }
  } catch (err) {
    console.error(
      JSON.stringify({
        severity: "ERROR",
        message: "[Klaviyo] subscribe fetch threw",
        error: String((err as { message?: string })?.message ?? err),
      })
    );
  }
}
