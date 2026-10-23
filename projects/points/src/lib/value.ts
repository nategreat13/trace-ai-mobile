import type { TripResult } from "@/engine/types";

/**
 * Cents of value per point: the cash fare you'd otherwise pay, minus the taxes
 * you still pay on an award, divided by the points used. Cashing points out
 * is worth roughly 1¢ (0.5–1¢ depending on the bank), which is the comparison
 * that makes this number land.
 */
export function centsPerPoint(r: TripResult): number {
  if (!r.need) return 0;
  return Math.max(0, ((r.cashTotal - r.taxesTotal) / r.need) * 100);
}

/** Display: one decimal under 10¢, whole cents above. */
export const cppLabel = (c: number) => `${c >= 10 ? Math.round(c) : c.toFixed(1)}¢`;

/** Gold for great redemptions, green for good, muted for ordinary. */
export function cppTone(c: number): { bg: string; text: string } {
  if (c >= 5) return { bg: "linear-gradient(90deg,#F5B83D,#FD297B)", text: "#FFFFFF" };
  if (c >= 2) return { bg: "linear-gradient(90deg,#00D665,#14B8A6)", text: "#FFFFFF" };
  return { bg: "var(--color-soft)", text: "var(--color-muted)" };
}
