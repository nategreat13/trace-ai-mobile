import { useEffect, useState } from "react";
import { AppState, DeviceEventEmitter } from "react-native";
import * as Notifications from "expo-notifications";
import { registerPushToken } from "../services/push";
import { getItem, removeItem, setItem } from "../lib/storage";

/**
 * Per-device push-notifications soft-prompt utilities.
 *
 * Two separable concerns, intentionally split into two hooks:
 *
 *   1. useEnsurePushTokenRegistered — runs always, just re-syncs the
 *      push token to the userProfile when OS permission is already
 *      granted on this device (handles "signed in on a new device"). No
 *      UI side effects.
 *
 *   2. useShouldShowSoftPrompt — returns whether the per-device gates
 *      currently allow showing the soft prompt. Called from MainTabs
 *      after the user saves their first deal — we hold the ask for the
 *      moment of demonstrated value rather than firing it cold right
 *      after onboarding (the v1.3.2 cohort accepted at ~24% from the
 *      cold post-onboarding ask).
 *
 * Per-device soft-prompt gates, in priority order:
 *
 *   1. OS permission state (owned by iOS/Android)
 *      - "granted"      → never show soft prompt.
 *      - "denied" + !canAskAgain → never show. OS dialog can't be
 *                                   re-triggered programmatically; the
 *                                   user must visit Settings.
 *      - else fall through to step 2.
 *
 *   2. AsyncStorage `softPromptDismissedAt` (per-device)
 *      - Set when the user taps "Maybe later" on this device.
 *      - If set: don't re-show the prompt on this install.
 *      - If missing: prompt is eligible to show.
 */

// Storage key passed to env-aware `getItem`/`setItem` from lib/storage.
// The wrapper auto-prefixes with `trace.{env}.`, so on disk this becomes
// `trace.prod.push.softPromptDismissedAt` (or `trace.staging.…`),
// keeping prod and staging dismissal state cleanly separated.
const SOFT_PROMPT_DISMISSED_KEY = "push.softPromptDismissedAt";
const RECHECK_EVENT = "trace.notificationGate.recheck";

/**
 * Best-effort: if OS permission is already granted on this device, fire
 * registerPushToken(profileId) so the userProfile has this device's
 * Expo token. Idempotent — safe to call on every authed launch.
 */
export function useEnsurePushTokenRegistered(profileId: string | null): void {
  useEffect(() => {
    if (!profileId) return;
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Notifications.getPermissionsAsync();
        if (cancelled || status !== "granted") return;
        registerPushToken(profileId).catch(() => {});
      } catch {
        // Permission read failures are non-fatal — the soft prompt path
        // will eventually re-attempt registration.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profileId]);
}

/**
 * Resolve whether the soft prompt is currently eligible to show on this
 * device. Caller decides WHEN to act on a true value (e.g. after first
 * save). Re-checks on AppState=active and on triggerGateRecheck().
 *
 * Returns `null` while still resolving so callers can defer side effects
 * until the answer is known.
 */
export function useShouldShowSoftPrompt(): boolean | null {
  const [shouldShow, setShouldShow] = useState<boolean | null>(null);
  // Bumping this re-runs the check effect. Triggered by AppState=active
  // and explicit triggerGateRecheck() calls.
  const [recheckTick, setRecheckTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status, canAskAgain } = await Notifications.getPermissionsAsync();

        if (status === "granted") {
          if (!cancelled) setShouldShow(false);
          return;
        }

        // "denied" + !canAskAgain means iOS won't ever show the dialog
        // again (or Android user picked "Don't ask again") — soft prompt
        // would be pointless. Android 13+ first launch can report
        // `{ status: "denied", canAskAgain: true }` for a brand-new
        // install with no prior decision, which we DO want to prompt on.
        if (status === "denied" && !canAskAgain) {
          if (!cancelled) setShouldShow(false);
          return;
        }

        const dismissedAt = await getItem<string>(SOFT_PROMPT_DISMISSED_KEY);
        if (!cancelled) setShouldShow(!dismissedAt);
      } catch (err) {
        if (__DEV__) console.warn("[useShouldShowSoftPrompt] failed:", err);
        if (!cancelled) setShouldShow(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [recheckTick]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") setRecheckTick((t) => t + 1);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(RECHECK_EVENT, () => {
      setRecheckTick((t) => t + 1);
    });
    return () => sub.remove();
  }, []);

  return shouldShow;
}

/**
 * Force any mounted useShouldShowSoftPrompt hook to re-evaluate. Use
 * after taking an action that should cause the gate to resolve to a
 * different value (e.g. dismissing the soft prompt).
 */
export function triggerGateRecheck(): void {
  DeviceEventEmitter.emit(RECHECK_EVENT);
}

/**
 * Record that the user tapped "Maybe later" on this device. Called by
 * NotificationsPermissionScreen so we don't keep re-prompting on every
 * cold launch while OS state remains "undetermined".
 */
export async function markSoftPromptDismissed(): Promise<void> {
  // setItem is best-effort and swallows errors internally — if
  // AsyncStorage fails the user just sees the prompt again next
  // launch, which is annoying but not broken.
  await setItem(SOFT_PROMPT_DISMISSED_KEY, new Date().toISOString());
}

/**
 * Clear the per-device dismissal. Call this if we want to give the user
 * a contextual re-prompt later (e.g. when they try to set a deal alert
 * — a high-intent moment where re-asking makes sense). Not currently
 * wired into any UI.
 */
export async function clearSoftPromptDismissal(): Promise<void> {
  await removeItem(SOFT_PROMPT_DISMISSED_KEY);
}
