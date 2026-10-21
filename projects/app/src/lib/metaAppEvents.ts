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
const ADD_TO_WISHLIST = "fb_mobile_add_to_wishlist";

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

const FIRST_SAVE_KEY = "meta.firstSaveLogged";
let firstSaveLogged = false;

/**
 * A user's first saved deal, as Meta's standard "Add to wishlist" event —
 * which is exactly what a save is.
 *
 * This is the goal for the app campaign once sign-up stops being a wall
 * (Oct 2026 swipe-first flow): the first save happens in the first minute,
 * from someone who has seen real fares and wanted one, and at the volume of
 * new users it clears the ~50/week an ad set needs to leave learning. Logged
 * once per install — repeat saves are engagement, not acquisition.
 */
export async function logMetaFirstSave(deal: {
  destination?: string;
  price?: number;
}): Promise<void> {
  try {
    if (firstSaveLogged) return;
    firstSaveLogged = true;
    if (await getItemRaw(FIRST_SAVE_KEY)) return;
    await setItemRaw(FIRST_SAVE_KEY, "1");
    logger()?.logEvent(ADD_TO_WISHLIST, deal.price ?? 0, {
      fb_content_type: "flight",
      fb_content_id: deal.destination ?? "",
      fb_currency: "USD",
    });
  } catch {
    /* best-effort */
  }
}
