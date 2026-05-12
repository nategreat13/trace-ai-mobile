/**
 * Maps each notification template key to one of the four user-facing
 * preference categories shown in the mobile app's Profile screen
 * (Deal alerts, Account & billing, Re-engagement, Tips & recommendations).
 *
 * Used by `sendToUser` to gate templated sends: if a user has the
 * relevant category disabled, the push is silently dropped.
 *
 * Categories:
 *   deals        - hot_deal_alert, deal_alert_match
 *   account      - trial_ending_*, billing_issue, subscription_renewal_24h,
 *                  welcome_to_premium
 *   reengagement - welcome, inactivity_3d/7d/14d
 *   offers       - premium_nudge_*, business_class_nudge_*, discount_on_*
 *
 * Free-form admin pushes (no templateKey) and the test-push button
 * (force: true) bypass this check entirely.
 */
export type NotificationCategory = "deals" | "account" | "reengagement" | "offers";

export const TEMPLATE_CATEGORY: Record<string, NotificationCategory> = {
  // Re-engagement — welcome is technically lifecycle but it's a
  // "come back to the app" nudge so it lives here. Inactivity series
  // is obviously re-engagement.
  welcome: "reengagement",
  inactivity_3d: "reengagement",
  inactivity_7d: "reengagement",
  inactivity_14d: "reengagement",

  // Account lifecycle — anything tied to subscription state changes
  // the user needs to act on or be informed about.
  trial_ending_3d: "account",
  trial_ending_24h: "account",
  billing_issue: "account",
  subscription_renewal_24h: "account",
  welcome_to_premium: "account",

  // Deals — directly tied to flight deal events.
  hot_deal_alert: "deals",
  deal_alert_match: "deals",

  // Offers / upsells — promotional pushes the user might not care about.
  premium_nudge: "offers",
  premium_nudge_10d: "offers",
  premium_nudge_20d: "offers",
  discount_on_premium: "offers",
  discount_on_business: "offers",
  business_class_nudge_5d: "offers",
  business_class_nudge: "offers",
};

interface NotificationPreferences {
  deals?: boolean;
  account?: boolean;
  reengagement?: boolean;
  offers?: boolean;
}

/**
 * Returns true iff the user has opted in (or hasn't opted out — missing
 * preferences default to enabled) to the category that this template
 * belongs to. Unknown template keys always return true; we'd rather
 * fire a push for a new trigger than silently drop it because we forgot
 * to map it here.
 */
export function isTemplateAllowedForUser(
  templateKey: string | undefined,
  prefs: NotificationPreferences | undefined
): boolean {
  if (!templateKey) return true; // free-form push, no category to check
  const category = TEMPLATE_CATEGORY[templateKey];
  if (!category) return true; // unknown template — fail open
  if (!prefs) return true; // user has never edited prefs → all categories on
  // Explicit `false` means user toggled OFF. Missing or true → allowed.
  return prefs[category] !== false;
}
