import type { Region, TripResult } from "@/engine/types";

/** One city, with every way to fly there (economy, business). */
export interface Destination {
  city: string;
  code: string;
  region: Region;
  kind: TripResult["trip"]["kind"];
  international: boolean;
  /** Economy first, then premium cabins. */
  options: TripResult[];
  /** The option that decides the city's status: cheapest bookable, else closest. */
  lead: TripResult;
  ok: boolean;
  gap: number;
  /** Highest cash value among its options, for "best value" sorting. */
  value: number;
}

const leadOf = (opts: TripResult[]) =>
  opts.filter((o) => o.ok).sort((a, b) => b.cashTotal - a.cashTotal)[0] ??
  [...opts].sort((a, b) => a.gap - b.gap || a.need - b.need)[0];

/** Groups trips by city, keeping the order the cities first appear in. */
export function groupDestinations(trips: TripResult[]): Destination[] {
  const byCity = new Map<string, TripResult[]>();
  for (const t of trips) {
    const list = byCity.get(t.trip.city) ?? [];
    list.push(t);
    byCity.set(t.trip.city, list);
  }
  return [...byCity.values()].map((opts) => {
    const sorted = [...opts].sort((a, b) => Number(a.isBusiness) - Number(b.isBusiness) || a.need - b.need);
    const lead = leadOf(sorted);
    const first = sorted[0].trip;
    return {
      city: first.city,
      code: first.code,
      region: first.region,
      kind: first.kind,
      international: first.international,
      options: sorted,
      lead,
      ok: sorted.some((o) => o.ok),
      gap: Math.min(...sorted.map((o) => o.gap)),
      value: Math.max(...sorted.map((o) => o.cashTotal)),
    };
  });
}

/** Region tint, so a beach in Mexico doesn't look like a city in Europe. */
export const REGION_COLOR: Record<Region, string> = {
  USA: "#6366F1",
  Hawaii: "#14B8A6",
  Canada: "#0EA5E9",
  "Mexico & Caribbean": "#F97316",
  "Central & South America": "#16A34A",
  Europe: "#7C3AED",
  Asia: "#E11D48",
  Oceania: "#0891B2",
  "Middle East": "#D97706",
};

export interface Preferences {
  /** Cities picked in the funnel. */
  picks: string[];
  /** Cities the user has saved (hearts, swipes). */
  saved: string[];
}

const minNeed = (d: Destination) => Math.min(...d.options.filter((o) => o.ok).map((o) => o.need), Infinity);

/**
 * The default order. It opens with the most valuable trip they can book today
 * (the wow), then their picks, then everything else weighted toward the
 * regions and kinds of trip they've picked or saved. Trips they can book come
 * before trips they're short on; short picks lead the "almost there" group.
 */
export function rankDestinations(list: Destination[], prefs: Preferences): Destination[] {
  const liked = list.filter((d) => prefs.picks.includes(d.city) || prefs.saved.includes(d.city));
  const regionLikes = new Map<string, number>();
  const kindLikes = new Map<string, number>();
  for (const d of liked) {
    regionLikes.set(d.region, (regionLikes.get(d.region) ?? 0) + 1);
    kindLikes.set(d.kind, (kindLikes.get(d.kind) ?? 0) + 1);
  }
  // What they can book there today (the best cabin they can afford), not a
  // premium cabin they're still short on.
  const okValue = (d: Destination) => Math.max(0, ...d.options.filter((o) => o.ok).map((o) => o.cashTotal));
  // Value, nudged up for regions and kinds of trip they've shown interest in.
  const appeal = (d: Destination) =>
    (d.ok ? okValue(d) : d.value) * (1 + 0.5 * (regionLikes.get(d.region) ?? 0) + 0.3 * (kindLikes.get(d.kind) ?? 0));
  const isPick = (d: Destination) => prefs.picks.includes(d.city);
  // Picks keep the order they were chosen in.
  const pickOrder = (d: Destination) => (isPick(d) ? prefs.picks.indexOf(d.city) : 99);
  const isSaved = (d: Destination) => prefs.saved.includes(d.city);

  const ok = list.filter((d) => d.ok);
  const near = list.filter((d) => !d.ok);
  // Opens with the most impressive trip they can book right now (a lie-flat
  // to Europe beats a $160 domestic hop): it's the first thing an ad visitor
  // sees, and one of the free ones.
  const showpiece = [...ok].sort((a, b) => okValue(b) - okValue(a) || minNeed(a) - minNeed(b))[0];

  const restOk = ok
    .filter((d) => d !== showpiece)
    .sort(
      (a, b) =>
        pickOrder(a) - pickOrder(b) ||
        Number(isSaved(b)) - Number(isSaved(a)) ||
        appeal(b) - appeal(a),
    );
  const nearSorted = [...near].sort(
    (a, b) => pickOrder(a) - pickOrder(b) || Number(isSaved(b)) - Number(isSaved(a)) || a.gap - b.gap,
  );
  return [...(showpiece ? [showpiece] : []), ...restOk, ...nearSorted];
}
