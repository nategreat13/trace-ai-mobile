import type { UserProfile } from "@trace/shared";

/** Most times the gift is ever pushed at a user automatically. */
export const GIFT_MAX_SHOWS = 3;
/** Minimum gap between *unprompted* showings, e.g. the return-visit re-offer. */
export const GIFT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/**
 * Whether the gift has already fired on a paywall dismissal in this app run.
 *
 * Dismissing the paywall is the abandonment moment, so the win-back should
 * fire there even if the 24-hour cooldown hasn't elapsed — a cooldown makes
 * sense for an offer we push at someone unprompted, not for one that answers
 * an action they just took. The guard that matters is per-session: showing it
 * on every X in a single sitting is what would turn a gift into the price.
 *
 * Module-level and deliberately not persisted; it resets with the process,
 * which is the definition of "session" we want here.
 */
let shownOnDismissThisSession = false;

export function markGiftShownOnDismiss(): void {
  shownOnDismissThisSession = true;
}

export function giftShownOnDismissThisSession(): boolean {
  return shownOnDismissThisSession;
}

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
 *   - `onDismiss` — they just closed the paywall. This is the abandonment
 *     moment and the whole reason the win-back exists, so the cooldown is
 *     wrong here; the guard is once per session plus the cap.
 *   - neither — an unprompted re-offer on a later visit. Cap and cooldown.
 */
export function giftOfferEligible(
  profile: Pick<UserProfile, "giftOfferShown" | "giftOfferShowCount" | "giftOfferLastShownAt"> | null | undefined,
  opts: { manual?: boolean; onDismiss?: boolean } = {},
): boolean {
  if (!profile) return false;
  // Legacy one-shot flag with no count: treat as one prior showing.
  const count = profile.giftOfferShowCount ?? (profile.giftOfferShown ? 1 : 0);
  if (count >= GIFT_MAX_SHOWS) return false;
  if (opts.manual) return true;
  if (opts.onDismiss) return !shownOnDismissThisSession;
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
