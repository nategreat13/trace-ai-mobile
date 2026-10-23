/**
 * Funnel analytics. No backend yet, so events go to the console and to
 * `window.dataLayer`; wiring a real sink (and Meta Pixel + CAPI) later only
 * touches this file.
 */
export type PointsEvent =
  | "landing_view"
  | "programs_selected"
  | "balances_entered"
  | "airport_selected"
  | "out_of_region_email"
  | "travelers_set"
  | "picks_set"
  | "email_captured"
  | "results_view"
  | "swipe_save"
  | "swipe_skip"
  | "locked_row_tap"
  | "paywall_view"
  | "plan_selected"
  | "trial_started"
  | "detail_free_view"
  | "book_request"
  | "card_offer_click"
  | "watch_added"
  | "plan_search"
  | "trip_request"
  | "bonus_banner_tap"
  | "cash_deal_click"
  | "contact_sent";

/** Meta standard events the brief maps onto our funnel. */
const META: Partial<Record<PointsEvent, string>> = {
  email_captured: "CompleteRegistration",
  paywall_view: "InitiateCheckout",
  trial_started: "StartTrial",
};

type Props = Record<string, string | number | boolean | undefined>;

export function track(event: PointsEvent, props: Props = {}): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as { dataLayer?: unknown[]; fbq?: (...a: unknown[]) => void };
  (w.dataLayer ??= []).push({ event, ...props, at: Date.now() });
  const meta = META[event];
  if (meta && w.fbq) w.fbq("track", meta, props);
  if (process.env.NODE_ENV !== "production") console.debug("[track]", event, props);
}
