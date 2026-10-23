export const num = (v: number) => Math.round(v).toLocaleString("en-US");
export const money = (v: number) => "$" + Math.round(v).toLocaleString("en-US");
export const kShort = (v: number) => `${Math.ceil(v / 1000)}k`;
export const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2026-10-31" → "Oct 31", without time zone surprises. */
export function shortDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}

/** Today as YYYY-MM-DD in the user's own time zone. */
export function todayIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
