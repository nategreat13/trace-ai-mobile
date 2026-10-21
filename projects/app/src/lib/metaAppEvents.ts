/**
 * Meta app events, logged through the native Facebook SDK.
 *
 * ── Why this file exists ──────────────────────────────────────────────────
 * We already forward conversions to Meta server-side (see the server's
 * `ad-conversions.ts`), but those go out with `action_source: "website"` —
 * deliberately, because an "app" event over the Conversions API requires an
 * `app_data.extinfo` device block that a Firestore trigger or a RevenueCat
 * webhook has no way to build. Meta hard-rejects app events without it.
 *
 * That choice was right for *matching* and wrong for *optimization*: a
 * website event cannot be chosen as the goal of an app campaign. Meta
 * confirmed this directly — to run "Maximize number of app events" against
 * Complete registration, the event has to arrive attributed to the iOS app
 * (ID 1374157047905484), not the site.
 *
 * `react-native-fbsdk-next` has been a dependency since May 2026 and is
 * configured in app.json with that exact app ID, `isAutoInitEnabled` and
 * `autoLogAppEventsEnabled` both on — it is compiled into the live binary
 * (FBSDKCoreKit 18.0.3 in Podfile.lock). It was simply never imported, so
 * only Meta's own automatic events (install, launch) ever fired and nothing
 * we care about did. Logging through it is therefore a JS-only change.
 *
 * ── Deliberate choices ────────────────────────────────────────────────────
 * • **Lazy `require`, never a static import.** A static import of a native
 *   module evaluates at file load; anywhere the native side is absent (Expo
 *   Go, a web build, a stale dev client) that would take down whatever
 *   imported it. Here the worst case is one unsent analytics event.
 * • **Everything is best-effort.** No call awaits, throws, or blocks a user
 *   action. Ad attribution is never worth a failed signup.
 * • **These are additional to, not replacements for, the server CAPI
 *   events.** The two land in different datasets (app vs pixel), so they
 *   don't deduplicate against each other — worth knowing before counting
 *   registrations across both in Ads Manager.
 *
 * ── Known limitation ──────────────────────────────────────────────────────
 * `advertiserIDCollectionEnabled` is false in app.json and a
 * `withoutAdIdPermission` plugin strips the ad-ID permission, so there is no
 * IDFA and no ATT prompt. Events still count for optimization via Meta's
 * Aggregated Event Measurement, but per-user attribution is coarser than a
 * consented install would give. Changing that is a product decision about
 * showing an ATT prompt, not a bug here.
 */

import { getItemRaw, setItemRaw } from "./storage";

/** Meta's canonical event names. Strings, not SDK constants, so that a
 *  missing native module can't break the import. */
const COMPLETE_REGISTRATION = "fb_mobile_complete_registration";
const START_TRIAL = "StartTrial";
const INITIATED_CHECKOUT = "fb_mobile_initiated_checkout";
const TUTORIAL_COMPLETION = "fb_mobile_tutorial_completion";

type Logger = {
  logEvent: (name: string, ...args: Array<number | Record<string, string | number>>) => void;
  setUserID: (id: string) => void;
  setUserData: (data: Record<string, string | null>) => void;
};

function logger(): Logger | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require("react-native-fbsdk-next");
    return (mod?.AppEventsLogger ?? null) as Logger | null;
  } catch {
    return null;
  }
}

/**
 * Identify the user to Meta so app events can be matched to a person.
 *
 * `setUserData` hashes on the native side before anything leaves the device —
 * the raw email is never transmitted. Safe to call repeatedly; the SDK keeps
 * the values until they're cleared.
 */
export function identifyForMeta(userId: string, email?: string | null): void {
  try {
    const l = logger();
    if (!l) return;
    l.setUserID(userId);
    if (email) l.setUserData({ em: email.trim().toLowerCase() });
  } catch {
    /* best-effort */
  }
}

/**
 * The event Meta's app campaigns will optimize against.
 *
 * Fires at account creation — the same moment the server-side
 * `CompleteRegistration` goes out, just attributed to the app instead of the
 * website.
 */
export function logMetaCompleteRegistration(method = "email"): void {
  try {
    logger()?.logEvent(COMPLETE_REGISTRATION, {
      fb_registration_method: method,
    });
  } catch {
    /* best-effort */
  }
}

/**
 * Free-trial start, as an app event.
 *
 * Not what Meta asked for today, but the same mechanism and the event we'll
 * want to optimize on once trial volume can support it — at ~3-16 trials a
 * week it is far below the ~50/week an ad set needs to leave the learning
 * phase, so it's worth logging now purely to build history.
 */
export function logMetaStartTrial(
  valueUsd: number | null,
  currency: string | null,
): void {
  try {
    // The value is the SDK's separate valueToSum argument. Passed inside the
    // parameters object it arrives as a custom parameter and the event's
    // value is 0.
    logger()?.logEvent(START_TRIAL, valueUsd ?? 0, {
      fb_currency: currency ?? "USD",
    });
  } catch {
    /* best-effort */
  }
}

/** Log a Meta event at most once per install. */
const loggedOnce = new Set<string>();
async function logOncePerInstall(
  key: string,
  log: (l: Logger) => void,
): Promise<void> {
  try {
    if (loggedOnce.has(key)) return;
    loggedOnce.add(key);
    const storageKey = `meta.once.${key}`;
    if (await getItemRaw(storageKey)) return;
    await setItemRaw(storageKey, "1");
    const l = logger();
    if (l) log(l);
  } catch {
    /* best-effort */
  }
}

/**
 * First time this install opens the paywall, as Meta's standard "Initiate
 * checkout" — the proposed app-campaign goal (Oct 2026).
 *
 * Why this one: it's the closest event to a trial that still has the volume
 * to optimize on. An ad set needs ~50 a week to leave learning; at $60/day
 * that means under ~$8.40 per event. Trials run ~8/week. Paywall opens ran
 * ~78 unique devices/week over Sept 23–Oct 20 — 22% of everyone who opened
 * the app, nearly all by tapping (the automatic push was broken), so it's a
 * real intent signal, not a forced view. Once per install, so one curious
 * user can't count five times.
 */
export function logMetaFirstPaywallView(entryPoint: string): void {
  logOncePerInstall("paywall_view", (l) =>
    l.logEvent(INITIATED_CHECKOUT, {
      fb_content_type: "subscription",
      fb_content_id: entryPoint,
      fb_currency: "USD",
    }),
  );
}

/**
 * Reached "Your feed is ready" — onboarding done — as Meta's standard
 * "Complete tutorial". The fallback goal if Initiate checkout can't clear
 * ~50/week: roughly 1 in 3 people who open the app got this far on the old
 * flow, and the swipe-first flow should push that higher.
 */
export function logMetaFeedReady(): void {
  logOncePerInstall("feed_ready", (l) =>
    l.logEvent(TUTORIAL_COMPLETION, { fb_success: 1 }),
  );
}
