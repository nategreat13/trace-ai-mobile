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
