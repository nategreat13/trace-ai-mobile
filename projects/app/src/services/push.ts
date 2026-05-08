import * as Notifications from "expo-notifications";
import * as Device from "expo-application";
import Constants from "expo-constants";
import { Platform } from "react-native";
import {
  doc,
  getDoc,
  setDoc,
  arrayUnion,
  arrayRemove,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { logEvent } from "../lib/analytics";

/**
 * Push notification client.
 *
 * Responsibilities:
 *  - Configure how notifications display while the app is foregrounded.
 *  - Request OS permission (called once after onboarding completes).
 *  - Register the device's Expo push token on the user's userProfile.
 *  - Subscribe the in-app notification listeners and fire analytics.
 *
 * Token storage shape on userProfile:
 *   pushTokens: [{ token, platform, addedAt }, ...]
 *
 * Multiple tokens per user is intentional — a user with both an iPhone
 * and an iPad both get notified. The server fans out on every send.
 *
 * EAS project config (used by getExpoPushTokenAsync) is auto-detected
 * from the running app's metadata; no projectId argument needed in
 * Expo SDK 50+ as long as `extra.eas.projectId` is set in app.json.
 */

/**
 * Tell expo-notifications how to display incoming pushes while the app
 * is foregrounded. Default behavior is "do nothing" — without this the
 * banner doesn't show when the user is actively using the app, which is
 * confusing.
 */
export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

/**
 * Request notification permission from the OS. Idempotent — calling
 * twice returns the cached status without re-prompting. Returns the
 * final status string.
 */
export async function requestNotificationPermission(): Promise<
  "granted" | "denied" | "undetermined"
> {
  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status === "undetermined") {
    const requested = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
    status = requested.status;
  }
  logEvent(
    status === "granted" ? "push_permission_granted" : "push_permission_denied",
    { existing_status: existing.status }
  );
  return status as "granted" | "denied" | "undetermined";
}

/**
 * Get the device's Expo push token + register it on the user's
 * userProfile. Should only be called after permission has been granted.
 *
 * `userProfileDocId` is the Firestore doc id of the user's profile
 * (different from userId — there can theoretically be more than one
 * profile doc per user, though the app picks the most recent).
 */
export async function registerPushToken(
  userProfileDocId: string
): Promise<string | null> {
  console.log("[push] registerPushToken: entered, profile:", userProfileDocId);
  try {
    // Pass projectId explicitly. Auto-detection from Constants works in
    // dev builds but is flakier in standalone builds; passing it makes
    // the call deterministic across all build profiles.
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as any).easConfig?.projectId;
    console.log("[push] projectId resolved:", projectId);
    if (!projectId) {
      console.log("[push] projectId missing; aborting");
      logEvent("push_token_register_failed", { stage: "projectId_missing" });
      return null;
    }

    // Retry once — on iOS the APNs device token may not be ready
    // immediately after the user grants permission, even though
    // getPermissionsAsync already reports "granted". A short delay
    // gives the daemon time to issue the token.
    //
    // Each attempt is wrapped in a timeout because getExpoPushTokenAsync
    // can silently hang forever if the iOS aps-environment entitlement
    // is missing from the binary (registerForRemoteNotifications never
    // calls back). Without the timeout, we'd never reach our catch
    // block and never emit a `push_token_register_failed` event —
    // which is exactly the failure mode that caught us pre-fix.
    const fetchToken = () =>
      Promise.race([
        Notifications.getExpoPushTokenAsync({ projectId }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("getExpoPushTokenAsync timed out after 15s")),
            15000
          )
        ),
      ]);

    let tokenResponse;
    try {
      console.log("[push] calling getExpoPushTokenAsync (attempt 1)");
      tokenResponse = await fetchToken();
      console.log("[push] attempt 1 returned");
    } catch (firstErr: any) {
      console.log("[push] attempt 1 threw:", String(firstErr?.message ?? firstErr));
      await new Promise((r) => setTimeout(r, 1500));
      console.log("[push] calling getExpoPushTokenAsync (attempt 2)");
      tokenResponse = await fetchToken();
      console.log("[push] attempt 2 returned");
    }

    const token = tokenResponse.data;
    console.log("[push] token data:", token ? token.slice(0, 30) + "..." : "<empty>");
    if (!token) {
      logEvent("push_token_register_failed", { stage: "empty_token" });
      return null;
    }

    // Append to pushTokens array if not already present. arrayUnion is
    // a no-op for duplicates so re-launches are safe.
    const ref = doc(db, "userProfiles", userProfileDocId);
    console.log("[push] reading existing userProfile to dedupe");
    const existing = await getDoc(ref);
    const currentTokens = (existing.data()?.pushTokens ?? []) as Array<{
      token: string;
    }>;
    const alreadyHas = currentTokens.some((t) => t.token === token);
    console.log("[push] existing tokens count:", currentTokens.length, "already has?", alreadyHas);

    if (!alreadyHas) {
      const record = {
        token,
        platform: Platform.OS as "ios" | "android",
        addedAt: Timestamp.now(),
      };
      console.log("[push] writing new token to userProfiles/", userProfileDocId);
      await setDoc(
        ref,
        { pushTokens: arrayUnion(record) },
        { merge: true }
      );
      console.log("[push] write complete");
      logEvent("push_token_registered", { platform: Platform.OS });
    }

    return token;
  } catch (err: any) {
    console.log("[push] registerPushToken caught:", String(err?.message ?? err));
    if (__DEV__) console.warn("[push] registerPushToken failed:", err);
    logEvent("push_token_register_failed", {
      stage: "exception",
      message: String(err?.message ?? err).slice(0, 200),
    });
    return null;
  }
}

/**
 * Remove a token from the user's profile (e.g. when notifications are
 * disabled in-app, or when the server tells us a token is expired).
 */
export async function unregisterPushToken(
  userProfileDocId: string,
  token: string
): Promise<void> {
  try {
    const ref = doc(db, "userProfiles", userProfileDocId);
    const existing = await getDoc(ref);
    const tokens = (existing.data()?.pushTokens ?? []) as Array<{
      token: string;
      platform: string;
      addedAt: any;
    }>;
    // arrayRemove is value-equality based and may not match exact
    // record shape, so we compute the remaining set by hand.
    const remaining = tokens.filter((t) => t.token !== token);
    await setDoc(ref, { pushTokens: remaining }, { merge: true });
  } catch (err) {
    if (__DEV__) console.warn("[push] unregisterPushToken failed:", err);
  }
}

/**
 * The OS-level permission status (independent of our in-app toggle).
 */
export async function getPermissionStatus(): Promise<
  "granted" | "denied" | "undetermined"
> {
  const { status } = await Notifications.getPermissionsAsync();
  return status as "granted" | "denied" | "undetermined";
}

/**
 * Subscribe to incoming notifications. Returns a cleanup function.
 *
 * `onTap` is fired when the user taps a notification (foreground or
 * cold-start). The handler is responsible for honoring the `deepLink`
 * field in the data payload — typically by navigating to the matching
 * screen. We don't do that routing in this module to keep it free of
 * navigation imports.
 */
export interface PushNotificationData {
  deepLink?: string;
  templateKey?: string;
  [key: string]: unknown;
}

export function subscribeToNotifications(handlers: {
  onReceived?: (data: PushNotificationData) => void;
  onTap?: (data: PushNotificationData) => void;
}): () => void {
  const receivedSub = handlers.onReceived
    ? Notifications.addNotificationReceivedListener((event) => {
        const data = (event.request.content.data ?? {}) as PushNotificationData;
        logEvent("notification_received", {
          template_key: typeof data.templateKey === "string" ? data.templateKey : null,
        });
        handlers.onReceived?.(data);
      })
    : null;

  const tapSub = handlers.onTap
    ? Notifications.addNotificationResponseReceivedListener((response) => {
        const data = (response.notification.request.content.data ?? {}) as PushNotificationData;
        logEvent("notification_opened", {
          template_key: typeof data.templateKey === "string" ? data.templateKey : null,
          deep_link: typeof data.deepLink === "string" ? data.deepLink : null,
        });
        handlers.onTap?.(data);
      })
    : null;

  return () => {
    receivedSub?.remove();
    tapSub?.remove();
  };
}

/* eslint-disable @typescript-eslint/no-unused-vars */
// Force expo-application import retention so the native dep graph
// resolves correctly on iOS at build time. expo-application is a peer
// dep of expo-notifications and provides the bundle identifier for
// APNs registration.
const _keepAlive = Device.applicationName;
