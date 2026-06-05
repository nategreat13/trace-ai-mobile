import type {
  PurchasesPackage,
  PurchasesOffering,
} from "react-native-purchases";

/**
 * Remote trial kill-switch via RevenueCat offering metadata. Set
 * `trials_enabled: false` on the current offering in the RevenueCat dashboard
 * to instantly stop advertising AND granting trials app-wide — no app release,
 * no App Store / Play change. Omitted or any non-false value = enabled.
 *
 * This complements the store offer (which is the natural on/off switch but can
 * lag on propagation): flipping this metadata value takes effect on the app's
 * next offerings fetch, and the paywall + every trial CTA respect it together.
 */
export function trialsEnabledByRemote(
  offering: PurchasesOffering | null | undefined
): boolean {
  return offering?.metadata?.["trials_enabled"] !== false;
}

/**
 * Render a store intro-offer period as a marketing string like "7-day" or
 * "1-month". Weeks are normalized to days so a P1W offer reads "7-day".
 * Driven by the actual product so advertised copy can never drift from what
 * the App Store / Play Store is configured to grant.
 */
export function formatTrialLength(intro: {
  periodUnit: string;
  periodNumberOfUnits: number;
}): string {
  const n = intro.periodNumberOfUnits;
  switch (intro.periodUnit) {
    case "DAY":
      return `${n}-day`;
    case "WEEK":
      return `${n * 7}-day`;
    case "MONTH":
      return `${n}-month`;
    case "YEAR":
      return `${n}-year`;
    default:
      return "free";
  }
}

/**
 * Render a store intro-offer period as a *noun phrase* like "7 days" or
 * "1 month" — for sentences like "Try free for 7 days". (Use formatTrialLength
 * for the adjective form, e.g. "Start 7-day free trial".)
 */
export function formatTrialDuration(intro: {
  periodUnit: string;
  periodNumberOfUnits: number;
}): string {
  const n = intro.periodNumberOfUnits;
  const plural = (unit: string) => `${n} ${n === 1 ? unit : unit + "s"}`;
  switch (intro.periodUnit) {
    case "DAY":
      return plural("day");
    case "WEEK": {
      const d = n * 7;
      return `${d} ${d === 1 ? "day" : "days"}`;
    }
    case "MONTH":
      return plural("month");
    case "YEAR":
      return plural("year");
    default:
      return "free";
  }
}

/**
 * A package offers a *free* trial when it carries a zero-price introductory
 * offer (vs. a paid intro price). This is the same gate the paywall uses to
 * decide whether to show trial copy — so advertising stays in lockstep with
 * what the store will actually grant.
 */
export function packageHasFreeTrial(pkg: PurchasesPackage): boolean {
  const intro = pkg.product.introPrice;
  return !!intro && intro.price === 0;
}
