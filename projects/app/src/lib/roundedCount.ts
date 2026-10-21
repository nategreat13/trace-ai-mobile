/**
 * "100+", "90+", "40+" — a count rounded down to a round number, so the
 * button isn't a suspiciously exact "111" (Trevor, Oct 21). Tens under 100,
 * fifties from 100. Small counts stay exact.
 */
export function roundedCount(n: number): string {
  if (n < 20) return String(n);
  const step = n >= 100 ? 50 : 10;
  return `${Math.floor(n / step) * step}+`;
}
