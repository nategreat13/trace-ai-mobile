import type { TripResult } from "@/engine/types";
import type { Destination } from "@/lib/destinations";
import { groupDestinations } from "@/lib/destinations";

export type FilterId = "all" | "book" | "near" | "econ" | "biz" | "beach" | "city" | "intl";
export type SortId = "best" | "pts" | "gap";

/** Filters apply to each option; a destination shows if any of its options match. */
export const FILTERS: { id: FilterId; label: string; test: (r: TripResult) => boolean }[] = [
  { id: "all", label: "All", test: () => true },
  { id: "book", label: "Can book", test: (r) => r.ok },
  { id: "near", label: "Almost there", test: (r) => !r.ok },
  { id: "econ", label: "Economy", test: (r) => !r.isBusiness },
  { id: "biz", label: "Business", test: (r) => r.isBusiness },
  { id: "beach", label: "Beaches", test: (r) => r.trip.kind === "beach" },
  { id: "city", label: "Cities", test: (r) => r.trip.kind === "city" },
  { id: "intl", label: "International", test: (r) => r.trip.international },
];

export const SORTS: { id: SortId; label: string }[] = [
  { id: "best", label: "Picked for you" },
  { id: "pts", label: "Fewest points" },
  { id: "gap", label: "Closest to booking" },
];

export function filterDestinations(trips: TripResult[], filter: FilterId): Destination[] {
  const test = FILTERS.find((f) => f.id === filter)!.test;
  return groupDestinations(trips.filter(test));
}

/** Picked cities stay pinned to the top whatever the sort. */
export function sortDestinations(list: Destination[], sort: SortId, picks: string[]): Destination[] {
  const pinned = (d: Destination) => (picks.includes(d.city) ? 0 : 1);
  const minNeed = (d: Destination) => Math.min(...d.options.map((o) => o.need));
  return [...list].sort((a, b) => {
    const p = pinned(a) - pinned(b);
    if (p) return p;
    if (sort === "pts") return minNeed(a) - minNeed(b);
    if (sort === "gap") return a.gap - b.gap || minNeed(a) - minNeed(b);
    return a.ok && b.ok ? b.value - a.value : a.gap - b.gap;
  });
}
