/**
 * Every analytics event name. Shared by the browser (analytics.ts) and the
 * /api/events route, which only stores names on this list.
 */
export const EVENT_NAMES = [
  "page_view",
  "step_view",
  "landing_view",
  "programs_selected",
  "balances_entered",
  "airport_selected",
  "out_of_region_email",
  "travelers_set",
  "picks_set",
  "email_captured",
  "results_view",
  "swipe_save",
  "swipe_skip",
  "locked_row_tap",
  "paywall_view",
  "plan_selected",
  "trial_started",
  "detail_free_view",
  "book_request",
  "card_offer_click",
  "watch_added",
  "plan_search",
  "trip_request",
  "bonus_banner_tap",
  "cash_deal_click",
  "contact_sent",
  "gift_shown",
  "gift_claimed",
  "gift_declined",
  "funnel_complete",
] as const;

export type PointsEvent = (typeof EVENT_NAMES)[number];

export const isPointsEvent = (v: unknown): v is PointsEvent => typeof v === "string" && (EVENT_NAMES as readonly string[]).includes(v);
