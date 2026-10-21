import Purchases, {
  LOG_LEVEL,
  PurchasesOfferings,
  PurchasesPackage,
  CustomerInfo,
} from "react-native-purchases";
import { Platform } from "react-native";

const IOS_API_KEY = "appl_BFjCotDvhsDBOschVVzoWiRPabt";
const ANDROID_API_KEY = "goog_AeONOrpyROKpCepkdogBNUGAsiV";

let initialized = false;
let currentUserId: string | null = null;

/**
 * Configure RevenueCat for this Firebase user, or switch to them.
 *
 * Signing in while an anonymous session is open (onboarding's "Sign in
 * instead", or SaveAccount's) changes the Firebase user without ever passing
 * through signed-out, so logOutIAP never runs. Returning early here used to
 * leave RevenueCat identified as the anonymous user: the signed-in customer's
 * entitlement didn't show, and anything restored or bought attached to the
 * abandoned anonymous id. A different uid now goes through Purchases.logIn.
 */
export async function initializeIAP(userId: string): Promise<void> {
  if (initialized) {
    if (currentUserId !== userId) {
      currentUserId = userId;
      try {
        await Purchases.logIn(userId);
        console.log("[IAP] Switched to user:", userId);
      } catch (err) {
        console.warn("[IAP] logIn failed:", err);
      }
    }
    return;
  }

  if (__DEV__) {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  }

  const apiKey = Platform.OS === "ios" ? IOS_API_KEY : ANDROID_API_KEY;
  await Purchases.configure({ apiKey, appUserID: userId });
  initialized = true;
  currentUserId = userId;
  console.log("[IAP] Initialized for user:", userId);
}

export async function getOfferings(): Promise<PurchasesOfferings> {
  const offerings = await Purchases.getOfferings();
  return offerings;
}

export async function purchasePackage(
  pkg: PurchasesPackage
): Promise<CustomerInfo> {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return customerInfo;
}

export async function restorePurchases(): Promise<CustomerInfo> {
  const customerInfo = await Purchases.restorePurchases();
  return customerInfo;
}

export async function getCustomerInfo(): Promise<CustomerInfo> {
  const customerInfo = await Purchases.getCustomerInfo();
  return customerInfo;
}

export function hasEntitlement(
  customerInfo: CustomerInfo,
  entitlement: "premium" | "business"
): boolean {
  return (
    typeof customerInfo.entitlements.active[entitlement] !== "undefined"
  );
}

/**
 * Distilled view of the user's *live* entitlement state straight from
 * RevenueCat (the payments source of truth) — independent of the Firestore
 * profile the webhook maintains. Used by AuthContext to grant access even if
 * a webhook was missed, and to know whether the active period is a free trial.
 */
export interface EntitlementState {
  /** Any active premium-or-business entitlement. */
  isPremium: boolean;
  /** The active entitlement is currently in its free-trial period. */
  isTrial: boolean;
  /** Highest active tier, or null. */
  tier: "premium" | "business" | null;
  /** When the current period (trial or paid) ends. */
  expiresAt: Date | null;
}

export function readEntitlementState(
  info: CustomerInfo | null | undefined
): EntitlementState {
  if (!info) {
    return { isPremium: false, isTrial: false, tier: null, expiresAt: null };
  }
  const business = info.entitlements.active["business"];
  const premium = info.entitlements.active["premium"];
  const active = business ?? premium;
  const tier: "premium" | "business" | null = business
    ? "business"
    : premium
      ? "premium"
      : null;
  return {
    isPremium: !!active,
    isTrial: active?.periodType === "TRIAL",
    tier,
    expiresAt: active?.expirationDate ? new Date(active.expirationDate) : null,
  };
}

/**
 * Subscribe to live RevenueCat CustomerInfo changes (purchases, renewals,
 * restores, and expirations the SDK detects). Returns an unsubscribe fn.
 */
export function addCustomerInfoListener(
  cb: (info: CustomerInfo) => void
): () => void {
  Purchases.addCustomerInfoUpdateListener(cb);
  return () => Purchases.removeCustomerInfoUpdateListener(cb);
}

export async function logOutIAP(): Promise<void> {
  if (!initialized) return;
  try {
    await Purchases.logOut();
  } catch {
    // silent — user may not have been identified
  }
  initialized = false;
  currentUserId = null;
}
