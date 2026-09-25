import type { Deal } from "@trace/shared";

/**
 * The deals Trace shows off with, before a user has picked an airport.
 *
 * One source of truth for every pre-airport surface: the landing deck and the
 * swipe demo's fallback. Before this existed each surface had its own
 * hardcoded list, so Tokyo was $649 on the landing screen, $539 in the alert
 * stream and $539 again on the feed — three prices for one city inside ninety
 * seconds.
 *
 * **Every entry below is real.** Each price is the genuine cross-airport low
 * pulled from the live deals API on 25 Sep 2026, and each image is the one the
 * feed itself serves for that destination, so a card here looks identical to
 * the same card later in the app.
 *
 * That matters more than it sounds. The previous version of this file promised
 * Rome $389, Tokyo $539 and Lisbon $312 — none of which Trace can deliver. The
 * real cross-airport lows are $483, $683 and $563, and the medians are around
 * $750–950. Someone who signs up for a $389 Rome meets a $755 Rome on the feed
 * about four minutes later, which is the exact moment trial-to-paid is decided.
 *
 * The honest numbers also turned out to be the better advertisement:
 * Reykjavík at 64% off saves $750 against Rome's fictional $551, and no
 * invented European fare competes with a real $38 flight to Orlando.
 *
 * `airports` records how many of the 23 serviced origins carried that
 * destination when this was measured — a rough guide to how often a given
 * card will feel true to the person looking at it. Re-measure with
 * scripts/ against the deals API if these start to drift.
 */
export interface ShowcaseDeal {
  destination: string;
  code: string;
  price: number;
  was: number;
  image: string;
  international: boolean;
  /** Of the 23 serviced origins, how many offered this on 25 Sep 2026. */
  airports: number;
}

export const SHOWCASE_DEALS: ShowcaseDeal[] = [
  {
    // Biggest absolute saving in the set, and available everywhere.
    destination: "Reykjavík",
    code: "KEF",
    price: 422,
    was: 1172,
    international: true,
    airports: 23,
    image:
      "https://www.dripuploads.com/uploads/image_upload/image/2307502/embeddable_11c191e9-c2c2-4685-976d-aa18dfaffa03.png",
  },
  {
    // The number that stops a thumb mid-scroll.
    destination: "Orlando",
    code: "MCO",
    price: 38,
    was: 115,
    international: false,
    airports: 22,
    image:
      "https://upload.wikimedia.org/wikipedia/commons/f/fd/Lake_Eola_Park_in_Orlando_01.jpg",
  },
  {
    destination: "Honolulu",
    code: "HNL",
    price: 291,
    was: 434,
    international: false,
    airports: 23,
    image: "https://live.staticflickr.com/7530/16022395537_7565b7ab2c_b.jpg",
  },
  {
    destination: "Las Vegas",
    code: "LAS",
    price: 38,
    was: 88,
    international: false,
    airports: 21,
    image:
      "https://www.dripuploads.com/uploads/image_upload/image/2762693/embeddable_419766bb-7736-472a-87d6-9a1e02cb636a.png",
  },
  {
    destination: "Cancún",
    code: "CUN",
    price: 269,
    was: 364,
    international: true,
    airports: 8,
    image: "https://live.staticflickr.com/4591/38614407175_50a43d37ac_b.jpg",
  },
  {
    destination: "San Juan",
    code: "SJU",
    price: 113,
    was: 323,
    international: false,
    airports: 23,
    image: "https://live.staticflickr.com/8014/7121404691_4102d8f47c_b.jpg",
  },
  {
    destination: "Mexico City",
    code: "MEX",
    price: 223,
    was: 354,
    international: true,
    airports: 15,
    image:
      "https://www.dripuploads.com/uploads/image_upload/image/2884895/embeddable_9907fe52-404d-40a7-bd09-990830b237f5.png",
  },
  {
    destination: "Denver",
    code: "DEN",
    price: 66,
    was: 153,
    international: false,
    airports: 19,
    image: "https://live.staticflickr.com/65535/50493475858_101d26a3a3_b.jpg",
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
