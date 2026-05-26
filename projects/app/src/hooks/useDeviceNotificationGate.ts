import { useEffect, useState } from "react";
import { AppState, DeviceEventEmitter } from "react-native";
import * as Notifications from "expo-notifications";
import { registerPushToken } from "../services/push";
import { getItem, removeItem, setItem } from "../lib/storage";

/**
 * Per-device gate for the push-notifications soft-prompt screen.
 *
 * Why per-device: the existing `notificationPermissionAsked` flag on
 * userProfile is per-user, so a user who logs in on a new device after
 * already going through onboarding on their old device would never see
 * the soft prompt and never get their new device's push token registered.
 *
 * Sources of truth, in priority order:
 *
 *   1. OS permission state (per-device, owned by iOS/Android)
 *      - "granted"      → never show soft prompt; ensure this device's
 *                          push token is on the userProfile (idempotent).
 *      - "denied"       → never show soft prompt. The OS dialog can't be
 *                          re-triggered programmatically anyway; the user
 *                          must enable from Settings, which we surface in
 *                          ProfileScreen.
 *      - "undetermined" → fall through to step 2.
 *
 *   2. AsyncStorage `softPromptDismissedAt` (per-device)
 *      - Set when the user taps "Maybe later" on this device.
 *      - If set: don't re-show the prompt on this install.
 *      - If missing: show the soft prompt.
 *
 * Net effect for common scenarios:
 *
 *   • New install on new device, existing account
 *       OS=undetermined, no AS flag → soft prompt shows. ✓
 *   • Same device, user previously enabled
 *       OS=granted → no prompt, registerPushToken re-syncs token. ✓
 *   • Same device, user previously denied at OS dialog
 *       OS=denied → no prompt. ✓
 *   • Same device, user tapped "Maybe later" on this install
 *       OS=undetermined, AS flag set → no prompt. ✓
 */

// Storage key passed to env-aware `getItem`/`setItem` from lib/storage.
// The wrapper auto-prefixes with `trace.{env}.`, so on disk this becomes
// `trace.prod.push.softPromptDismissedAt` (or `trace.staging.…`),
// keeping prod and staging dismissal state cleanly separated.
const SOFT_PROMPT_DISMISSED_KEY = "push.softPromptDismissedAt";
const RECHECK_EVENT = "trace.notificationGate.recheck";

export type DeviceNotificationGate = {
  /** False until we've checked OS state + AsyncStorage. Render a loader. */
  resolved: boolean;
  /** True iff we should route to NotificationsPermissionScreen. */
  shouldShowSoftPrompt: boolean;
};

export function useDeviceNotificationGate(
  profileId: string | null
): DeviceNotificationGate {
  const [state, setState] = useState<DeviceNotificationGate>({
    resolved: false,
    shouldShowSoftPrompt: false,
  });
  // Bumping this forces the effect below to re-run. We bump from:
  //   - AppState transitions to "active" (covers post-OS-dialog return,
  //     post-Settings return, generally any foregrounding)
  //   - Explicit triggerGateRecheck() calls (covers "Maybe later",
  //     which doesn't fire any AppState change)
  const [recheckTick, setRecheckTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      console.log("[gate] check() running, profileId:", profileId);
      if (!profileId) {
        if (!cancelled) {
          setState({ resolved: true, shouldShowSoftPrompt: false });
        }
        return;
      }

      try {
        const { status, canAskAgain } = await Notifications.getPermissionsAsync();
        console.log(
          "[gate] OS permission status:",
          status,
          "canAskAgain:",
          canAskAgain
        );

        if (status === "granted") {
          // OS already granted on this device. Resolve the gate
          // IMMEDIATELY so the navigator can swap to MainTabs — don't
          // block on the Firestore write. registerPushToken is
          // idempotent and has its own error handling, so firing it
          // without await is safe.
          if (!cancelled) {
            setState({ resolved: true, shouldShowSoftPrompt: false });
          }
          console.log("[gate] firing registerPushToken in background");
          registerPushToken(profileId)
            .then((tok) => console.log("[gate] registerPushToken resolved:", tok ? tok.slice(0, 30) + "..." : tok))
            .catch((err) => console.log("[gate] registerPushToken threw (should not happen):", err));
          return;
        }

        // "denied" alone isn't enough to give up. On Android 13+ a
        // freshly-installed app's POST_NOTIFICATIONS permission often
        // starts in `{ status: "denied", canAskAgain: true }` — Android
        // doesn't expose "undetermined" the way iOS does. We can still
        // call requestPermissionsAsync to trigger the OS dialog. Only
        // when canAskAgain is false (iOS after one denial, Android
        // after multiple denials or "Don't ask again") is the user
        // truly locked out and must visit Settings.
        if (status === "denied" && !canAskAgain) {
          if (!cancelled) {
            setState({ resolved: true, shouldShowSoftPrompt: false });
          }
          return;
        }

        // Either status === "undetermined" (typical iOS first launch)
        // OR status === "denied" with canAskAgain (typical Android 13+
        // first launch). Show the soft prompt unless the user already
        // dismissed it on this install.
        const dismissedAt = await getItem<string>(SOFT_PROMPT_DISMISSED_KEY);
        if (!cancelled) {
          setState({
            resolved: true,
            shouldShowSoftPrompt: !dismissedAt,
          });
        }
      } catch (err) {
        if (__DEV__) {
          console.warn("[useDeviceNotificationGate] failed:", err);
        }
        // On error, don't block the user — let them through to the app.
        if (!cancelled) {
          setState({ resolved: true, shouldShowSoftPrompt: false });
        }
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, [profileId, recheckTick]);

  // Re-check on foreground. iOS treats the system permission dialog as
  // a foreground transition (inactive → active around the dialog), so
  // accepting/declining the OS prompt naturally triggers a re-check
  // without any explicit wiring from the soft-prompt screen.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") {
        setRecheckTick((t) => t + 1);
      }
    });
    return () => sub.remove();
  }, []);

  // Re-check on explicit signals from triggerGateRecheck(). The soft-
  // prompt screen fires this from "Maybe later" (no OS dialog, so no
  // AppState change) and as a belt-and-suspenders signal from "Enable".
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(RECHECK_EVENT, () => {
      setRecheckTick((t) => t + 1);
    });
    return () => sub.remove();
  }, []);

  return state;
}

/**
 * Force any mounted useDeviceNotificationGate hook to re-evaluate. Use
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
