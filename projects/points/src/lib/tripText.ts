import { CARD_OFFERS_AS_OF, PROGRAMS } from "@/engine/data";
import type { CardSuggestion, TripResult } from "@/engine/types";
import { num, shortDate } from "./format";

export const tripLabel = (r: TripResult) => `${r.trip.route} · ${r.trip.cabin}`;

export const statusText = (r: TripResult) => (r.ok ? "Can book" : `${num(r.gap)} short`);

/** "Amex 40,000 + Chase 12,500 → Aeroplan" */
export function payLine(r: TripResult): string {
  if (!r.best.parts.length) return `Earn ${r.best.partner.short}`;
  const from = r.best.parts.map((p) => `${PROGRAMS[p.from].short} ${num(p.spend)}`).join(" + ");
  const direct = r.best.parts.every((p) => p.direct);
  return direct ? from : `${from} → ${r.best.partner.short}`;
}

/** Labels every price as typical and flags dynamic programs and caveats. */
export function finePrint(r: TripResult): string {
  const bits = ["Typical saver price, estimated."];
  if (r.best.partner.dynamic) bits.push(`${r.best.partner.short} prices change daily.`);
  if (r.best.option.note) bits.push(r.best.option.note);
  return bits.join(" ");
}

export function offerLine(s: CardSuggestion): string {
  const c = s.card;
  const bonus = `${c.upTo ? "up to " : ""}${num(c.bonus)}${c.extra ?? ""}`;
  const lead = s.closesGap ? "Close the gap" : "Get closer";
  return `${lead}: ${c.name}, ${bonus} after ${c.spend}${c.tag ? ` (${c.tag.toLowerCase()})` : ""}. Offer as of ${shortDate(CARD_OFFERS_AS_OF)}.`;
}

export const AFFILIATE = "Trace may earn a commission if you're approved.";
