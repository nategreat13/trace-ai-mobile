import type { Deal } from "@trace/shared";

/**
 * Fit for one deal against taste learned from saves (see lib/swipeTaste).
 * Pure, so it can be checked without Firebase.
 */
export interface SwipeTaste {
  saves: number;
  intlShare: number;
  typeCounts: Record<string, number>;
}

/** Below this many saves there's no honest signal — the badge is hidden. */
export const MIN_SAVES_FOR_FIT = 3;

function isIntl(v: string | null | undefined): boolean {
  return !!v && v.toLowerCase().includes("international");
}

export type FitColor = "green" | "yellow" | "red";

const TYPE_WORDS: Record<string, string> = {
  luxury: "luxury",
  adventure: "adventure",
  budget: "budget",
  cultural: "culture",
  family: "family",
  relaxation: "beach",
  romantic: "romantic",
  big_city: "big-city",
};

type Segment = { text: string; bold?: boolean };

/**
 * Fit for one deal against learned taste, with the reason in their own
 * numbers ("4 of your 6 saves are international"). Null when there isn't
 * enough to say anything true.
 */
export function swipeFit(
  deal: Deal,
  taste: SwipeTaste | null,
): { color: FitColor; segments: Segment[] } | null {
  if (!taste || taste.saves < MIN_SAVES_FOR_FIT) return null;
  const n = taste.saves;
  const dealIntl = isIntl(deal.domestic_or_international);
  const sameSide = dealIntl ? taste.intlShare : 1 - taste.intlShare;
  const sideCount = Math.round(sameSide * n);
  const type = deal.deal_type || "";
  const typeCount = type ? taste.typeCounts[type] ?? 0 : 0;
  const typeShare = typeCount / n;

  const sideFits = sameSide >= 0.5;
  const typeFits = typeShare >= 0.3;
  const color: FitColor =
    sideFits && (typeFits || !type) ? "green" : sideFits || typeFits ? "yellow" : "red";

  const side = dealIntl ? "international" : "domestic";
  const word = TYPE_WORDS[type];
  const dest = deal.destination || "This trip";
  // "All 3 of your saves" reads better than "3 of your 3 saves".
  const ofSaves = (k: number) => (k === n ? `All ${n} of your saves` : `${k} of your ${n} saves`);
  const segs: Segment[] = [];
  if (word && typeCount > 0) {
    const sideTail =
      sideCount === 0 ? ". " : sideCount === n ? `, all ${side}. ` : `, and ${sideCount} are ${side}. `;
    segs.push(
      { text: ofSaves(typeCount), bold: true },
      { text: ` are ${word} trips` },
      { text: sideTail },
    );
  } else {
    segs.push({ text: ofSaves(sideCount), bold: true }, { text: ` are ${side} trips. ` });
  }
  if (color === "green") {
    segs.push({ text: dest, bold: true }, { text: " is right in line with what you keep saving." });
  } else if (color === "yellow") {
    segs.push({ text: dest, bold: true }, { text: " is close to your usual, with a twist." });
  } else {
    segs.push({ text: dest, bold: true }, { text: " is outside what you usually save — sometimes that's the trip worth taking." });
  }
  return { color, segments: segs };
}
