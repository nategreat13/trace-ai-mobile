import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { Platform } from "react-native";
import Purchases, { INTRO_ELIGIBILITY_STATUS } from "react-native-purchases";
import { getOfferings } from "../services/iap";
import {
  formatTrialLength,
  formatTrialDuration,
  packageHasFreeTrial,
  trialsEnabledByRemote,
} from "../lib/trial";
import { useAuth } from "./AuthContext";

/**
 * App-wide "can this user start a free trial right now?" signal.
 *
 * Fetches the current offering once (RevenueCat caches it) and resolves
 * trial availability the same way the paywall does, so any upgrade CTA in
 * the app can advertise "Start free trial" / "Try free" in lockstep with
 * what the paywall will actually grant. Defaults to `false` until resolved
 * so copy never flashes a trial that then disappears.
 *
 * Trial availability is resolved PER TIER, because the stores can carry a
 * free trial on Premium, Business, both, or neither:
 *   - the top-level fields (`available`/`label`/`labelLong`) mirror the
 *     PREMIUM tier — the default upgrade path used by the generic upgrade
 *     CTAs (swipe limit, explore, profile, etc.), and
 *   - `business` carries the Business tier's trial for the Business upsell.
 *
 * A tier is `available` only when the user is signed in and not already
 * premium, the current offering has a *free* intro offer on that tier, AND
 * RevenueCat reports the user intro-eligible (iOS). On Android the eligibility
 * API always returns UNKNOWN, so we defer to the offer's presence and let
 * Google Play enforce eligibility at purchase.
 */
interface TierTrial {
  available: boolean;
  /** Adjective label like "7-day", for "Start 7-day free trial". */
  label: string;
  /** Noun label like "7 days", for "Try free for 7 days". */
  labelLong: string;
}

interface TrialState extends TierTrial {
  /** Business-tier trial (for the Business upsell surfaces). */
  business: TierTrial;
}

const EMPTY_TIER: TierTrial = { available: false, label: "", labelLong: "" };
const EMPTY_STATE: TrialState = { ...EMPTY_TIER, business: EMPTY_TIER };

const PRODUCT_IDS = [
  "trace_premium_annual",
  "trace_premium_monthly",
  "trace_business_annual",
  "trace_business_monthly",
];

const TrialContext = createContext<TrialState>(EMPTY_STATE);

export function TrialProvider({ children }: { children: React.ReactNode }) {
  const { user, isPremium } = useAuth();
  const [state, setState] = useState<TrialState>(EMPTY_STATE);

  useEffect(() => {
    let cancelled = false;

    // Premium users and signed-out users can't start a trial.
    if (!user || isPremium) {
      setState(EMPTY_STATE);
      return;
    }

    (async () => {
      try {
        const offerings = await getOfferings();

        // Remote kill-switch: trials can be turned off instantly from the
        // RevenueCat dashboard (no release) via offering metadata.
        if (!trialsEnabledByRemote(offerings?.current)) {
          if (!cancelled) setState(EMPTY_STATE);
          return;
        }

        const packages = offerings?.current?.availablePackages ?? [];

        // Eligibility — platform-aware, mirroring useIAP. Global across
        // products; the store enforces real per-product eligibility at
        // purchase.
        let eligible = true;
        if (Platform.OS !== "android") {
          try {
            const eligibility =
              await Purchases.checkTrialOrIntroductoryPriceEligibility([
                ...PRODUCT_IDS,
              ]);
            eligible = Object.values(eligibility).some(
              (e) =>
                e.status ===
                INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE
            );
          } catch {
            eligible = false;
          }
        }

        const buildTier = (idFragment: string): TierTrial => {
          const pkg = packages.find(
            (p) =>
              p.product.identifier.includes(idFragment) && packageHasFreeTrial(p)
          );
          const intro = pkg?.product.introPrice;
          if (!eligible || !intro) return EMPTY_TIER;
          return {
            available: true,
            label: formatTrialLength(intro),
            labelLong: formatTrialDuration(intro),
          };
        };

        const premium = buildTier("premium");
        const business = buildTier("business");

        if (!cancelled) setState({ ...premium, business });
      } catch {
        // Any failure → no trial advertised. The paywall remains the source
        // of truth and degrades to "Subscribe" on its own.
        if (!cancelled) setState(EMPTY_STATE);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, isPremium]);

  return (
    <TrialContext.Provider value={state}>{children}</TrialContext.Provider>
  );
}

/** Read the app-wide free-trial availability signal (top-level = Premium). */
export function useFreeTrial(): TrialState {
  return useContext(TrialContext);
}
