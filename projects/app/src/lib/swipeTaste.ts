import type { SwipeTaste } from "./swipeFit";
import { getSwipeActions } from "../services/firestore";

/**
 * Travel taste learned from what someone saved (Oct 2026).
 *
 * The swipe-first onboarding no longer asks trip-style or destination
 * questions, and the old AI Fit treated "no answers" as "matches
 * everything" — every deal read Strong Match. This replaces the answers
 * with behaviour: the share of their saves that are international vs
 * domestic, and of each deal type. It keeps learning as they swipe.
 */
export { swipeFit, MIN_SAVES_FOR_FIT } from "./swipeFit";
export type { SwipeTaste } from "./swipeFit";

const cache = new Map<string, { at: number; taste: SwipeTaste }>();
const TTL_MS = 60_000;

function isIntl(v: string | null | undefined): boolean {
  return !!v && v.toLowerCase().includes("international");
}

export async function loadSwipeTaste(userId: string): Promise<SwipeTaste> {
  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.taste;
  const rows = (await getSwipeActions(userId, 300)) as any[];
  const saves = rows.filter((r) => r.action === "right" || r.action === "super");
  const typeCounts: Record<string, number> = {};
  let intl = 0;
  for (const s of saves) {
    if (isIntl(s.domesticOrInternational)) intl += 1;
    if (s.dealType) typeCounts[s.dealType] = (typeCounts[s.dealType] ?? 0) + 1;
  }
  const taste = {
    saves: saves.length,
    intlShare: saves.length ? intl / saves.length : 0,
    typeCounts,
  };
  cache.set(userId, { at: Date.now(), taste });
  return taste;
}

/** Drop the cached taste so the next deal opened reflects a new save. */
export function invalidateSwipeTaste(userId: string): void {
  cache.delete(userId);
}

