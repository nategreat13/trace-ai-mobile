import { useState, useEffect, useCallback } from "react";
import {
  PurchasesOfferings,
  PurchasesPackage,
  CustomerInfo,
  INTRO_ELIGIBILITY_STATUS,
} from "react-native-purchases";
import Purchases from "react-native-purchases";
import {
  getOfferings,
  purchasePackage,
  restorePurchases,
  hasEntitlement,
} from "../services/iap";
import { logEvent } from "../lib/analytics";

/**
 * Optional context the caller can pass to `purchase()` so analytics events
 * (purchase_completed / failed / canceled / trial_started) are tagged with
 * the tier and billing period the user selected. Falls back to inferring
 * from the product identifier if omitted.
 */
interface PurchaseContext {
  tier?: "premium" | "business";
  billing?: "monthly" | "annual";
}

interface UseIAPResult {
  offerings: PurchasesOfferings | null;
  premiumAnnualPackage: PurchasesPackage | null;
  premiumMonthlyPackage: PurchasesPackage | null;
  businessAnnualPackage: PurchasesPackage | null;
  businessMonthlyPackage: PurchasesPackage | null;
  trialEligible: boolean;
  loading: boolean;
  purchasing: boolean;
  error: string | null;
  purchase: (
    pkg: PurchasesPackage,
    context?: PurchaseContext
  ) => Promise<CustomerInfo | null>;
  restore: () => Promise<CustomerInfo | null>;
}

const PRODUCT_IDS = [
  "trace_premium_annual",
  "trace_premium_monthly",
  "trace_business_annual",
  "trace_business_monthly",
] as const;

export function useIAP(): UseIAPResult {
  const [offerings, setOfferings] = useState<PurchasesOfferings | null>(null);
  const [trialEligible, setTrialEligible] = useState(true);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const off = await getOfferings();
        if (!cancelled) setOfferings(off);

        // Check trial eligibility across all products. User is eligible if any
        // product still offers them the intro offer.
        try {
          const eligibility =
            await Purchases.checkTrialOrIntroductoryPriceEligibility([
              ...PRODUCT_IDS,
            ]);
          const eligible = Object.values(eligibility).some(
            (e) => e.status === INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE
          );
          if (!cancelled) setTrialEligible(eligible);
        } catch {
          if (!cancelled) setTrialEligible(true);
        }
      } catch (err: any) {
        console.error("[useIAP] Failed to load offerings:", err);
        if (!cancelled) setError(err.message || "Failed to load plans");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // On iOS, product identifiers are the plain product ID (e.g.
  // "trace_premium_annual"). On Android, RevenueCat appends the base plan
  // name (e.g. "trace_premium_annual:premium-annual") so the same product
  // can host multiple base plans. Accept both forms.
  const findPackage = (productId: string) =>
    offerings?.current?.availablePackages.find(
      (p) =>
        p.product.identifier === productId ||
        p.product.identifier.startsWith(productId + ":")
    ) ?? null;

  const premiumAnnualPackage = findPackage("trace_premium_annual");
  const premiumMonthlyPackage = findPackage("trace_premium_monthly");
  const businessAnnualPackage = findPackage("trace_business_annual");
  const businessMonthlyPackage = findPackage("trace_business_monthly");

  const purchase = useCallback(
    async (pkg: PurchasesPackage, context: PurchaseContext = {}) => {
      const productId = pkg.product.identifier;
      // Infer tier/billing from product id if the caller didn't pass them
      // (e.g. "trace_premium_monthly" → tier=premium, billing=monthly).
      const inferredTier: "premium" | "business" | undefined = productId.includes(
        "business"
      )
        ? "business"
        : productId.includes("premium")
        ? "premium"
        : undefined;
      const inferredBilling: "monthly" | "annual" | undefined = productId.includes(
        "annual"
      )
        ? "annual"
        : productId.includes("monthly")
        ? "monthly"
        : undefined;
      const baseProps = {
        tier: context.tier ?? inferredTier ?? null,
        billing: context.billing ?? inferredBilling ?? null,
        product_id: productId,
      };

      setPurchasing(true);
      setError(null);
      try {
        const info = await purchasePackage(pkg);

        // Detect whether this purchase activated a free trial. RC marks the
        // active entitlement's periodType as "TRIAL" while the trial is in
        // effect; we use that to fire `trial_started` in addition to
        // `purchase_completed`.
        const tierKey = baseProps.tier as "premium" | "business" | null;
        const activeEntitlement = tierKey
          ? info.entitlements.active[tierKey]
          : undefined;
        const isTrial = activeEntitlement?.periodType === "TRIAL";

        logEvent("purchase_completed", {
          ...baseProps,
          price: pkg.product.price ?? null,
          currency: pkg.product.currencyCode ?? null,
          is_trial: isTrial,
        });

        if (isTrial) {
          logEvent("trial_started", {
            ...baseProps,
            price: pkg.product.price ?? null,
            currency: pkg.product.currencyCode ?? null,
          });
        }

        return info;
      } catch (err: any) {
        if (err.userCancelled) {
          logEvent("purchase_canceled", baseProps);
          return null;
        }
        logEvent("purchase_failed", {
          ...baseProps,
          error_code: err?.code ?? null,
          error_message: err?.message ?? null,
        });
        setError(err.message || "Purchase failed");
        return null;
      } finally {
        setPurchasing(false);
      }
    },
    []
  );

  const restore = useCallback(async () => {
    setPurchasing(true);
    setError(null);
    try {
      const info = await restorePurchases();
      const hasPremium = hasEntitlement(info, "premium");
      const hasBusiness = hasEntitlement(info, "business");
      if (!hasPremium && !hasBusiness) {
        setError("No active subscription found");
        return null;
      }
      return info;
    } catch (err: any) {
      setError(err.message || "Restore failed");
      return null;
    } finally {
      setPurchasing(false);
    }
  }, []);

  return {
    offerings,
    premiumAnnualPackage,
    premiumMonthlyPackage,
    businessAnnualPackage,
    businessMonthlyPackage,
    trialEligible,
    loading,
    purchasing,
    error,
    purchase,
    restore,
  };
}
