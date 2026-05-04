import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../services/firebase";

/**
 * Lightweight analytics wrapper — writes events to Firestore's `events`
 * collection. The analytics dashboard queries that collection directly.
 *
 * Design notes:
 *  - Fire-and-forget: we never await these calls from UI code, and we swallow
 *    failures so nothing breaks if a user is offline or Firestore hiccups.
 *  - Small prop payloads only (scalars / short strings). Do NOT log PII
 *    beyond the Firebase UID that is already on every event.
 *  - Currently guest (no user) events are still logged, but `userId` is the
 *    string "guest" so we can filter them out server-side.
 */

export type AnalyticsEventName =
  // Lifecycle
  | "app_open"
  | "login"
  // Pre-signup
  | "landing_viewed"
  | "airport_changed"
  | "guest_swipe"
  | "guest_detail_prompt"
  | "soft_prompt_shown"
  | "soft_prompt_accepted"
  | "hard_wall_shown"
  | "hard_wall_accepted"
  // Signup / onboarding
  | "signup_viewed"
  | "signup_completed"
  | "onboarding_started"
  | "onboarding_completed"
  // Engagement
  | "swipe"
  | "deal_saved"
  | "deal_alert_created"
  | "deal_book_tapped"
  | "deal_expanded"
  | "screen_view"
  | "daily_limit_hit"
  | "ai_learning_shown"
  | "badge_unlocked"
  | "level_up"
  // Paywall
  | "paywall_viewed"
  | "paywall_tier_selected"
  | "paywall_cta_tapped"
  | "paywall_restore_tapped"
  | "paywall_dismissed"
  | "paywall_legal_tapped"
  // Subscription — client-side (user-action funnel)
  | "purchase_initiated"
  | "purchase_completed"
  | "purchase_failed"
  | "purchase_canceled"
  | "trial_started"
  // Subscription — server-side (emitted by the RevenueCat webhook;
  // included here so the dashboard schema is aware of every event name).
  // Names mirror RC event types but use snake_case past-tense for
  // consistency with the rest of the schema.
  | "subscription_started"
  | "trial_started_server"
  | "subscription_renewed"
  | "subscription_uncanceled"
  | "subscription_changed"
  | "subscription_canceled"
  | "subscription_expired"
  | "billing_issue";

let currentUserId: string | null = null;

/**
 * Call this from AuthContext on sign-in / sign-out so events are stamped
 * with the right user ID.
 */
export function setAnalyticsUser(userId: string | null) {
  currentUserId = userId;
}

export function logEvent(
  name: AnalyticsEventName,
  props: Record<string, string | number | boolean | null | undefined> = {}
): void {
  // Strip undefined so Firestore doesn't reject the doc
  const cleanProps: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) {
    if (v !== undefined) cleanProps[k] = v;
  }

  addDoc(collection(db, "events"), {
    name,
    userId: currentUserId ?? "guest",
    props: cleanProps,
    timestamp: serverTimestamp(),
  }).catch((err) => {
    // Swallow — analytics must never break the app
    if (__DEV__) console.warn("[analytics] log failed:", name, err?.message);
  });
}
