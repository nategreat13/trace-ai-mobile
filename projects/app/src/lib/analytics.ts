import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { Platform } from "react-native";
import * as Updates from "expo-updates";
import { db } from "../services/firebase";
import { getSessionId } from "./session";

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
 *  - Every event is auto-stamped with universal context (platform, app
 *    version, OS version, locale, session id, experiments slot) so we can
 *    slice any event by any of these dimensions later. This is computed
 *    once per call instead of once per process so changing locale or
 *    backgrounded-then-resumed sessions are picked up correctly.
 */

export type AnalyticsEventName =
  // Lifecycle
  | "app_open"
  | "login"
  | "password_reset_requested"
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
  | "subscription_started_promo"
  | "trial_started_server"
  | "subscription_renewed"
  | "subscription_uncanceled"
  | "subscription_changed"
  | "subscription_canceled"
  | "subscription_expired"
  | "billing_issue"
  // Promo code redemption flow (client-side)
  | "promo_redeem_attempted"
  | "promo_redeem_succeeded"
  | "promo_redeem_failed"
  // Push notifications (client-side)
  | "push_soft_prompt_shown"
  | "push_soft_prompt_enable_tapped"
  | "push_soft_prompt_later_tapped"
  | "push_permission_requested"
  | "push_permission_granted"
  | "push_permission_denied"
  | "push_token_registered"
  | "notification_received"
  | "notification_opened";

let currentUserId: string | null = null;

/**
 * Call this from AuthContext on sign-in / sign-out so events are stamped
 * with the right user ID.
 */
export function setAnalyticsUser(userId: string | null) {
  currentUserId = userId;
}

/**
 * Universal context attached to every event. Computed at call time rather
 * than at module load so values like locale and session_id stay correct
 * as the user moves through the app.
 *
 * `app_version` uses `Updates.runtimeVersion` (set in app.json's
 * `expo.runtimeVersion`) since we don't have `expo-constants` installed.
 * In this codebase runtimeVersion and the marketing version are kept in
 * sync, so this is a faithful proxy. If/when expo-application is added,
 * swap in `Application.nativeApplicationVersion` for the binary version.
 *
 * `country` is parsed out of the locale string (e.g. "en-US" → "US").
 * Falls back to null when only the language is available (e.g. "en").
 */
function getBaseProps(): Record<string, string | null> {
  let locale: string | null = null;
  try {
    locale = Intl.DateTimeFormat().resolvedOptions().locale ?? null;
  } catch {
    locale = null;
  }
  const country =
    locale && locale.includes("-") ? locale.split("-")[1] : null;

  return {
    platform: Platform.OS,
    os_version: String(Platform.Version ?? ""),
    app_version: (Updates.runtimeVersion as string | undefined) ?? null,
    locale,
    country,
    session_id: getSessionId(),
  };
}

export function logEvent(
  name: AnalyticsEventName,
  props: Record<string, string | number | boolean | null | undefined> = {}
): void {
  // Strip undefined so Firestore doesn't reject the doc
  const cleanProps: Record<string, unknown> = { ...getBaseProps() };
  for (const [k, v] of Object.entries(props)) {
    if (v !== undefined) cleanProps[k] = v;
  }
  // Reserved slot for A/B test variants. Empty for now; populating it
  // later requires no schema migration on the events collection.
  if (!("experiments" in cleanProps)) cleanProps.experiments = {};

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
