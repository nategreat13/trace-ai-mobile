import type { Deal } from "@trace/shared";

/**
 * "Good deal" is a real fare at least this far under its usual price.
 *
 * The free tier and the first swipe session only ever show real prices, and
 * only good ones: a new user's first impression of Trace should be a fare
 * they'd actually book. At SLC on Oct 20, 2026, 29 of 107 destinations
 * cleared 40% and 8 cleared 50% — enough for a first session and a few days
 * of free swipes, without padding the deck with 12%-off routes.
 */
export const GOOD_DEAL_MIN_DISCOUNT = 40;

/** Below this many good deals, fill the deck from the next-best real fares. */
const MIN_DECK = 4;

function isRealDiscount(d: Deal): boolean {
  return (
    !!d.destination &&
    d.price > 0 &&
    d.original_price > d.price &&
    (d.discount_pct || 0) > 0
  );
}

/** One deal per destination — the biggest discount, then the lower price. */
function bestPerDestination(deals: Deal[]): Deal[] {
  const best = new Map<string, Deal>();
  for (const d of deals) {
    if (!isRealDiscount(d)) continue;
    const cur = best.get(d.destination);
    if (
      !cur ||
      (d.discount_pct || 0) > (cur.discount_pct || 0) ||
      ((d.discount_pct || 0) === (cur.discount_pct || 0) && d.price < cur.price)
    ) {
      best.set(d.destination, d);
    }
  }
  return [...best.values()];
}

const byBestDeal = (a: Deal, b: Deal) =>
  (b.discount_pct || 0) - (a.discount_pct || 0) || a.price - b.price;

/**
 * Every good deal from an airport's feed, best first, one per destination.
 * This is the count the feed page and the daily limit talk about ("29 great
 * deals from SLC today").
 */
export function goodDeals(deals: Deal[]): Deal[] {
  return bestPerDestination(deals)
    .filter((d) => (d.discount_pct || 0) >= GOOD_DEAL_MIN_DISCOUNT)
    .sort(byBestDeal);
}

/**
 * The first swipe session's deck: the best good deals, best first.
 *
 * A thin airport can have fewer good deals than the deck wants. Rather than
 * show three cards, it tops up from the next-best real discounts — still
 * real prices, still the best this airport has, just under the bar. Mixes in
 * an international fare early when there is one, because a far-away price is
 * what makes the feed feel bigger than the last search they ran.
 */
export function firstSessionDeck(deals: Deal[], size: number): Deal[] {
  const ranked = bestPerDestination(deals).sort(byBestDeal);
  const good = ranked.filter((d) => (d.discount_pct || 0) >= GOOD_DEAL_MIN_DISCOUNT);
  const pool = good.length >= MIN_DECK ? good : ranked;
  const deck = pool.slice(0, size);

  const isIntl = (d: Deal) =>
    !(d.domestic_or_international || "").toLowerCase().includes("domestic");
  if (!deck.slice(0, 4).some(isIntl)) {
    const intl = pool.find((d) => isIntl(d) && !deck.slice(0, 4).includes(d));
    if (intl) {
      const rest = deck.filter((d) => d !== intl);
      return [...rest.slice(0, 2), intl, ...rest.slice(2)].slice(0, size);
    }
  }
  return deck;
}
