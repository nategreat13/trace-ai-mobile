import { getDb } from "./firebase-admin";

/**
 * Admin-side helpers for push notification management.
 *
 * Reads/writes:
 *   - notificationTemplates  (admin-editable copy per trigger)
 *   - notificationLog        (audit trail of every send)
 *
 * Sends are NOT done here — they go through the Cloud Function via
 * the admin-push routes, gated by ADMIN_API_TOKEN. This file is just
 * the read side + the admin's write side for templates.
 */

export interface NotificationTemplate {
  key: string;
  title: string;
  body: string;
  deepLink: string | null;
  enabled: boolean;
  description: string;
  variables: string[];
  updatedAt: Date | null;
}

/**
 * The full list of trigger keys the server knows how to fire. Kept in
 * sync manually with projects/server/src/lib/notification-templates.ts —
 * adding a new key requires both a server-side trigger and an entry
 * here. (TODO: dedupe via @trace/shared — this manual sync has already
 * caused one bug where new server templates were invisible in the admin.)
 *
 * Order roughly matches the user lifecycle:
 *   onboarding → trial → free upsells → premium → business → re-engagement
 */
export const KNOWN_TEMPLATE_KEYS = [
  // First open
  "welcome",
  // Trial lifecycle
  "trial_ending_3d",
  "trial_ending_24h",
  // Free → Premium upsell sequence
  "premium_nudge",
  "premium_nudge_10d",
  "premium_nudge_20d",
  "discount_on_premium",
  // Re-engagement (inactivity)
  "inactivity_3d",
  "inactivity_7d",
  "inactivity_14d",
  // Premium → Business upsell sequence
  "welcome_to_premium",
  "business_class_nudge_5d",
  "business_class_nudge",
  "discount_on_business",
  // Subscription lifecycle
  "subscription_renewal_24h",
  "billing_issue",
  // Deal-driven (run from cron / matching engine)
  "hot_deal_alert",
  "deal_alert_match",
] as const;

/**
 * Default metadata for every known template. **Manually synced** with
 * `projects/server/src/lib/notification-templates.ts` (`TEMPLATE_DEFAULTS`).
 *
 * Why duplicate: the source of truth lives server-side so the cron and
 * webhook code paths can read it without an HTTP call. But the admin
 * web needs the same metadata to render the templates list, populate
 * default copy in the edit form (so dynamic templates show their
 * locked copy even before the Firestore doc exists), and surface the
 * `variables` array for the static/dynamic badge.
 *
 * Both copies of the data are static, version-controlled, and small.
 * The drift risk is a TS engineering tax we pay rather than adding a
 * server round-trip on every admin page load. TODO: dedupe via
 * `@trace/shared` when we do a maintenance sweep.
 */
const TEMPLATE_DEFAULTS: Record<
  string,
  {
    title: string;
    body: string;
    deepLink: string | null;
    description: string;
    variables: string[];
  }
> = {
  welcome: {
    title: "Welcome to Trace 👋",
    body: "We've found {{dealCount}} deals from {{homeAirport}} since you joined.",
    deepLink: "/swipe",
    description:
      "Sent ~24 hours after signup. Reinforces the home airport feed and gives the user a reason to come back.",
    variables: ["dealCount", "homeAirport"],
  },
  trial_ending_3d: {
    title: "Your trial ends in 3 days",
    body: "Keep unlimited swipes and every deal from your home airport. Subscribe before it ends.",
    deepLink: "/paywall",
    description:
      "Sent when the user's trial expires in ~3 days. First warning — gives time to decide before the last-minute 24h push.",
    variables: [],
  },
  trial_ending_24h: {
    title: "Your trial ends tomorrow",
    body: "Subscribe to keep unlimited swipes, saves, and deal alerts.",
    deepLink: "/paywall",
    description:
      "Sent when the user's trial expires within the next 24 hours. Highest-leverage trial-to-paid moment.",
    variables: [],
  },
  billing_issue: {
    title: "There was a problem with your payment",
    body: "We had trouble charging your card. Tap to update your payment method.",
    deepLink: "/profile",
    description:
      "Fired when the RevenueCat webhook reports a BILLING_ISSUE event. Aimed at recovering failed renewals.",
    variables: [],
  },
  inactivity_3d: {
    title: "{{dealCount}} new deals waiting",
    body: "Haven't seen you in a few days. Come check what's new from {{homeAirport}}.",
    deepLink: "/swipe",
    description:
      "Sent to users who haven't opened the app in ~3 days. First-line re-engagement.",
    variables: ["dealCount", "homeAirport"],
  },
  inactivity_7d: {
    title: "We miss you ✈️",
    body: "Your home airport has {{dealCount}} new deals this week.",
    deepLink: "/swipe",
    description:
      "Sent to users who haven't opened the app in ~7 days. Last-ditch reactivation push.",
    variables: ["dealCount", "homeAirport"],
  },
  inactivity_14d: {
    title: "Still looking for a deal? ✈️",
    body: "It's been a while. {{dealCount}} deals are waiting from {{homeAirport}}.",
    deepLink: "/swipe",
    description:
      "Sent to users who haven't opened the app in ~14 days. Final re-engagement attempt.",
    variables: ["dealCount", "homeAirport"],
  },
  hot_deal_alert: {
    title: "🔥 {{discount}}% off to {{destination}}",
    body: "${{price}} from {{homeAirport}}. Limited time — tap to see it.",
    deepLink: "/swipe",
    description:
      "Sent daily to premium/business users when a deal ≥60% off exists at their home airport. Picks the best deal of the day.",
    variables: ["discount", "destination", "price", "homeAirport"],
  },
  subscription_renewal_24h: {
    title: "Your subscription renews tomorrow",
    body: "Your Trace subscription will automatically renew in about 24 hours.",
    deepLink: "/profile",
    description:
      "Sent ~24 hours before a paid premium or business subscription renews. Heads-up so users can update payment if needed.",
    variables: [],
  },
  business_class_nudge_5d: {
    title: "Did you know about business class deals?",
    body: "Trace has lie-flat seats from {{homeAirport}} at up to 70% off. Business tier unlocks them.",
    deepLink: "/paywall",
    description:
      "Sent to premium users ~5 days after their first purchase. Educational first nudge about the business tier.",
    variables: ["homeAirport"],
  },
  business_class_nudge: {
    title: "Business class deals are waiting ✈️",
    body: "Upgrade to Business to unlock lie-flat seat deals from {{homeAirport}}.",
    deepLink: "/paywall",
    description:
      "Sent to premium users ~7 days after their first purchase. Second upsell nudge to upgrade to the business tier.",
    variables: ["homeAirport"],
  },
  premium_nudge: {
    title: "You're missing out on deals",
    body: "Premium unlocks unlimited swipes and every deal from {{homeAirport}}. Upgrade now.",
    deepLink: "/paywall",
    description:
      "Sent to free users ~5 days after signup. First upsell push to convert to premium.",
    variables: ["homeAirport"],
  },
  premium_nudge_10d: {
    title: "Still exploring? Go Premium ✈️",
    body: "You've been with us 10 days. Unlock every deal from {{homeAirport}} — no swipe limits.",
    deepLink: "/paywall",
    description:
      "Sent to free users ~10 days after signup. Second upsell push to convert to premium.",
    variables: ["homeAirport"],
  },
  premium_nudge_20d: {
    title: "Your best deals are locked 🔒",
    body: "20 days in and still on free? Premium gets you everything from {{homeAirport}}.",
    deepLink: "/paywall",
    description:
      "Sent to free users ~20 days after signup. Third upsell push to convert to premium.",
    variables: ["homeAirport"],
  },
  discount_on_premium: {
    title: "Special offer just for you",
    body: "Upgrade to Premium and get your first month at a special rate.",
    deepLink: "/paywall",
    description:
      "Sent to free users ~25 days after signup. Last-resort discount push after the regular nudge sequence.",
    variables: [],
  },
  discount_on_business: {
    title: "Upgrade to Business for less",
    body: "You've been with us a month — here's a special rate to unlock business class deals.",
    deepLink: "/paywall",
    description:
      "Sent to premium users ~30 days after their first purchase. Discount-angle push to upgrade to business.",
    variables: [],
  },
  welcome_to_premium: {
    title: "Welcome to Premium ✈️",
    body: "Unlimited swipes, every deal, and priority alerts. You're all set.",
    deepLink: "/swipe",
    description:
      "Fired immediately when a user makes their first paid purchase (non-trial). Sent from the RevenueCat webhook, not the daily cron.",
    variables: [],
  },
  deal_alert_match: {
    title: "Your {{destination}} alert just matched",
    body: "${{price}} round-trip, {{discount}}% off. Tap to see it.",
    deepLink: "/dashboard",
    description:
      "Sent to premium/business users when a deal appears matching one of their saved alerts. Fires once per alert then marks it matched.",
    variables: ["destination", "price", "discount"],
  },
};

/**
 * Build a NotificationTemplate from the in-code default metadata.
 * Used when no Firestore doc exists for a key — gives the admin UI
 * real title/body/variables/description from the start instead of
 * blanks, and makes the static/dynamic badge accurate from page-load.
 *
 * `enabled` is always false in the default (the server enforces this
 * too — templates start disabled). `updatedAt` is null because the
 * Firestore doc, not the in-code default, owns mutation time.
 */
function defaultTemplate(key: string): NotificationTemplate {
  const meta = TEMPLATE_DEFAULTS[key];
  if (!meta) {
    return {
      key,
      title: "",
      body: "",
      deepLink: null,
      enabled: false,
      description: "(no metadata — check TEMPLATE_DEFAULTS)",
      variables: [],
      updatedAt: null,
    };
  }
  return {
    key,
    title: meta.title,
    body: meta.body,
    deepLink: meta.deepLink,
    enabled: false,
    description: meta.description,
    variables: meta.variables,
    updatedAt: null,
  };
}

export async function listTemplates(): Promise<NotificationTemplate[]> {
  const db = getDb();
  const snap = await db.collection("notificationTemplates").get();
  const byKey: Record<string, NotificationTemplate> = {};
  snap.forEach((doc) => {
    const d = doc.data();
    byKey[doc.id] = {
      key: doc.id,
      title: d.title ?? "",
      body: d.body ?? "",
      deepLink: d.deepLink ?? null,
      enabled: Boolean(d.enabled),
      description: d.description ?? "",
      variables: d.variables ?? [],
      updatedAt: d.updatedAt?.toDate?.() ?? null,
    };
  });
  // Fall back to in-code defaults when Firestore is empty for a key —
  // matches how the server's getTemplate behaves at send time.
  return KNOWN_TEMPLATE_KEYS.map((k) => byKey[k] ?? defaultTemplate(k));
}

export async function getTemplate(key: string): Promise<NotificationTemplate | null> {
  const db = getDb();
  const snap = await db.collection("notificationTemplates").doc(key).get();
  if (snap.exists) {
    const d = snap.data()!;
    // Merge Firestore values over the default. Firestore wins where it
    // has a value (e.g. an edited title); defaults fill in gaps the
    // admin hasn't touched yet (e.g. variables, description — those
    // aren't user-editable so the Firestore doc may not store them).
    const def = defaultTemplate(key);
    return {
      key,
      title: d.title ?? def.title,
      body: d.body ?? def.body,
      deepLink: d.deepLink ?? def.deepLink,
      enabled: Boolean(d.enabled),
      description: d.description ?? def.description,
      variables: d.variables ?? def.variables,
      updatedAt: d.updatedAt?.toDate?.() ?? null,
    };
  }
  // No Firestore doc — return the default if the key is known, else
  // null so callers can 404.
  if (!KNOWN_TEMPLATE_KEYS.includes(key as (typeof KNOWN_TEMPLATE_KEYS)[number])) {
    return null;
  }
  return defaultTemplate(key);
}

export async function upsertTemplate(
  key: string,
  fields: Partial<NotificationTemplate>
): Promise<void> {
  const db = getDb();
  const allowed: Record<string, unknown> = {
    updatedAt: new Date(),
  };
  if (fields.title !== undefined) allowed.title = fields.title;
  if (fields.body !== undefined) allowed.body = fields.body;
  if (fields.deepLink !== undefined) allowed.deepLink = fields.deepLink;
  if (fields.enabled !== undefined) allowed.enabled = fields.enabled;
  if (fields.description !== undefined) allowed.description = fields.description;
  if (fields.variables !== undefined) allowed.variables = fields.variables;
  await db.collection("notificationTemplates").doc(key).set(allowed, { merge: true });
}

export interface NotificationLogEntry {
  id: string;
  userId: string | null;
  templateKey: string | null;
  title: string;
  body: string;
  attempted: number;
  ok: number;
  errors: string[];
  audience: "user" | "broadcast";
  audienceFilter?: { tiers?: string[]; platform?: string };
  matchedUsers?: number;
  sentAt: Date | null;
}

export async function listRecentSends(limit = 100): Promise<NotificationLogEntry[]> {
  const db = getDb();
  const snap = await db
    .collection("notificationLog")
    .orderBy("sentAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      userId: d.userId ?? null,
      templateKey: d.templateKey ?? null,
      title: d.title ?? "",
      body: d.body ?? "",
      attempted: d.attempted ?? 0,
      ok: d.ok ?? 0,
      errors: d.errors ?? [],
      audience: d.audience ?? "user",
      audienceFilter: d.audienceFilter,
      matchedUsers: d.matchedUsers,
      sentAt: d.sentAt?.toDate?.() ?? null,
    };
  });
}

/**
 * Calls the Cloud Function admin-push endpoints with the shared
 * ADMIN_API_TOKEN. Used by server actions on the admin pages.
 *
 * Requires ADMIN_API_TOKEN and (optionally) NEXT_PUBLIC_API_BASE_URL
 * in the Vercel environment. NEXT_PUBLIC_API_BASE_URL defaults to the
 * production Cloud Run URL if unset.
 */
const DEFAULT_API_BASE = "https://api-7l7vojyykq-uc.a.run.app";

async function callAdminApi<T>(path: string, body: unknown): Promise<T> {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE;
  const token = process.env.ADMIN_API_TOKEN;
  if (!token) {
    throw new Error(
      "ADMIN_API_TOKEN is not set. Locally, add it to projects/web/.env.local " +
        "(fetch with `firebase functions:secrets:access ADMIN_API_TOKEN --project " +
        "trace-ai-b9cba`). On Vercel, set it in Project Settings → Environment Variables."
    );
  }
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Admin API ${path} returned ${res.status}: ${text}`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

export interface SendResult {
  attempted: number;
  ok: number;
  removedTokens?: string[];
  errors?: string[];
}

export interface BroadcastResult extends SendResult {
  matchedUsers: number;
}

export async function sendTestPush(opts: {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  force?: boolean;
}): Promise<SendResult> {
  return callAdminApi<SendResult>("/admin/send-test-push", opts);
}

export async function sendBroadcast(opts: {
  audience: { tiers?: string[]; platform?: "ios" | "android" };
  title: string;
  body: string;
  data?: Record<string, unknown>;
  templateKey?: string;
}): Promise<BroadcastResult> {
  return callAdminApi<BroadcastResult>("/admin/send-broadcast", opts);
}

/**
 * Fire a saved notification template at a specific user RIGHT NOW.
 * Uses the same code path as the daily cron triggers — same template
 * lookup, same variable substitution, same deepLink wiring — so what
 * the user sees on their device is exactly what they'd see in the
 * wild when the trigger fires for real.
 *
 * Lets you test all 18 templates by clicking a dropdown + send,
 * without having to manufacture the conditions that would normally
 * trigger them (e.g. "trial 3 days from ending", "inactive 14 days").
 *
 * If the template has {{vars}} placeholders that aren't supplied in
 * `vars`, they render as literal `{{name}}` — fine for testing copy
 * + deepLink. Supply specific vars when you need to test rendered
 * substitution.
 */
export async function sendTemplate(opts: {
  userId: string;
  templateKey: string;
  vars?: Record<string, string | number>;
}): Promise<SendResult> {
  return callAdminApi<SendResult>("/admin/send-template", opts);
}

export async function seedTemplates(): Promise<{ created: string[] }> {
  return callAdminApi<{ created: string[] }>("/admin/seed-templates", {});
}

/**
 * Remove a specific Expo push token from a user's pushTokens array.
 * Direct Firestore write via the Admin SDK — consistent with how
 * exclusions are managed (and unlike sendTestPush which goes through
 * the Cloud Function because it needs to actually deliver a push).
 *
 * Looks the user up by their Firebase Auth uid (the `userId` field
 * on userProfiles), reads the current array, filters out any record
 * whose token string matches, and writes back the filtered list.
 *
 * Idempotent: passing a token that's already gone is a no-op.
 *
 * Returns { found, remaining } so the caller can show useful
 * feedback ("removed; N tokens left").
 */
export async function removeUserPushToken(
  userId: string,
  token: string
): Promise<{ found: boolean; remaining: number }> {
  const db = getDb();
  const snap = await db
    .collection("userProfiles")
    .where("userId", "==", userId)
    .limit(1)
    .get();
  if (snap.empty) {
    throw new Error("User profile not found");
  }
  const docRef = snap.docs[0].ref;
  const data = snap.docs[0].data();
  const current: Array<{ token?: string }> = data.pushTokens ?? [];
  const next = current.filter((t) => t?.token !== token);
  if (next.length === current.length) {
    return { found: false, remaining: current.length };
  }
  await docRef.update({ pushTokens: next });
  return { found: true, remaining: next.length };
}
