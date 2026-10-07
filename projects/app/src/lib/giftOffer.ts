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
 * Show the win-back on the first paywall dismissal and every Nth one after
 * it. At 2 that means the 1st, 3rd, 5th… close.
 *
 * 1.9.0 skipped the first close and fired on the 2nd, 4th, 6th…, on the theory
 * that a first close is someone still looking around. In its first week only
 * 10 of the 78 people who closed the paywall ever saw the gift, and it
 * produced one trial; on 1.8.0, where the first close was answered, the gift
 * accounted for half of a week's trials and its finished trials paid at 3 of
 * 6 against 2 of 10 for the regular paywall. Most people don't close twice.
 *
 * The spacing stays so that closing the paywall isn't simply how you get the
 * lower price every time.
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
    // 0 means "couldn't count". The caller treats that as a first close.
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
 *     paced: the first close and every `GIFT_DISMISSAL_INTERVAL`th after it.
 *     `dismissalCount` is the running total from `recordPaywallDismissal`; a
 *     missing count is treated as a first close, so a storage failure shows
 *     the gift rather than hiding it.
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
    const n = Math.max(1, opts.dismissalCount ?? 0);
    return (n - 1) % GIFT_DISMISSAL_INTERVAL === 0;
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
