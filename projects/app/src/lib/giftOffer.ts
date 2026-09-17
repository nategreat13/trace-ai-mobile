import type { UserProfile } from "@trace/shared";

/** Most times the gift is ever pushed at a user automatically. */
export const GIFT_MAX_SHOWS = 3;
/** Minimum gap between automatic showings. */
export const GIFT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

function toMs(d: unknown): number | null {
  if (!d) return null;
  if (d instanceof Date) return d.getTime();
  // Firestore Timestamp or ISO string
  const anyD = d as { toDate?: () => Date; seconds?: number };
  if (typeof anyD.toDate === "function") return anyD.toDate().getTime();
  if (typeof anyD.seconds === "number") return anyD.seconds * 1000;
  const t = new Date(d as string).getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * Whether the gift may be pushed at this user right now.
 *
 * Automatic showings (paywall dismissal, return visit) respect the cap and
 * the cooldown. A user-initiated reopen from the feed page passes
 * `manual: true` and only respects the cap — if they went looking for it,
 * the cooldown is the wrong thing to enforce.
 */
export function giftOfferEligible(
  profile: Pick<UserProfile, "giftOfferShown" | "giftOfferShowCount" | "giftOfferLastShownAt"> | null | undefined,
  opts: { manual?: boolean } = {},
): boolean {
  if (!profile) return false;
  // Legacy one-shot flag with no count: treat as one prior showing.
  const count = profile.giftOfferShowCount ?? (profile.giftOfferShown ? 1 : 0);
  if (count >= GIFT_MAX_SHOWS) return false;
  if (opts.manual) return true;
  const last = toMs(profile.giftOfferLastShownAt);
  if (last == null) return count === 0;
  return Date.now() - last >= GIFT_COOLDOWN_MS;
}

/** True once the user has seen the gift at least once and hasn't claimed. */
export function giftOfferSeen(
  profile: Pick<UserProfile, "giftOfferShown" | "giftOfferShowCount"> | null | undefined,
): boolean {
  if (!profile) return false;
  return (profile.giftOfferShowCount ?? 0) > 0 || !!profile.giftOfferShown;
}
