/**
 * Server-side conversion fan-out to Meta Conversions API, TikTok Events API,
 * and GA4 Measurement Protocol. Fires from the RC webhook when purchases /
 * trials / renewals happen so ad platforms can attribute server-side.
 *
 * All calls are fire-and-forget — we never let an ad platform API failure
 * break webhook processing. We log failures for later debugging.
 *
 * Required env (each platform is optional — if the env is missing, its
 * fan-out is skipped):
 *   - META_CAPI_ACCESS_TOKEN  (Firebase secret)
 *     Dataset ID is hardcoded below — it's not sensitive.
 *   - TIKTOK_APP_ID, TIKTOK_EVENTS_TOKEN
 *   - GA4_MEASUREMENT_ID, GA4_API_SECRET
 */

import crypto from "crypto";

// Meta Dataset ID — not a secret, safe to hardcode.
const META_DATASET_ID = "1001080219009504";

type ConversionKind = "sign_up" | "start_trial" | "purchase" | "subscribe";

export interface ConversionEvent {
  kind: ConversionKind;
  userId: string;
  email?: string | null;
  amountUsd?: number;
  currency?: string;
  productId?: string;
  /** Optional external ad click id we stored on the user doc */
  fbp?: string | null;
  fbc?: string | null;
  ttclid?: string | null;
  gclid?: string | null;
}

function hashEmail(email: string): string {
  return crypto
    .createHash("sha256")
    .update(email.trim().toLowerCase())
    .digest("hex");
}

async function sendMeta(event: ConversionEvent): Promise<void> {
  const token = process.env.META_CAPI_ACCESS_TOKEN;
  if (!token) {
    // Structured WARNING — the silent early-return here was a debugging
    // black hole. Now it's a visible, filterable log line.
    console.warn(
      JSON.stringify({
        severity: "WARNING",
        message: "[AdConversions] Meta skipped — META_CAPI_ACCESS_TOKEN not set",
        event_kind: event.kind,
      })
    );
    return;
  }

  // Meta event name map
  const eventName =
    event.kind === "sign_up"
      ? "CompleteRegistration"
      : event.kind === "start_trial"
      ? "StartTrial"
      : event.kind === "purchase" || event.kind === "subscribe"
      ? "Purchase"
      : "CustomEvent";

  const userData: Record<string, unknown> = {
    external_id: [hashEmail(event.userId)],
  };
  if (event.email) userData.em = [hashEmail(event.email)];
  if (event.fbp) userData.fbp = event.fbp;
  if (event.fbc) userData.fbc = event.fbc;

  const customData: Record<string, unknown> = {};
  if (event.amountUsd != null) customData.value = event.amountUsd;
  if (event.currency) customData.currency = event.currency;
  if (event.productId) customData.content_ids = [event.productId];

  // action_source: "website" — NOT "app". An "app" event requires an
  // `app_data.extinfo` block (16-field device-info array: extinfo
  // version, OS version, device model, screen size...). Meta hard-
  // rejects "app" events without it — subcode 2804043, "Invalid
  // extended device info parameter". These events fire server-side
  // (Firestore trigger, RC webhook) where we don't have the device in
  // hand, so we can't build a real extinfo. "website" drops that
  // requirement; matching is unaffected because Meta matches on the
  // hashed user_data (email + external_id), not on action_source.
  // event_source_url is recommended for website events.
  const body = {
    data: [
      {
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        action_source: "website",
        event_source_url: "https://tracetravel.co",
        user_data: userData,
        custom_data: customData,
      },
    ],
  };

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${META_DATASET_ID}/events?access_token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    const text = await res.text();
    if (!res.ok) {
      console.error(
        JSON.stringify({
          severity: "ERROR",
          message: "[AdConversions] Meta rejected event",
          event_kind: event.kind,
          event_name: eventName,
          http_status: res.status,
          response: text.slice(0, 800),
        })
      );
      return;
    }
    // Success path now logs explicitly. Meta's CAPI response includes
    // `events_received` (should be 1) and an `fbtrace_id` — logging
    // them gives positive confirmation the event landed, instead of
    // the old silent success that left us unable to tell "worked" from
    // "never ran".
    let eventsReceived: unknown = null;
    let fbtraceId: unknown = null;
    try {
      const parsed = JSON.parse(text);
      eventsReceived = parsed.events_received;
      fbtraceId = parsed.fbtrace_id;
    } catch {
      /* non-JSON body — leave nulls, raw text logged below */
    }
    console.log(
      JSON.stringify({
        severity: "INFO",
        message: "[AdConversions] Meta accepted event",
        event_kind: event.kind,
        event_name: eventName,
        events_received: eventsReceived,
        fbtrace_id: fbtraceId,
        raw: eventsReceived == null ? text.slice(0, 300) : undefined,
      })
    );
  } catch (err) {
    console.error(
      JSON.stringify({
        severity: "ERROR",
        message: "[AdConversions] Meta fetch threw",
        event_kind: event.kind,
        event_name: eventName,
        error: String((err as any)?.message ?? err),
      })
    );
  }
}

async function sendTikTok(event: ConversionEvent): Promise<void> {
  const eventsToken = process.env.TIKTOK_EVENTS_TOKEN;
  const appId = process.env.TIKTOK_APP_ID;
  if (!eventsToken || !appId) return;

  const eventName =
    event.kind === "sign_up"
      ? "REGISTER"
      : event.kind === "start_trial"
      ? "SUBSCRIBE" // TikTok doesn't have a separate StartTrial event — use SUBSCRIBE with value=0
      : event.kind === "purchase" || event.kind === "subscribe"
      ? "SUBSCRIBE"
      : "CUSTOM";

  const user: Record<string, unknown> = {
    external_id: hashEmail(event.userId),
  };
  if (event.email) user.email = hashEmail(event.email);
  if (event.ttclid) user.ttclid = event.ttclid;

  const properties: Record<string, unknown> = {};
  if (event.amountUsd != null) properties.value = event.amountUsd;
  if (event.currency) properties.currency = event.currency;
  if (event.productId) properties.content_id = event.productId;

  const body = {
    event_source: "app",
    event_source_id: appId,
    data: [
      {
        event: eventName,
        event_time: Math.floor(Date.now() / 1000),
        user,
        properties,
      },
    ],
  };

  try {
    const res = await fetch("https://business-api.tiktok.com/open_api/v1.3/event/track/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Access-Token": eventsToken,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      console.warn("[AdConversions] TikTok error:", res.status, text);
    }
  } catch (err) {
    console.warn("[AdConversions] TikTok fetch failed:", err);
  }
}

async function sendGA4(event: ConversionEvent): Promise<void> {
  const measurementId = process.env.GA4_MEASUREMENT_ID;
  const apiSecret = process.env.GA4_API_SECRET;
  if (!measurementId || !apiSecret) return;

  const eventName =
    event.kind === "sign_up"
      ? "sign_up"
      : event.kind === "start_trial"
      ? "start_trial"
      : event.kind === "purchase" || event.kind === "subscribe"
      ? "purchase"
      : "custom_event";

  const params: Record<string, unknown> = {};
  if (event.amountUsd != null) params.value = event.amountUsd;
  if (event.currency) params.currency = event.currency;
  if (event.productId) params.item_id = event.productId;

  const body = {
    client_id: event.userId, // Required — we use Firebase UID as client_id
    user_id: event.userId,
    events: [{ name: eventName, params }],
  };

  try {
    const res = await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    if (!res.ok) {
      const text = await res.text();
      console.warn("[AdConversions] GA4 error:", res.status, text);
    }
  } catch (err) {
    console.warn("[AdConversions] GA4 fetch failed:", err);
  }
}

/**
 * Fire a conversion event to all configured ad platforms.
 * Fire-and-forget — never throws.
 */
export async function fanOutConversion(event: ConversionEvent): Promise<void> {
  try {
    await Promise.all([sendMeta(event), sendTikTok(event), sendGA4(event)]);
  } catch (err) {
    // Inner functions already log their own errors and swallow
    console.warn("[AdConversions] fan-out failed:", err);
  }
}
