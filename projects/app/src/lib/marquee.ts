/**
 * Destinations that carry instant recognition, in rough order of pull.
 *
 * Used wherever we're choosing which deals to *show off* rather than which
 * are objectively best: the onboarding demo deck, and the unlocked sample on
 * the gated feed. A 70%-off fare to a regional airport is a better deal but
 * a worse advert, because the viewer has to work out whether they care about
 * the place before they can care about the price.
 *
 * Matching is a substring test on the lowercased destination so "Tokyo (HND)"
 * and "Rome, Italy" both land. Anything not listed ranks last, tied.
 */
export const MARQUEE = [
  "paris", "tokyo", "rome", "london", "barcelona", "lisbon", "honolulu",
  "maui", "hawaii", "cancun", "cancún", "new york", "los angeles", "miami",
  "san francisco", "seattle", "chicago", "san diego", "boston", "las vegas",
  "denver", "athens", "amsterdam", "dublin", "reykjavik", "reykjavík",
  "mexico city", "san juan", "madrid", "milan", "venice", "sydney", "seoul",
  "bangkok", "bali", "dubai", "istanbul", "lima", "rio de janeiro", "cape town",
] as const;

export function marqueeRank(destination: string): number {
  const d = (destination || "").toLowerCase();
  const i = MARQUEE.findIndex((m) => d.includes(m));
  return i === -1 ? MARQUEE.length : i;
}
