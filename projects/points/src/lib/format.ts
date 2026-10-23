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

/** "today", "yesterday", "3 days ago" or "Oct 21" for a YYYY-MM-DD date. */
export function relativeDay(iso: string): string {
  const days = Math.round((Date.parse(`${todayIso()}T12:00:00`) - Date.parse(`${iso}T12:00:00`)) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return shortDate(iso);
}
