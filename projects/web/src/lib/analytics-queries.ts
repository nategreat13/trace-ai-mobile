import { getDb } from "./firebase-admin";
import type { Firestore } from "firebase-admin/firestore";
import type { ExcludedSets } from "./exclusions";

/**
 * All public query functions accept two optional filter arguments:
 *
 *   - excluded:      explicit exclusion list (test/internal accounts).
 *   - validUserIds:  the set of userIds that currently have a userProfile.
 *                    When provided, events whose author no longer has a
 *                    profile (i.e. the account was deleted) are filtered
 *                    as orphans. The literal "guest" userId is always
 *                    kept since pre-signup events are real anonymous
 *                    interactions, not orphans.
 *
 * Implementation note: where the previous code used Firestore's `count()`
 * aggregation we now fetch the matching docs with a narrow `select()` and
 * count after filtering. Slightly more expensive than `count()` but
 * necessary because exclusion can't be expressed as a server-side query
 * (Firestore's `not-in` is capped at 10 values and we may have more
 * exclusions than that).
 */

/**
 * Returns true if an event with this userId should be counted.
 *
 *   - "guest" events: always counted (pre-signup interactions).
 *   - Empty / missing userId: counted (we have no signal to filter on).
 *   - In the explicit exclusion list: skipped.
 *   - Has a userId but no longer has a userProfile (orphan): skipped
 *     when validUserIds is provided.
 */
function shouldIncludeUid(
  userId: string | null | undefined,
  excluded: ExcludedSets | undefined,
  validUserIds: Set<string> | undefined
): boolean {
  if (!userId) return true;
  if (userId === "guest") return true;
  if (excluded?.userIds.has(userId)) return false;
  if (validUserIds && !validUserIds.has(userId)) return false;
  return true;
}

/**
 * Returns signup counts bucketed by day, oldest → newest.
 * Reads from the `userProfiles` collection (created on onboarding complete).
 */
export async function getSignupsByDay(
  days = 30,
  excluded?: ExcludedSets
): Promise<Array<{ date: string; count: number }>> {
  // No validUserIds filter here: by definition every userProfile we read
  // exists, so there's nothing to "orphan". The only filter is the
  // explicit exclusion list.
  const db = getDb();
  const since = new Date();
  // "Last N days" means N days ending today (inclusive). The window
  // starts (N - 1) days ago at midnight so today's signups land in
  // the final bucket.
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const snap = await db
    .collection("userProfiles")
    .where("createdAt", ">=", since)
    .select("createdAt", "userId", "email")
    .get();

  // Generate `days` buckets: since (today-N+1) through today.
  // Earlier code looped `i < days` producing buckets through
  // (today-1), which silently dropped today's signups entirely —
  // the date string for today wasn't a valid key.
  const buckets: Record<string, number> = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    buckets[d.toISOString().slice(0, 10)] = 0;
  }

  snap.forEach((doc) => {
    const data = doc.data();
    if (excluded) {
      const uid = data.userId as string | undefined;
      const email = (data.email as string | undefined)?.toLowerCase();
      if (uid && excluded.userIds.has(uid)) return;
      if (email && excluded.emails.has(email)) return;
    }
    const ts: any = data.createdAt;
    const date =
      ts?.toDate?.()?.toISOString().slice(0, 10) ??
      (typeof ts === "string" ? ts.slice(0, 10) : null);
    if (date && buckets[date] !== undefined) buckets[date]++;
  });

  return Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));
}

/**
 * Returns event counts grouped by event name over the last N days.
 */
export async function getEventCountsByName(
  days = 30,
  excluded?: ExcludedSets,
  validUserIds?: Set<string>
): Promise<Array<{ name: string; count: number }>> {
  const db = getDb();
  const since = new Date();
  since.setDate(since.getDate() - days);

  const snap = await db
    .collection("events")
    .where("timestamp", ">=", since)
    .select("name", "userId")
    .get();

  const counts: Record<string, number> = {};
  snap.forEach((doc) => {
    const data = doc.data();
    if (!shouldIncludeUid(data.userId as string | undefined, excluded, validUserIds)) return;
    const name = data.name as string | undefined;
    if (!name) return;
    counts[name] = (counts[name] ?? 0) + 1;
  });

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));
}

/**
 * Computes the core acquisition → signup → subscribe funnel for the last N days.
 * Event names used: landing_viewed, signup_completed, onboarding_completed,
 *   paywall_viewed, purchase_completed.
 */
export async function getFunnelCounts(
  days = 30,
  excluded?: ExcludedSets,
  validUserIds?: Set<string>
) {
  const db = getDb();
  const since = new Date();
  since.setDate(since.getDate() - days);

  // Fetch matching events + userId (rather than count()) so we can filter
  // excluded + orphan users in memory.
  //
  // orderBy timestamp DESC is required to use the deployed composite
  // index `events: (name ASC, timestamp DESC)`. Without an explicit
  // orderBy, Firestore implicitly orders by the range field ASC and
  // refuses the query with FAILED_PRECONDITION even though the index
  // exists. The page-level catch swallows the error as 0, masking
  // the misconfiguration as "no data".
  async function countEvent(name: string): Promise<number> {
    const snap = await db
      .collection("events")
      .where("timestamp", ">=", since)
      .where("name", "==", name)
      .orderBy("timestamp", "desc")
      .select("userId")
      .get();
    let n = 0;
    snap.forEach((doc) => {
      if (shouldIncludeUid(doc.data().userId as string | undefined, excluded, validUserIds)) n++;
    });
    return n;
  }

  const [landingViews, signupCompleted, onboardingCompleted, paywallViewed, purchaseCompleted] =
    await Promise.all([
      countEvent("landing_viewed"),
      countEvent("signup_completed"),
      countEvent("onboarding_completed"),
      countEvent("paywall_viewed"),
      countEvent("purchase_completed"),
    ]);

  return {
    landingViews,
    signupCompleted,
    onboardingCompleted,
    paywallViewed,
    purchaseCompleted,
  };
}

/**
 * Returns weekly retention cohorts. Each cohort = users who signed up in that
 * week. The array of percentages is Day 0, Day 1, Day 7, Day 30.
 */
export async function getRetentionCohorts(
  weeks = 8,
  excluded?: ExcludedSets,
  validUserIds?: Set<string>
) {
  const db = getDb();
  const now = new Date();
  const cohorts: Array<{
    weekStart: string;
    size: number;
    d1: number;
    d7: number;
    d30: number;
  }> = [];

  for (let w = 0; w < weeks; w++) {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() - w * 7);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const snap = await db
      .collection("userProfiles")
      .where("createdAt", ">=", weekStart)
      .where("createdAt", "<", weekEnd)
      .select("userId", "createdAt", "email")
      .get();

    const users: Array<{ uid: string; created: Date }> = [];
    snap.forEach((doc) => {
      const data = doc.data();
      const uid = data.userId as string | undefined;
      const email = (data.email as string | undefined)?.toLowerCase();
      if (excluded && uid && excluded.userIds.has(uid)) return;
      if (excluded && email && excluded.emails.has(email)) return;
      const created: any = data.createdAt;
      users.push({
        uid: uid ?? "",
        created: created?.toDate?.() ?? new Date(),
      });
    });

    if (users.length === 0) continue;

    const retained = await retentionFor(db, users, excluded, validUserIds);
    cohorts.push({
      weekStart: weekStart.toISOString().slice(0, 10),
      size: users.length,
      d1: retained.d1,
      d7: retained.d7,
      d30: retained.d30,
    });
  }

  return cohorts.reverse(); // oldest first
}

async function retentionFor(
  db: Firestore,
  users: Array<{ uid: string; created: Date }>,
  excluded?: ExcludedSets,
  validUserIds?: Set<string>
): Promise<{ d1: number; d7: number; d30: number }> {
  // For small cohorts, check each user for activity within the day-1/7/30 windows.
  // We define "retained" as: any event fired by the user within the window.
  const uids = users.map((u) => u.uid);
  if (uids.length === 0) return { d1: 0, d7: 0, d30: 0 };

  // Firestore `in` query caps at 30 uids — chunk if needed.
  async function anyEventsInWindow(d: number): Promise<Set<string>> {
    const retained = new Set<string>();
    for (let i = 0; i < uids.length; i += 30) {
      const chunk = uids.slice(i, i + 30);
      const windowStart = new Date(users[0].created);
      windowStart.setDate(windowStart.getDate() + d);
      const windowEnd = new Date(windowStart);
      windowEnd.setDate(windowEnd.getDate() + 1);

      const snap = await db
        .collection("events")
        .where("userId", "in", chunk)
        .where("timestamp", ">=", windowStart)
        .where("timestamp", "<", windowEnd)
        .select("userId")
        .get();
      snap.forEach((doc) => {
        const uid = doc.data().userId as string | undefined;
        if (!shouldIncludeUid(uid, excluded, validUserIds)) return;
        if (uid) retained.add(uid);
      });
    }
    return retained;
  }

  const [r1, r7, r30] = await Promise.all([
    anyEventsInWindow(1),
    anyEventsInWindow(7),
    anyEventsInWindow(30),
  ]);

  return {
    d1: Math.round((r1.size / users.length) * 100),
    d7: Math.round((r7.size / users.length) * 100),
    d30: Math.round((r30.size / users.length) * 100),
  };
}

/**
 * Returns manually-entered ad spend per platform from the `adSpend` collection.
 * Schema: { platform: string, month: "YYYY-MM", spendCents: number }
 */
export async function getAdSpend(): Promise<
  Array<{ platform: string; month: string; spendCents: number }>
> {
  const db = getDb();
  const snap = await db.collection("adSpend").orderBy("month", "desc").limit(100).get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      platform: data.platform as string,
      month: data.month as string,
      spendCents: (data.spendCents as number) ?? 0,
    };
  });
}

/**
 * Total user count (useful as a top-of-page stat). When excluded is
 * provided, subtracts excluded userProfiles from the headline number.
 */
export async function getUserCount(excluded?: ExcludedSets): Promise<number> {
  const db = getDb();
  if (!excluded || (excluded.userIds.size === 0 && excluded.emails.size === 0)) {
    const snap = await db.collection("userProfiles").count().get();
    return snap.data().count;
  }
  // With exclusions we can't use count() — fetch the userIds + emails and
  // filter. At small scale this is fine; at 100k+ users move to a counter doc.
  const snap = await db.collection("userProfiles").select("userId", "email").get();
  let n = 0;
  snap.forEach((doc) => {
    const data = doc.data();
    const uid = data.userId as string | undefined;
    const email = (data.email as string | undefined)?.toLowerCase();
    if (uid && excluded.userIds.has(uid)) return;
    if (email && excluded.emails.has(email)) return;
    n++;
  });
  return n;
}

/**
 * Returns the in-app purchase flow drop-off, plus the breakdown of failed/
 * canceled purchases. The order from `paywall_viewed` to `purchase_completed`
 * tells us where users abandon the upgrade flow:
 *
 *   paywall_viewed
 *   └─ paywall_cta_tapped
 *      └─ purchase_initiated   (Subscribe button hit, StoreKit dialog shown)
 *         ├─ purchase_completed  (success)
 *         ├─ purchase_canceled   (user dismissed StoreKit dialog)
 *         └─ purchase_failed     (StoreKit/RC error — bug signal)
 *
 * `failuresByCode` groups purchase_failed events by props.error_code so we
 * can spot a regression like "all Premium-monthly purchases failing".
 */
export async function getPurchaseFlowFunnel(
  days = 30,
  excluded?: ExcludedSets,
  validUserIds?: Set<string>
): Promise<{
  paywallViewed: number;
  paywallCtaTapped: number;
  purchaseInitiated: number;
  purchaseCompleted: number;
  purchaseCanceled: number;
  purchaseFailed: number;
  failuresByCode: Array<{ code: string; count: number }>;
}> {
  const db = getDb();
  const since = new Date();
  since.setDate(since.getDate() - days);

  // orderBy timestamp DESC — see comment in getFunnelCounts.
  async function countEvent(name: string): Promise<number> {
    const snap = await db
      .collection("events")
      .where("timestamp", ">=", since)
      .where("name", "==", name)
      .orderBy("timestamp", "desc")
      .select("userId")
      .get();
    let n = 0;
    snap.forEach((doc) => {
      if (shouldIncludeUid(doc.data().userId as string | undefined, excluded, validUserIds)) n++;
    });
    return n;
  }

  // Pull failure docs (not just count) so we can aggregate by error_code.
  // Last 30 days of failures should be a small payload — if this collection
  // grows large, paginate or move to an aggregated counters doc.
  const failedSnap = await db
    .collection("events")
    .where("timestamp", ">=", since)
    .where("name", "==", "purchase_failed")
    .orderBy("timestamp", "desc")
    .select("props", "userId")
    .get();

  const codeBuckets: Record<string, number> = {};
  let purchaseFailedCount = 0;
  failedSnap.forEach((doc) => {
    const data = doc.data();
    if (!shouldIncludeUid(data.userId as string | undefined, excluded, validUserIds)) return;
    purchaseFailedCount++;
    const props = (data.props ?? {}) as Record<string, unknown>;
    const code = typeof props.error_code === "string" || typeof props.error_code === "number"
      ? String(props.error_code)
      : "unknown";
    codeBuckets[code] = (codeBuckets[code] ?? 0) + 1;
  });

  const [paywallViewed, paywallCtaTapped, purchaseInitiated, purchaseCompleted, purchaseCanceled] =
    await Promise.all([
      countEvent("paywall_viewed"),
      countEvent("paywall_cta_tapped"),
      countEvent("purchase_initiated"),
      countEvent("purchase_completed"),
      countEvent("purchase_canceled"),
    ]);

  return {
    paywallViewed,
    paywallCtaTapped,
    purchaseInitiated,
    purchaseCompleted,
    purchaseCanceled,
    purchaseFailed: purchaseFailedCount,
    failuresByCode: Object.entries(codeBuckets)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([code, count]) => ({ code, count })),
  };
}

/**
 * Returns the count of `login` events in the last N days. Pairs with
 * `getSignupsByDay` so the dashboard can show new vs returning users.
 */
export async function getLoginCount(
  days = 30,
  excluded?: ExcludedSets,
  validUserIds?: Set<string>
): Promise<number> {
  const db = getDb();
  const since = new Date();
  since.setDate(since.getDate() - days);
  const snap = await db
    .collection("events")
    .where("timestamp", ">=", since)
    .where("name", "==", "login")
    .orderBy("timestamp", "desc")
    .select("userId")
    .get();
  let n = 0;
  snap.forEach((doc) => {
    if (shouldIncludeUid(doc.data().userId as string | undefined, excluded, validUserIds)) n++;
  });
  return n;
}

type TierBreakdown = { total: number; premium: number; business: number; unknown: number };

/**
 * Aggregates a lifecycle event by `props.tier`. Pulls all matching docs in
 * the window (we don't have a pre-aggregated counter doc yet) — fine while
 * we're sub-100k events/day.
 */
async function tierBreakdown(
  db: Firestore,
  name: string,
  since: Date,
  excluded?: ExcludedSets,
  validUserIds?: Set<string>
): Promise<TierBreakdown> {
  const snap = await db
    .collection("events")
    .where("timestamp", ">=", since)
    .where("name", "==", name)
    .orderBy("timestamp", "desc")
    .select("props", "userId")
    .get();

  const out: TierBreakdown = { total: 0, premium: 0, business: 0, unknown: 0 };
  snap.forEach((doc) => {
    const data = doc.data();
    if (!shouldIncludeUid(data.userId as string | undefined, excluded, validUserIds)) return;
    out.total++;
    const props = (data.props ?? {}) as Record<string, unknown>;
    const tier = props.tier;
    if (tier === "premium") out.premium++;
    else if (tier === "business") out.business++;
    else out.unknown++;
  });
  return out;
}

/**
 * Subscription lifecycle stats for the last N days, sourced from the
 * RevenueCat webhook events. This surfaces what RC's summary tucks under
 * a single "churn" number — namely:
 *
 *   - voluntary churn  (subscription_canceled)  → user turned off auto-renew
 *   - involuntary churn (subscription_expired)  → billing failed / period ended
 *
 * These behave very differently and warrant separate countermeasures
 * (winback campaigns vs payment retries).
 */
export async function getSubscriptionLifecycle(
  days = 30,
  excluded?: ExcludedSets,
  validUserIds?: Set<string>
): Promise<{
  renewed: TierBreakdown;
  voluntaryChurn: TierBreakdown;
  involuntaryChurn: TierBreakdown;
  billingIssues: TierBreakdown;
  changed: TierBreakdown;
  uncanceled: TierBreakdown;
}> {
  const db = getDb();
  const since = new Date();
  since.setDate(since.getDate() - days);

  const [renewed, voluntaryChurn, involuntaryChurn, billingIssues, changed, uncanceled] =
    await Promise.all([
      tierBreakdown(db, "subscription_renewed", since, excluded, validUserIds),
      tierBreakdown(db, "subscription_canceled", since, excluded, validUserIds),
      tierBreakdown(db, "subscription_expired", since, excluded, validUserIds),
      tierBreakdown(db, "billing_issue", since, excluded, validUserIds),
      tierBreakdown(db, "subscription_changed", since, excluded, validUserIds),
      tierBreakdown(db, "subscription_uncanceled", since, excluded, validUserIds),
    ]);

  return { renewed, voluntaryChurn, involuntaryChurn, billingIssues, changed, uncanceled };
}

/**
 * Daily count of `purchase_failed` events. Lets the dashboard show a
 * sparkline so a sudden spike (e.g. a SKU misconfiguration like the
 * Premium-monthly receipt bug) is obvious at a glance.
 */
export async function getPurchaseFailuresByDay(
  days = 30,
  excluded?: ExcludedSets,
  validUserIds?: Set<string>
): Promise<Array<{ date: string; count: number }>> {
  const db = getDb();
  const since = new Date();
  // Shift by (days - 1) so today's bucket is included — see comment
  // on getSignupsByDay for the off-by-one this fixes.
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const snap = await db
    .collection("events")
    .where("timestamp", ">=", since)
    .where("name", "==", "purchase_failed")
    .orderBy("timestamp", "desc")
    .select("timestamp", "userId")
    .get();

  // Same "include today's bucket" fix as getSignupsByDay: shift since
  // by (days - 1) so the loop generates exactly `days` buckets ending
  // today rather than 30 buckets ending yesterday.
  const buckets: Record<string, number> = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    buckets[d.toISOString().slice(0, 10)] = 0;
  }

  snap.forEach((doc) => {
    const data = doc.data();
    if (!shouldIncludeUid(data.userId as string | undefined, excluded, validUserIds)) return;
    const ts: any = data.timestamp;
    const date = ts?.toDate?.()?.toISOString().slice(0, 10);
    if (date && buckets[date] !== undefined) buckets[date]++;
  });

  return Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));
}
