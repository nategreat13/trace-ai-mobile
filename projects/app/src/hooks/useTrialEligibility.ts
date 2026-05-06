import { useState, useEffect } from "react";
import Purchases, { INTRO_ELIGIBILITY_STATUS } from "react-native-purchases";

/**
 * Cross-app trial-eligibility hook. Reads RevenueCat's
 * checkTrialOrIntroductoryPriceEligibility once per process and caches
 * the result so multiple screens calling this don't multiply RC traffic.
 *
 * Returns:
 *   - true   : user is eligible for the 3-day free trial
 *   - false  : user has already used a trial (RC says ineligible)
 *   - null   : still loading on first call
 *
 * UI guidance: while null, default to *not* showing trial copy — promising
 * a trial we can't deliver is worse than missing the offer for a moment.
 */

const PRODUCT_IDS = [
  "trace_premium_annual",
  "trace_premium_monthly",
  "trace_business_annual",
  "trace_business_monthly",
];

let cached: boolean | null = null;
let inflight: Promise<boolean> | null = null;
const subscribers = new Set<(value: boolean) => void>();

async function fetchEligibility(): Promise<boolean> {
  if (cached !== null) return cached;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const eligibility = await Purchases.checkTrialOrIntroductoryPriceEligibility(
        PRODUCT_IDS
      );
      const eligible = Object.values(eligibility).some(
        (e) =>
          e.status === INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE
      );
      cached = eligible;
      subscribers.forEach((cb) => cb(eligible));
      return eligible;
    } catch (err) {
      // RC not yet initialized, network error, etc. Treat as ineligible
      // (false) rather than guessing — keeps copy honest.
      cached = false;
      subscribers.forEach((cb) => cb(false));
      return false;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/**
 * Force a re-fetch — call this after a purchase completes so subsequent
 * screens reflect the user's now-ineligible state.
 */
export function invalidateTrialEligibility() {
  cached = null;
  inflight = null;
}

export function useTrialEligibility(): boolean | null {
  const [state, setState] = useState<boolean | null>(cached);

  useEffect(() => {
    if (cached !== null) {
      setState(cached);
      return;
    }
    let cancelled = false;
    const onResolved = (value: boolean) => {
      if (!cancelled) setState(value);
    };
    subscribers.add(onResolved);
    fetchEligibility().catch(() => {
      /* handled inside */
    });
    return () => {
      cancelled = true;
      subscribers.delete(onResolved);
    };
  }, []);

  return state;
}
