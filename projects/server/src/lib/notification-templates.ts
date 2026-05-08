import { getDb } from "../firebase";

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
    title: "{{dealCount}} new deals waiting",
    body: "Haven't seen you in a few days. Come check what's new from {{homeAirport}}.",
    deepLink: "/swipe",
    enabled: false,
    description:
      "Sent to users who haven't opened the app in ~3 days. First-line re-engagement.",
    variables: ["dealCount", "homeAirport"],
  },
  inactivity_7d: {
    key: "inactivity_7d",
    title: "We miss you ✈️",
    body: "Your home airport has {{dealCount}} new deals this week.",
    deepLink: "/swipe",
    enabled: false,
    description:
      "Sent to users who haven't opened the app in ~7 days. Last-ditch reactivation push.",
    variables: ["dealCount", "homeAirport"],
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
    const db = getDb();
    const snap = await db.collection("notificationTemplates").doc(key).get();
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
  const db = getDb();
  const created: string[] = [];
  for (const key of KNOWN_KEYS) {
    const ref = db.collection("notificationTemplates").doc(key);
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
