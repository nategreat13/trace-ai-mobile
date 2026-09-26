import type { UserProfile } from "@trace/shared";
import { getItemRaw, setItemRaw } from "./storage";

/**
 * Most times the gift is pushed at a user *unprompted* — i.e. the
 * return-visit re-offer. Dismissals and manual reopens are not capped.
 */
export const GIFT_MAX_SHOWS = 3;
/** Minimum gap between *unprompted* showings, e.g. the return-visit re-offer. */
export const GIFT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/**
 * Show the win-back on every Nth paywall dismissal, counting from the first.
 * At 2 that means the 2nd, 4th, 6th… — the first close is left alone.
 *
 * Someone closing the paywall for the first time is usually still looking
 * around; answering that with a discount both interrupts them and spends the
 * offer at its weakest moment. A second close is a decision, and that's where
 * the win-back is worth making.
 */
export const GIFT_DISMISSAL_INTERVAL = 2;

/**
 * Lifetime paywall dismissals for this install, in AsyncStorage under
 * `trace.paywall_dismissals` (a RAW key — pacing a modal is env-agnostic).
 *
 * Deliberately device-local rather than a profile field: it paces a piece of
 * UI, it's worthless off this device, and it shouldn't cost a Firestore write
 * on a screen the user is in the middle of leaving.
 */
const DISMISSAL_KEY = "trace.paywall_dismissals";

/** Increment and return the new total. Returns 0 if storage is unavailable. */
export async function recordPaywallDismissal(): Promise<number> {
  try {
    const raw = await getItemRaw(DISMISSAL_KEY);
    const next = (Number.parseInt(raw ?? "0", 10) || 0) + 1;
    await setItemRaw(DISMISSAL_KEY, String(next));
    return next;
  } catch {
    // Storage failing shouldn't decide whether the gift appears; 0 is not a
    // multiple of the interval, so the caller simply doesn't show it.
    return 0;
  }
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
 *   - `onDismiss` — they just closed the paywall. No cap and no cooldown, but
 *     paced: every `GIFT_DISMISSAL_INTERVAL`th close, so the first one passes
 *     without interruption and the offer lands on a decision rather than on
 *     someone still looking around. `dismissalCount` is the running total
 *     from `recordPaywallDismissal`; without it nothing is shown, since a
 *     missing count can't be distinguished from a first close.
 *   - neither — an unprompted re-offer on a later visit. Cap and cooldown.
 */
export function giftOfferEligible(
  profile: Pick<UserProfile, "giftOfferShown" | "giftOfferShowCount" | "giftOfferLastShownAt"> | null | undefined,
  opts: { manual?: boolean; onDismiss?: boolean; dismissalCount?: number } = {},
): boolean {
  if (!profile) return false;
  // Checked before the cap: dismissals are paced by their own rule, not by
  // the unprompted-showing budget.
  if (opts.onDismiss) {
    const n = opts.dismissalCount ?? 0;
    return n > 0 && n % GIFT_DISMISSAL_INTERVAL === 0;
  }
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
