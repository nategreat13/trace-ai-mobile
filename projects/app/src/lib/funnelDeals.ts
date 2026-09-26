import { lookupKey, coordsForDestination } from "./destinationCoords";
import { distanceMiles } from "./airportGeo";
import { SHOWCASE_DEALS, toDeal } from "./showcaseDeals";
import { rankDeals, type RankPrefs } from "./dealRanker";
import type { Deal } from "@trace/shared";

/**
 * The deals the funnel advertises with, before a subscription exists.
 *
 * Every pre-purchase surface — the landing deck, the cadence alerts, the demo
 * deck, the demo map, the gated feed — goes through here, and that is the
 * whole point. Each of those screens used to source its own numbers, so the
 * same city carried three prices inside ninety seconds: a showcase Reykjavík
 * at $422 on one screen and the live $802 two screens later.
 *
 * Two decisions make that impossible now:
 *
 *   1. **Prices are fabricated and deliberately low.** This is a product
 *      decision, taken knowingly: the funnel advertises with prices chosen to
 *      be attractive rather than with whatever the scraper last returned.
 *   2. **A price is a pure function of the destination name.** Not of the
 *      airport, not of the screen, not of when it's asked. `funnelPrice`
 *      hashes the name and reads a band, so Lisbon is the same number on the
 *      landing deck and in the gated feed, on this launch and the next.
 *
 * What still comes from the user's own airport is *which* destinations show
 * up: the source list is the live API response for their origin, so the
 * places are real, relevant and carry real photos and coordinates. Only the
 * numbers are ours. When that response hasn't landed (pre-signup, or a dead
 * API) the showcase set stands in, priced by the same function.
 *
 * The boundary is the subscription. Everything a paying user sees —
 * SwipeDeck, Explore, the real feed — is untouched live data.
 */

/** Cheap enough to stop a thumb, per band. */
interface Band {
  min: number;
  max: number;
}

const BAND_DOMESTIC_NEAR: Band = { min: 29, max: 89 };
const BAND_DOMESTIC_FAR: Band = { min: 59, max: 149 };
const BAND_SHORT_HAUL: Band = { min: 109, max: 219 };
const BAND_LONG_HAUL: Band = { min: 219, max: 389 };

/** Discount shown against the invented "was", in percent. */
const DISCOUNT_MIN = 45;
const DISCOUNT_SPAN = 28;

/**
 * Roughly the population centre of the continental US. Bands are measured
 * from here rather than from the user's airport on purpose — a price that
 * moved with the origin would put Lisbon at one number on the landing screen
 * (no airport known yet) and another after onboarding, which is the exact
 * inconsistency this module exists to remove.
 */
const US_CENTER = { lat: 39.5, lng: -98.35 };

/** Stable 32-bit string hash. Same name in, same number out, forever. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function bandFor(deal: Deal): Band {
  const international = /international/i.test(
    deal.domestic_or_international || "",
  );
  const coord = coordsForDestination(deal.destination);
  const miles = coord
    ? distanceMiles(US_CENTER, coord)
    : international
      ? 4000
      : 1000;
  if (!international) {
    // Hawaii and Alaska are domestic and nothing like a Denver hop.
    return miles > 2200 ? BAND_DOMESTIC_FAR : BAND_DOMESTIC_NEAR;
  }
  // Mexico, Central America and the Caribbean against everything further.
  return miles < 2600 ? BAND_SHORT_HAUL : BAND_LONG_HAUL;
}

export interface FunnelPrice {
  price: number;
  was: number;
  discount: number;
}

/**
 * The advertised price for a destination. Deterministic: depends only on the
 * destination name and which band it falls in.
 */
export function funnelPrice(deal: Deal): FunnelPrice {
  const h = hash(lookupKey(deal.destination || ""));
  const band = bandFor(deal);
  const span = band.max - band.min + 1;
  // Round to a price that reads like a fare rather than a hash.
  const raw = band.min + (h % span);
  const price = raw < 100 ? raw : Math.round(raw / 5) * 5;
  const discount = DISCOUNT_MIN + ((h >>> 9) % DISCOUNT_SPAN);
  const was = Math.round(price / (1 - discount / 100));
  return { price, was, discount };
}

/** Apply the advertised price to a deal, leaving everything else alone. */
export function repriceDeal(deal: Deal): Deal {
  const { price, was, discount } = funnelPrice(deal);
  return {
    ...deal,
    price,
    original_price: was,
    discount_pct: discount,
  } as Deal;
}

/** Below this many usable live deals we fall back to the showcase set. */
const MIN_SOURCE = 6;

/**
 * The funnel's deal list for this user: their airport's destinations, our
 * prices, ordered against their onboarding answers.
 *
 * Call this from every pre-purchase surface with the same `deals` and
 * `prefs` and they will agree with one another exactly.
 */
export function funnelDeals(
  deals: Deal[] | undefined,
  prefs: RankPrefs = {},
  limit?: number,
): Deal[] {
  const usable = (deals ?? []).filter(
    (d) => d.destination && d.image_url && coordsForDestination(d.destination),
  );

  // One card per destination — the API returns a row per month, and three
  // Denvers at three prices is the inconsistency in miniature.
  const byDestination = new Map<string, Deal>();
  for (const d of usable) {
    const key = lookupKey(d.destination as string);
    if (!byDestination.has(key)) byDestination.set(key, d);
  }

  const source =
    byDestination.size >= MIN_SOURCE
      ? [...byDestination.values()]
      : SHOWCASE_DEALS.map((d) => toDeal(d));

  const ranked = rankDeals(source.map(repriceDeal), prefs);
  return limit ? ranked.slice(0, limit) : ranked;
}
