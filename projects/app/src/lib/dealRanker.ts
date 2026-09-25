import { classifyDeal } from "./dealClassifier";
import { marqueeRank, MARQUEE } from "./marquee";
import type { Deal } from "@trace/shared";

/**
 * Scores a deal against what the user told us in onboarding.
 *
 * The reveal used to rank on recognisability and price alone, which meant a
 * user could pick "Adventure", "3+ months out" and "flights cost too much"
 * and be shown the same five cities as everyone else from their airport. We
 * ask six questions and then ignore the answers — the page says "what we're
 * matching you on" above a list that isn't matched on any of it.
 *
 * Weights are deliberately lopsided toward style. Travel style is the answer
 * people feel most strongly about, and it's the one where a miss is most
 * visible ("why are you showing me a beach when I said adventure?"). Timing
 * is a softer preference and the data behind it is coarse — one month per
 * deal — so it earns less. Recognisability stays in as a tiebreaker rather
 * than a driver: the sample still has to be an advert, but "Paris" shouldn't
 * beat a perfect style match in a city they'd also love.
 */
export interface RankPrefs {
  dealTypes?: string[];
  travelTimeframe?: string[];
  travelBarriers?: string[];
}

const W_STYLE = 60;
const W_TIMING = 22;
const W_PRICE = 26;
const W_FAME = 18;
/** Extra price weight for someone who told us cost is the blocker. */
const W_PRICE_SENSITIVE = 22;

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/** Months from now until a deal's travel month, 0–11. */
export function monthsAway(monthType: string | null | undefined, now = new Date()): number | null {
  if (!monthType) return null;
  const idx = MONTHS.indexOf(monthType.trim().toLowerCase());
  if (idx < 0) return null;
  return (idx - now.getMonth() + 12) % 12;
}

function timingMatches(away: number | null, timeframes: string[]): boolean {
  if (!timeframes.length || timeframes.includes("no_preference")) return true;
  if (away == null) return false;
  return timeframes.some((t) => {
    switch (t) {
      case "immediately":
        return away <= 1;
      case "next_few_weeks":
        return away <= 1;
      case "next_1_2_months":
        return away >= 1 && away <= 2;
      case "3_months_plus":
        return away >= 3;
      default:
        return false;
    }
  });
}

/**
 * Score one deal, 0..1-ish. `priceRange` is the min/max across the candidate
 * set so price is judged relative to what this airport actually offers — $300
 * is a bargain from SLC to Tokyo and unremarkable to Vegas.
 */
export function scoreDeal(
  deal: Deal,
  prefs: RankPrefs,
  priceRange: { min: number; max: number },
): number {
  const dealTypes = prefs.dealTypes ?? [];
  const timeframes = prefs.travelTimeframe ?? [];
  const barriers = prefs.travelBarriers ?? [];
  const priceSensitive = barriers.includes("prices_too_high");

  let score = 0;

  // ── Style ───────────────────────────────────────────────────────────────
  // "Surprise me" means they opted out of a style, so everything matches
  // equally rather than nothing matching.
  const wantsSurprise = dealTypes.includes("surprise") || dealTypes.length === 0;
  if (wantsSurprise) {
    score += W_STYLE * 0.5;
  } else {
    const types = classifyDeal(deal);
    const hits = dealTypes.filter((t) => types.includes(t)).length;
    if (hits > 0) {
      // First match is most of the value; extras add a little.
      score += W_STYLE * Math.min(1, 0.75 + (hits - 1) * 0.25);
    }
  }

  // ── Timing ──────────────────────────────────────────────────────────────
  const away = monthsAway((deal as { month_type?: string }).month_type);
  if (timingMatches(away, timeframes)) score += W_TIMING;

  // ── Price ───────────────────────────────────────────────────────────────
  const span = Math.max(1, priceRange.max - priceRange.min);
  const cheapness = 1 - Math.min(1, Math.max(0, (deal.price - priceRange.min) / span));
  const priceWeight = W_PRICE + (priceSensitive ? W_PRICE_SENSITIVE : 0);
  score += cheapness * priceWeight;

  // A genuinely steep discount is its own draw, and it's the number the card
  // shows in green. Capped so a 90%-off flight to nowhere can't win outright.
  const discount = Math.min(deal.discount_pct || 0, 70) / 70;
  score += discount * (priceSensitive ? 16 : 10);

  // ── Recognisability ─────────────────────────────────────────────────────
  const fame = marqueeRank(deal.destination);
  if (fame < MARQUEE.length) {
    score += W_FAME * (1 - fame / MARQUEE.length);
  }

  return score;
}

/** Sort a candidate list best-first for this user. */
export function rankDeals(deals: Deal[], prefs: RankPrefs): Deal[] {
  if (deals.length === 0) return [];
  const prices = deals.map((d) => d.price || 0).filter((p) => p > 0);
  const range = {
    min: prices.length ? Math.min(...prices) : 0,
    max: prices.length ? Math.max(...prices) : 1,
  };
  return [...deals]
    .map((d) => ({ d, s: scoreDeal(d, prefs, range) }))
    .sort((a, b) => b.s - a.s || (a.d.price || 0) - (b.d.price || 0))
    .map((x) => x.d);
}
