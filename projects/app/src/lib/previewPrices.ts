import type { Deal } from "@trace/shared";

/**
 * Display-price overrides for the onboarding preview surfaces, keyed by
 * lowercase destination (substring match, so "Tokyo (HND)" still hits).
 *
 * Trevor's call (Sept 16): these screens exist to get people into a trial,
 * and a real $1,011 Tokyo fare undersells them. Used by the gated feed and
 * the demo swipe deck so the same city shows the same price everywhere in
 * onboarding. Nothing outside onboarding reads this.
 *
 * Discount % is recomputed against the real `original_price` so the "% off"
 * stays arithmetically true to the price shown. Empty the map to turn it off.
 */
export const PREVIEW_PRICE_OVERRIDES: Record<string, number> = {
  tokyo: 539,
  "los angeles": 96,
};

export function applyPreviewPrice(d: Deal): Deal {
  const key = (d.destination || "").toLowerCase();
  const hit = Object.entries(PREVIEW_PRICE_OVERRIDES).find(([k]) => key.includes(k));
  if (!hit) return d;
  const price = hit[1];
  const orig = d.original_price;
  const pct =
    orig && orig > price ? Math.round(((orig - price) / orig) * 100) : d.discount_pct;
  return { ...d, price, discount_pct: pct };
}
