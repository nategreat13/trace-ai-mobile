import Purchases, {
  LOG_LEVEL,
  PurchasesOfferings,
  PurchasesPackage,
  CustomerInfo,
} from "react-native-purchases";
import { Platform } from "react-native";

const IOS_API_KEY = "appl_BFjCotDvhsDBOschVVzoWiRPabt";
// TODO: replace with your actual Android SDK key from RevenueCat
const ANDROID_API_KEY = "goog_REPLACE_ME";

let initialized = false;

export async function initializeIAP(userId: string): Promise<void> {
  if (initialized) return;

  if (__DEV__) {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  }

  const apiKey = Platform.OS === "ios" ? IOS_API_KEY : ANDROID_API_KEY;
  await Purchases.configure({ apiKey, appUserID: userId });
  initialized = true;
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

export async function logOutIAP(): Promise<void> {
  if (!initialized) return;
  try {
    await Purchases.logOut();
  } catch {
    // silent — user may not have been identified
  }
  initialized = false;
}
