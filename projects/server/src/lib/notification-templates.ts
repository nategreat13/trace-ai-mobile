import { colRef } from "../firebase";

/**
 * Notification templates — admin-editable copy keyed by trigger.
 *
 * The set of TRIGGERS is defined in code (a non-technical admin can't
 * add new triggers from the UI; that requires wiring server code).
 * But the COPY for each trigger lives in Firestore so the admin can
 * tweak title/body/deepLink/enabled without a deploy.
 *
 * Schema (collection: notificationTemplates):
 *   key: string               // doc id, e.g. "welcome", "trial_ending"
 *   title: string             // mustache-like {{vars}} interpolation
 *   body: string              // same
 *   deepLink: string | null   // routes via App.tsx handleNotificationDeepLink
 *   enabled: boolean
 *   description: string       // human label, e.g. "Sent T+1 day after signup"
 *   variables: string[]       // available vars (for the admin UI hint)
 *   updatedAt: Timestamp
 */

export interface NotificationTemplate {
  key: string;
  title: string;
  body: string;
  deepLink: string | null;
  enabled: boolean;
  description: string;
  variables: string[];
}

/**
 * The full set of trigger keys we know how to fire. Must stay in sync
 * with the code in scheduled-triggers.ts and the webhook handler. If
 * you add a trigger here and wire it in code, the admin gets a new
 * editable template automatically on next seed run.
 */
export const TEMPLATE_DEFAULTS: Record<string, NotificationTemplate> = {
  welcome: {
    key: "welcome",
    title: "Welcome to Trace 👋",
    body: "We've found {{dealCount}} deals from {{homeAirport}} since you joined.",
    deepLink: "/swipe",
    enabled: false,
    description:
      "Sent ~24 hours after signup. Reinforces the home airport feed and gives the user a reason to come back.",
    variables: ["dealCount", "homeAirport"],
  },
  trial_ending_3d: {
    key: "trial_ending_3d",
    title: "Your trial ends in 3 days",
    body: "Keep unlimited swipes and every deal from your home airport. Subscribe before it ends.",
    deepLink: "/paywall",
    enabled: false,
    description:
      "Sent when the user's trial expires in ~3 days. First warning — gives time to decide before the last-minute 24h push.",
    variables: [],
  },
  trial_ending_24h: {
    key: "trial_ending_24h",
    title: "Your trial ends tomorrow",
    body: "Subscribe to keep unlimited swipes, saves, and deal alerts.",
    deepLink: "/paywall",
    enabled: false,
    description:
      "Sent when the user's trial expires within the next 24 hours. Highest-leverage trial-to-paid moment.",
    variables: [],
  },
  billing_issue: {
    key: "billing_issue",
    title: "There was a problem with your payment",
    body: "We had trouble charging your card. Tap to update your payment method.",
    deepLink: "/profile",
    enabled: false,
    description:
      "Fired when the RevenueCat webhook reports a BILLING_ISSUE event. Aimed at recovering failed renewals.",
    variables: [],
  },
  inactivity_3d: {
    key: "inactivity_3d",
    title: "✈️ {{destination}} for ${{price}}",
    body: "Haven't seen you in a few days — your top deal is waiting.",
    deepLink: "/swipe",
    enabled: false,
    description:
      "Sent to users who haven't opened the app in ~3 days. First-line re-engagement.",
    variables: ["destination", "price", "dealCount", "homeAirport"],
  },
  inactivity_7d: {
    key: "inactivity_7d",
    title: "We miss you ✈️",
    body: "{{destination}} for ${{price}} — one of {{dealCount}} deals waiting from {{homeAirport}}.",
    deepLink: "/swipe",
    enabled: false,
    description:
      "Sent to users who haven't opened the app in ~7 days. Last-ditch reactivation push.",
    variables: ["destination", "price", "dealCount", "homeAirport"],
  },
  inactivity_14d: {
    key: "inactivity_14d",
    title: "Still looking for a deal? ✈️",
    body: "{{destination}} for ${{price}} — come back and swipe.",
    deepLink: "/swipe",
    enabled: false,
    description:
      "Sent to users who haven't opened the app in ~14 days. Final re-engagement attempt.",
    variables: ["destination", "price", "dealCount", "homeAirport"],
  },
  hot_deal_alert: {
    key: "hot_deal_alert",
    title: "🔥 {{discount}}% off to {{destination}}",
    body: "${{price}} from {{homeAirport}}. Limited time — tap to see it.",
    deepLink: "/swipe",
    enabled: false,
    description:
      "Sent daily to premium/business users when a deal ≥60% off exists at their home airport. Picks the best deal of the day.",
    variables: ["discount", "destination", "price", "homeAirport"],
  },
  subscription_renewal_24h: {
    key: "subscription_renewal_24h",
    title: "Your subscription renews tomorrow",
    body: "Your Trace subscription will automatically renew in about 24 hours.",
    deepLink: "/profile",
    enabled: false,
    description:
      "Sent ~24 hours before a paid premium or business subscription renews. Heads-up so users can update payment if needed.",
    variables: [],
  },
  business_class_nudge_5d: {
    key: "business_class_nudge_5d",
    title: "Did you know about business class deals?",
    body: "Trace has lie-flat seats from {{homeAirport}} at up to 70% off. Business tier unlocks them.",
    deepLink: "/paywall",
    enabled: false,
    description:
      "Sent to premium users ~5 days after their first purchase. Educational first nudge about the business tier.",
    variables: ["homeAirport"],
  },
  business_class_nudge: {
    key: "business_class_nudge",
    title: "Business class deals are waiting ✈️",
    body: "Upgrade to Business to unlock lie-flat seat deals from {{homeAirport}}.",
    deepLink: "/paywall",
    enabled: false,
    description:
      "Sent to premium users ~7 days after their first purchase. Second upsell nudge to upgrade to the business tier.",
    variables: ["homeAirport"],
  },
  premium_nudge: {
    key: "premium_nudge",
    title: "You're missing out on deals",
    body: "Premium unlocks unlimited swipes and every deal from {{homeAirport}}. Upgrade now.",
    deepLink: "/paywall",
    enabled: false,
    description:
      "Sent to free users ~5 days after signup. First upsell push to convert to premium.",
    variables: ["homeAirport"],
  },
  premium_nudge_10d: {
    key: "premium_nudge_10d",
    title: "Still exploring? Go Premium ✈️",
    body: "You've been with us 10 days. Unlock every deal from {{homeAirport}} — no swipe limits.",
    deepLink: "/paywall",
    enabled: false,
    description:
      "Sent to free users ~10 days after signup. Second upsell push to convert to premium.",
    variables: ["homeAirport"],
  },
  premium_nudge_20d: {
    key: "premium_nudge_20d",
    title: "Your best deals are locked 🔒",
    body: "20 days in and still on free? Premium gets you everything from {{homeAirport}}.",
    deepLink: "/paywall",
    enabled: false,
    description:
      "Sent to free users ~20 days after signup. Third upsell push to convert to premium.",
    variables: ["homeAirport"],
  },
  discount_on_premium: {
    key: "discount_on_premium",
    title: "Special offer just for you",
    body: "Upgrade to Premium and get your first month at a special rate.",
    deepLink: "/paywall",
    enabled: false,
    description:
      "Sent to free users ~25 days after signup. Last-resort discount push after the regular nudge sequence.",
    variables: [],
  },
  discount_on_business: {
    key: "discount_on_business",
    title: "Upgrade to Business for less",
    body: "You've been with us a month — here's a special rate to unlock business class deals.",
    deepLink: "/paywall",
    enabled: false,
    description:
      "Sent to premium users ~30 days after their first purchase. Discount-angle push to upgrade to business.",
    variables: [],
  },
  welcome_to_premium: {
    key: "welcome_to_premium",
    title: "Welcome to Premium ✈️",
    body: "Unlimited swipes, every deal, and priority alerts. You're all set.",
    deepLink: "/swipe",
    enabled: false,
    description:
      "Fired immediately when a user makes their first paid purchase (non-trial). Sent from the RevenueCat webhook, not the daily cron.",
    variables: [],
  },
  deal_alert_match: {
    key: "deal_alert_match",
    title: "Your {{destination}} alert just matched",
    body: "${{price}} round-trip, {{discount}}% off. Tap to see it.",
    deepLink: "/dashboard",
    enabled: false,
    description:
      "Sent to premium/business users when a deal appears matching one of their saved alerts. Fires once per alert then marks it matched.",
    variables: ["destination", "price", "discount"],
  },
};

const KNOWN_KEYS = Object.keys(TEMPLATE_DEFAULTS);

/**
 * Read a single template from Firestore, falling back to the default
 * if the doc doesn't exist yet (e.g. before the first seed run).
 */
export async function getTemplate(key: string): Promise<NotificationTemplate | null> {
  const fallback = TEMPLATE_DEFAULTS[key] ?? null;
  try {
    const snap = await colRef("notificationTemplates").doc(key).get();
    if (!snap.exists) return fallback;
    const data = snap.data() as Partial<NotificationTemplate>;
    return {
      key,
      title: data.title ?? fallback?.title ?? "",
      body: data.body ?? fallback?.body ?? "",
      deepLink: data.deepLink ?? fallback?.deepLink ?? null,
      enabled: data.enabled ?? false,
      description: data.description ?? fallback?.description ?? "",
      variables: data.variables ?? fallback?.variables ?? [],
    };
  } catch (err) {
    console.warn("[templates] getTemplate failed for", key, err);
    return fallback;
  }
}

/**
 * Substitute {{vars}} in a template string. Unknown vars are left as
 * the literal placeholder so they're visible in QA, rather than
 * silently empty.
 */
export function renderString(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{\{\s*([\w]+)\s*\}\}/g, (match, name) => {
    const v = vars[name];
    return v === undefined || v === null ? match : String(v);
  });
}

/**
 * Seed Firestore with default templates for any keys that don't yet
 * have a doc. Idempotent; re-running won't overwrite admin edits.
 */
export async function seedTemplatesIfMissing(): Promise<{ created: string[] }> {
  const created: string[] = [];
  for (const key of KNOWN_KEYS) {
    const ref = colRef("notificationTemplates").doc(key);
    const snap = await ref.get();
    if (snap.exists) continue;
    const def = TEMPLATE_DEFAULTS[key];
    await ref.set({
      title: def.title,
      body: def.body,
      deepLink: def.deepLink,
      enabled: def.enabled,
      description: def.description,
      variables: def.variables,
      updatedAt: new Date(),
    });
    created.push(key);
  }
  return { created };
}

export const KNOWN_TEMPLATE_KEYS = KNOWN_KEYS;

export type NotificationCategory = "deals" | "account" | "reengagement" | "offers";

export const TEMPLATE_CATEGORY: Record<string, NotificationCategory> = {
  welcome: "account",
  trial_ending_3d: "account",
  trial_ending_24h: "account",
  billing_issue: "account",
  subscription_renewal_24h: "account",
  welcome_to_premium: "account",
  inactivity_3d: "reengagement",
  inactivity_7d: "reengagement",
  inactivity_14d: "reengagement",
  hot_deal_alert: "deals",
  deal_alert_match: "deals",
  premium_nudge: "offers",
  premium_nudge_10d: "offers",
  premium_nudge_20d: "offers",
  discount_on_premium: "offers",
  business_class_nudge_5d: "offers",
  business_class_nudge: "offers",
  discount_on_business: "offers",
};
