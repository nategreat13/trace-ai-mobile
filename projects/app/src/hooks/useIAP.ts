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

interface UseIAPResult {
  offerings: PurchasesOfferings | null;
  premiumPackage: PurchasesPackage | null;
  businessPackage: PurchasesPackage | null;
  trialEligible: boolean;
  loading: boolean;
  purchasing: boolean;
  error: string | null;
  purchase: (pkg: PurchasesPackage) => Promise<CustomerInfo | null>;
  restore: () => Promise<CustomerInfo | null>;
}

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

        // Check trial eligibility for both products
        const products = [
          "trace_premium_annual",
          "trace_business_annual",
        ];
        try {
          const eligibility =
            await Purchases.checkTrialOrIntroductoryPriceEligibility(products);
          const eligible = Object.values(eligibility).some(
            (e) => e.status === INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE
          );
          if (!cancelled) setTrialEligible(eligible);
        } catch {
          // Default to eligible if check fails
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

  const premiumPackage =
    offerings?.current?.availablePackages.find(
      (p) => p.product.identifier === "trace_premium_annual"
    ) ?? null;

  const businessPackage =
    offerings?.current?.availablePackages.find(
      (p) => p.product.identifier === "trace_business_annual"
    ) ?? null;

  const purchase = useCallback(async (pkg: PurchasesPackage) => {
    setPurchasing(true);
    setError(null);
    try {
      const info = await purchasePackage(pkg);
      return info;
    } catch (err: any) {
      if (err.userCancelled) {
        // User cancelled — not an error
        return null;
      }
      setError(err.message || "Purchase failed");
      return null;
    } finally {
      setPurchasing(false);
    }
  }, []);

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
    premiumPackage,
    businessPackage,
    trialEligible,
    loading,
    purchasing,
    error,
    purchase,
    restore,
  };
}
