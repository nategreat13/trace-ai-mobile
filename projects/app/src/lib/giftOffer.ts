import type { UserProfile } from "@trace/shared";

/**
 * Most times the gift is pushed at a user *unprompted* — i.e. the
 * return-visit re-offer. Dismissals and manual reopens are not capped.
 */
export const GIFT_MAX_SHOWS = 3;
/** Minimum gap between *unprompted* showings, e.g. the return-visit re-offer. */
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
 * Three cases, and they want different rules:
 *
 *   - `manual` — they tapped "You have an unclaimed offer". They went looking
 *     for it, so only the cap applies.
 *   - `onDismiss` — they just closed the paywall. No cap, no cooldown. This
 *     is the abandonment moment and the entire reason the win-back exists;
 *     someone who reaches it a second time has declined a second time, which
 *     is more reason to make the offer rather than less. Every limit put on
 *     this path so far has shown up as "the gift disappeared".
 *   - neither — an unprompted re-offer on a later visit. Cap and cooldown.
 */
export function giftOfferEligible(
  profile: Pick<UserProfile, "giftOfferShown" | "giftOfferShowCount" | "giftOfferLastShownAt"> | null | undefined,
  opts: { manual?: boolean; onDismiss?: boolean } = {},
): boolean {
  if (!profile) return false;
  // Checked before the cap: a dismissal always gets answered.
  if (opts.onDismiss) return true;
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
