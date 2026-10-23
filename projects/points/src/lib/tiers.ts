import { PROGRAMS } from "@/engine/data";
import type { Balances, ProgramId } from "@/engine/types";

/**
 * Balance tiers: the more points, the warmer the color. Labels describe the
 * size of the balance only, never a cabin or destination, since what points
 * buy depends on the route. Thresholds loosely follow the seed data's
 * one-person prices (~10k, ~25k, ~45k, 80k+).
 */
export interface Tier {
  level: number;
  label: string;
  color: string;
  /** Gradient for bars and highlights at this tier. */
  gradient: string;
}

const TIERS: (Tier & { min: number })[] = [
  { min: 0, level: 0, label: "Getting started", color: "#94A3B8", gradient: "linear-gradient(90deg,#94A3B8,#64748B)" },
  { min: 10000, level: 1, label: "Nice start", color: "#0EA5E9", gradient: "linear-gradient(90deg,#38BDF8,#0EA5E9)" },
  { min: 25000, level: 2, label: "Solid stash", color: "#14B8A6", gradient: "linear-gradient(90deg,#2DD4BF,#0EA5E9)" },
  { min: 45000, level: 3, label: "Big stash", color: "#7C3AED", gradient: "linear-gradient(90deg,#8B5CF6,#EC4899)" },
  { min: 80000, level: 4, label: "Serious points", color: "#FD297B", gradient: "linear-gradient(90deg,#FF655B,#FD297B)" },
  { min: 150000, level: 5, label: "Points pro", color: "#E0A100", gradient: "linear-gradient(90deg,#F5B83D,#FD297B)" },
];

export function tierFor(points: number): Tier {
  let t = TIERS[0];
  for (const x of TIERS) if (points >= x.min) t = x;
  const { min: _min, ...tier } = t;
  return tier;
}

/** Hotel points turn into airline miles at about 3:1, so tiers judge them by what they convert to. */
export const milesFor = (id: ProgramId, points: number) => (PROGRAMS[id].kind === "hotel" ? Math.floor(points / 3) : points);

export function milesTotal(balances: Balances): number {
  return (Object.entries(balances) as [ProgramId, number][]).reduce((s, [id, v]) => s + milesFor(id, v || 0), 0);
}
