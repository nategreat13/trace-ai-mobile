/**
 * Date formatting helpers for the admin portal.
 *
 * Always renders in Mountain Time (America/Denver) since the team
 * lives in MT. Server-rendered pages would otherwise pick up the
 * Vercel runtime's locale / timezone, which is UTC — confusing for
 * "when was this redeemed" type questions.
 */

const ADMIN_TZ = "America/Denver";

const TZ_SUFFIX = " MT"; // appended to time-y outputs so it's unambiguous

/**
 * Medium date with optional short time, in Mountain Time.
 *   formatDate(d)             -> "May 7, 2026"
 *   formatDate(d, true)       -> "May 7, 2026, 11:39 AM MT"
 */
export function formatDate(d: Date | null, withTime = false): string {
  if (!d) return "—";
  const out = d.toLocaleString("en-US", {
    timeZone: ADMIN_TZ,
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" } : {}),
  });
  return withTime ? out + TZ_SUFFIX : out;
}

/**
 * Compact "May 7, 2026" — no time. Used in table cells where vertical
 * space is tight.
 */
export function formatDateShort(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("en-US", {
    timeZone: ADMIN_TZ,
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Compact "May 7, 11:39 AM MT" — month/day + time. Used in event timelines.
 */
export function formatMonthDayTime(d: Date | null): string {
  if (!d) return "—";
  return (
    d.toLocaleString("en-US", {
      timeZone: ADMIN_TZ,
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }) + TZ_SUFFIX
  );
}

/**
 * "today", "1d ago", "5mo ago", "2y ago" — timezone-independent since
 * it's a delta.
 */
export function relativeFromNow(d: Date | null): string {
  if (!d) return "—";
  const ms = Date.now() - d.getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days < 0) return "future";
  if (days === 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}
