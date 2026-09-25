import type { Deal } from "@trace/shared";

/**
 * The canonical set of deals Trace shows off with.
 *
 * One source of truth for every pre-trial surface: the landing deck, the
 * alert stream, and the swipe demo. Before this existed each of those had
 * its own hardcoded list, so Tokyo was $649 on the landing screen, $539 in
 * the alert stream and $539 again on the feed — three prices for one city
 * inside ninety seconds. A user can't articulate why that feels untrustworthy,
 * but they feel it.
 *
 * These are ILLUSTRATIVE fares, not bookable ones. They exist to match what
 * the ads promise, so someone arriving from "cheap flights to Rome" sees Rome
 * at a price that looks like the ad. **Keep this list and the ad creative in
 * sync** — if the ads change cities, change them here.
 *
 * Discounts deliberately vary between 54% and 63%. The old landing set was
 * every entry at exactly 53% off, which is the kind of detail that reads as
 * generated even when nobody can say why.
 */
export interface ShowcaseDeal {
  destination: string;
  code: string;
  price: number;
  was: number;
  image: string;
  /** Domestic deals anchor the feed; international deals sell the dream. */
  international: boolean;
}

export const SHOWCASE_DEALS: ShowcaseDeal[] = [
  {
    destination: "Rome",
    code: "FCO",
    price: 389,
    was: 940,
    international: true,
    image: "https://images.pexels.com/photos/532263/pexels-photo-532263.jpeg",
  },
  {
    destination: "Tokyo",
    code: "HND",
    price: 539,
    was: 1180,
    international: true,
    image: "https://images.pexels.com/photos/2506923/pexels-photo-2506923.jpeg",
  },
  {
    destination: "Lisbon",
    code: "LIS",
    price: 312,
    was: 780,
    international: true,
    image: "https://images.pexels.com/photos/1534560/pexels-photo-1534560.jpeg",
  },
  {
    destination: "Paris",
    code: "CDG",
    price: 362,
    was: 870,
    international: true,
    image: "https://images.pexels.com/photos/338515/pexels-photo-338515.jpeg",
  },
  {
    destination: "Cancún",
    code: "CUN",
    price: 189,
    was: 512,
    international: true,
    image: "https://images.pexels.com/photos/3873193/pexels-photo-3873193.jpeg",
  },
  {
    destination: "Barcelona",
    code: "BCN",
    price: 341,
    was: 810,
    international: true,
    image: "https://images.pexels.com/photos/1388030/pexels-photo-1388030.jpeg",
  },
  {
    destination: "Honolulu",
    code: "HNL",
    price: 297,
    was: 690,
    international: false,
    image: "https://images.pexels.com/photos/7242815/pexels-photo-7242815.jpeg",
  },
  {
    destination: "Mexico City",
    code: "MEX",
    price: 178,
    was: 430,
    international: true,
    image: "https://images.pexels.com/photos/2412603/pexels-photo-2412603.jpeg",
  },
];

export function showcaseDiscount(d: ShowcaseDeal): number {
  return Math.round(((d.was - d.price) / d.was) * 100);
}

/** Shape a showcase entry as a full `Deal` for components that expect one. */
export function toDeal(d: ShowcaseDeal, origin = ""): Deal {
  return {
    id: `showcase-${d.code.toLowerCase()}`,
    destination: d.destination,
    destination_code: d.code,
    origin,
    price: d.price,
    original_price: d.was,
    discount_pct: showcaseDiscount(d),
    image_url: d.image,
    domestic_or_international: d.international ? "International" : "Domestic",
  } as unknown as Deal;
}
