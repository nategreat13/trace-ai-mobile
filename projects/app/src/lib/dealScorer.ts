import type { Deal } from "@trace/shared";

/**
 * Trending score for a deal — higher is better.
 *
 * Combines four signals:
 *   1. Discount %      (40%) — biggest driver; 80%+ discount = full score
 *   2. Urgency         (25%) — "high" from the API means book-now pressure
 *   3. Departure timing(25%) — deals 1-3 months out score highest; 6+ months drops off
 *   4. Price trend     (10%) — rising price = act now; falling = can wait
 *
 * Returns a value roughly in [0, 1].
 */
export function trendingScore(deal: Deal): number {
  const discountScore = Math.min((deal.discount_pct || 0) / 80, 1); // capped at 80%

  const urgency = (deal.urgency || "").toLowerCase();
  const urgencyScore = urgency.includes("high") ? 1 : urgency.includes("med") ? 0.5 : 0.2;

  const timingScore = departureTiming(deal.travel_window || deal.dateString || "");

  const trend = (deal.price_trend || "").toLowerCase();
  const trendScore = trend.includes("ris") || trend.includes("up") ? 1
    : trend.includes("fall") || trend.includes("down") ? 0.3
    : 0.6; // stable

  return (
    discountScore * 0.40 +
    urgencyScore  * 0.25 +
    timingScore   * 0.25 +
    trendScore    * 0.10
  );
}

/**
 * Parses the travel_window string and returns a 0-1 score based on how
 * soon the departure is. Deals leaving in 1-3 months score highest.
 *
 * travel_window examples: "Jan 15-22", "March 2025", "Feb-Mar 2025",
 *                         "Jan", "Summer 2025"
 */
function departureTiming(travelWindow: string): number {
  const monthMap: Record<string, number> = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
    january: 1, february: 2, march: 3, april: 4, june: 6,
    july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
    spring: 4, summer: 7, fall: 10, autumn: 10, winter: 1,
  };

  const lower = travelWindow.toLowerCase();
  let departureMonth: number | null = null;
  let departureYear: number = new Date().getFullYear();

  // Extract year if present
  const yearMatch = lower.match(/20\d\d/);
  if (yearMatch) departureYear = parseInt(yearMatch[0]);

  // Find first month name
  for (const [name, month] of Object.entries(monthMap)) {
    if (lower.includes(name)) {
      departureMonth = month;
      break;
    }
  }

  if (!departureMonth) return 0.5; // unknown — neutral score

  const now = new Date();
  const departure = new Date(departureYear, departureMonth - 1, 1);
  // If parsed month already passed this year, assume next year
  if (departure < now && !yearMatch) {
    departure.setFullYear(now.getFullYear() + 1);
  }

  const monthsOut = (departure.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30);

  if (monthsOut < 0)  return 0.1; // already passed
  if (monthsOut <= 1) return 0.8; // very soon — exciting but tight
  if (monthsOut <= 3) return 1.0; // sweet spot
  if (monthsOut <= 5) return 0.8;
  if (monthsOut <= 8) return 0.5;
  return 0.3; // far out
}

/**
 * Weighted shuffle — higher-scored deals tend to appear earlier but
 * the order has randomness so it feels fresh each day.
 *
 * Each deal gets a sort key of `-(score * random)` where random is
 * seeded by deal id + today's date so the order is stable within a
 * day but changes tomorrow.
 */
export function weightedShuffle(deals: Deal[]): Deal[] {
  const today = new Date().toISOString().split("T")[0];

  return [...deals].sort((a, b) => {
    const keyA = trendingScore(a) * seededRandom(a.id + today);
    const keyB = trendingScore(b) * seededRandom(b.id + today);
    return keyB - keyA;
  });
}

/**
 * Simple deterministic pseudo-random from a string seed.
 * Returns a value in (0, 1).
 */
function seededRandom(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  return (Math.abs(hash) % 10000) / 10000 + 0.0001;
}
