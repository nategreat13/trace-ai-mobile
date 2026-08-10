import { useState, useEffect, useCallback } from "react";
import { Platform } from "react-native";
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
  /** Which paywall surface this purchase started from (see PaywallScreen). */
  entryPoint?: string | null;
}

interface UseIAPResult {
  offerings: PurchasesOfferings | null;
  premiumAnnualPackage: PurchasesPackage | null;
  premiumMonthlyPackage: PurchasesPackage | null;
  businessAnnualPackage: PurchasesPackage | null;
  businessMonthlyPackage: PurchasesPackage | null;
  /**
   * True when the user is intro-eligible for *at least one* product. Kept for
   * coarse callers (e.g. "should we mention trials at all"), but do NOT use it
   * to decide whether to advertise a trial on a specific product — use
   * `isTrialEligibleFor(productId)` instead. See the note on the eligibility
   * effect below for why the difference matters.
   */
  trialEligible: boolean;
  /**
   * Per-product intro eligibility. This is the correct gate for trial copy on
   * a paywall, because App Store intro offers are scoped to a subscription
   * group — a user can be ineligible for Premium while still eligible for
   * Business. Unknown products return false (fail closed).
   */
  isTrialEligibleFor: (productId: string | null | undefined) => boolean;
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
  // Start NOT eligible. The real eligibility check resolves asynchronously
  // after offerings load; defaulting to `true` made `hasFreeTrial` briefly
  // true once offerings arrived (introPrice present) but BEFORE eligibility
  // came back — firing a false-positive `trial_offer_shown` (and a flash of
  // trial copy) for users who turn out ineligible. Starting false means the
  // trial only ever surfaces after eligibility is confirmed.
  //
  // Keyed by product identifier rather than a single boolean: intro offers are
  // scoped to an App Store subscription group, so eligibility genuinely
  // differs per product. Empty map = nothing eligible yet.
  const [trialEligibility, setTrialEligibility] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const off = await getOfferings();
        if (!cancelled) setOfferings(off);

        // Determine trial eligibility. This is platform-specific:
        //
        //  • iOS: checkTrialOrIntroductoryPriceEligibility returns a real
        //    per-product status. We only treat ELIGIBLE as eligible —
        //    INELIGIBLE (already used the trial) and UNKNOWN both hide the
        //    trial, per RevenueCat's guidance, so we never mislead a user
        //    whose status we can't confirm.
        //
        //  • Android: the same API *always* returns UNKNOWN (documented RC
        //    behavior), so the iOS rule above would hide the trial from every
        //    Android user even when a Play Console trial exists. Google Play
        //    enforces real per-user eligibility at purchase time, so we treat
        //    Android as eligible here and let the paywall's introPrice gate
        //    (product actually carries a free offer) decide whether a trial
        //    is shown.
        //
        // Results are kept PER PRODUCT. They used to be collapsed with
        // `.some()` into one boolean, which quietly meant "eligible for
        // anything" was treated as "eligible for everything". Intro offers are
        // scoped to an App Store subscription group, so a user who burned their
        // trial on Premium is ineligible there while still eligible for
        // Business — and the collapsed flag would let the Premium paywall
        // advertise a free trial that the payment sheet then refuses to honor.
        // The user sees "Start 7-day free trial", taps, and Apple asks for
        // $9.99 today. That mismatch is a well-known cause of purchase
        // abandonment, and it gets more likely as more trials expire.
        try {
          if (Platform.OS === "android") {
            // Play enforces eligibility at purchase; assume eligible for all.
            const all: Record<string, boolean> = {};
            for (const id of PRODUCT_IDS) all[id] = true;
            if (!cancelled) setTrialEligibility(all);
          } else {
            const eligibility =
              await Purchases.checkTrialOrIntroductoryPriceEligibility([
                ...PRODUCT_IDS,
              ]);
            const map: Record<string, boolean> = {};
            for (const id of PRODUCT_IDS) {
              map[id] =
                eligibility[id]?.status ===
                INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE;
            }
            if (!cancelled) setTrialEligibility(map);
          }
        } catch {
          // If we can't confirm eligibility, default to NOT eligible so the
          // paywall never advertises a free trial the store won't actually
          // grant (a mismatch at the App Store sheet is a top cause of
          // purchase abandonment). The paywall additionally gates the trial
          // CTA on the selected product carrying a real free intro offer.
          if (!cancelled) setTrialEligibility({});
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
      // entry_point rides along on every outcome event (completed / failed /
      // canceled / trial_started), not just the initiation. Attributing where a
      // purchase *started* but not where it *finished* leaves the only question
      // that matters — which surface actually earns money — unanswerable.
      const baseProps = {
        tier: context.tier ?? inferredTier ?? null,
        billing: context.billing ?? inferredBilling ?? null,
        product_id: productId,
        entry_point: context.entryPoint ?? null,
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

  // Fail closed on unknown/missing ids: an id we have no answer for must not
  // be advertised as trial-eligible.
  const isTrialEligibleFor = useCallback(
    (productId: string | null | undefined) =>
      !!productId && trialEligibility[productId] === true,
    [trialEligibility]
  );
  const trialEligible = Object.values(trialEligibility).some(Boolean);

  return {
    offerings,
    premiumAnnualPackage,
    premiumMonthlyPackage,
    businessAnnualPackage,
    businessMonthlyPackage,
    trialEligible,
    isTrialEligibleFor,
    loading,
    purchasing,
    error,
    purchase,
    restore,
  };
}
