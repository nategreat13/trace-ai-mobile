import type { TripResult } from "@/engine/types";

export type FilterId = "all" | "book" | "near" | "econ" | "biz" | "beach" | "city" | "intl";
export type SortId = "best" | "pts" | "gap";

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
  { id: "best", label: "Best value" },
  { id: "pts", label: "Fewest points" },
  { id: "gap", label: "Closest to booking" },
];

/** Picked cities stay pinned to the top whatever the sort. */
export function sortTrips(list: TripResult[], sort: SortId, picks: string[]): TripResult[] {
  const pinned = (r: TripResult) => (picks.includes(r.trip.city) ? 0 : 1);
  return [...list].sort((a, b) => {
    const p = pinned(a) - pinned(b);
    if (p) return p;
    if (sort === "pts") return a.need - b.need;
    if (sort === "gap") return a.gap - b.gap || a.need - b.need;
    return a.ok && b.ok ? b.cashTotal - a.cashTotal : a.gap - b.gap;
  });
}
