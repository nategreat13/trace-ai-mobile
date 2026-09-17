/**
 * Gradient stops that fade *into* a solid color without the muddy band.
 *
 * `["transparent", "#ffffff"]` looks like it should fade to white, but iOS
 * interpolates "transparent" as transparent BLACK — so the midpoint is a
 * semi-opaque gray, and a fade over light content shows a dark smudge.
 * Fading from the same color at 0% alpha keeps every stop on one hue.
 *
 * Accepts #rgb / #rrggbb; anything else falls through unchanged.
 */
export function fadeTo(color: string): [string, string] {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return ["transparent", color];
  let hex = m[1];
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  return [`#${hex}00`, `#${hex}`];
}
