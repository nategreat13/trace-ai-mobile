/**
 * Resolving a user's name, in one place.
 *
 * Signup has never required a name, and since the name screen came out of
 * onboarding (Oct 2026) most accounts have none at all — `displayName` is
 * written as the placeholder below. Several screens had each grown their own
 * guard against it, and the one screen that forgot greeted people as
 * "Travel, your feed is ready", because the placeholder's first word is
 * "Travel".
 *
 * Four copies of a rule is three too many, so it lives here and both the app
 * and the server import it.
 */

/** What `displayName` is set to when the user never gave us one. */
export const PLACEHOLDER_DISPLAY_NAME = "Travel Explorer";

/** True when this value is a placeholder or blank rather than a real name. */
export function isPlaceholderName(name?: string | null): boolean {
  const trimmed = (name ?? "").trim();
  return trimmed.length === 0 || trimmed === PLACEHOLDER_DISPLAY_NAME;
}

/**
 * The user's real full name, or null when we don't have one.
 *
 * Returns null rather than a fallback on purpose: a caller that gets null can
 * drop the name from its sentence entirely ("Your feed is ready"), which
 * always reads better than greeting someone by a placeholder.
 */
export function realDisplayName(
  profile?: { displayName?: string | null } | null,
): string | null {
  const name = profile?.displayName?.trim();
  return !name || isPlaceholderName(name) ? null : name;
}

/**
 * The user's first name, or null.
 *
 * Prefers the dedicated `firstName` field and falls back to the first word of
 * `displayName` — but never to a word of the placeholder.
 */
export function firstNameOf(
  profile?: { firstName?: string | null; displayName?: string | null } | null,
): string | null {
  const first = profile?.firstName?.trim();
  if (first && !isPlaceholderName(first)) return first;

  const full = realDisplayName(profile);
  if (!full) return null;
  const word = full.split(/\s+/)[0];
  return word || null;
}
