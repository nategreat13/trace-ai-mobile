import { getDb } from "./firebase-admin";
import type { Firestore } from "firebase-admin/firestore";

/**
 * Returns signup counts bucketed by day, oldest → newest.
 * Reads from the `userProfiles` collection (created on onboarding complete).
 */
export async function getSignupsByDay(days = 30): Promise<Array<{ date: string; count: number }>> {
  const db = getDb();
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const snap = await db
    .collection("userProfiles")
    .where("createdAt", ">=", since)
    .select("createdAt")
    .get();

  const buckets: Record<string, number> = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    buckets[d.toISOString().slice(0, 10)] = 0;
  }

  snap.forEach((doc) => {
    const data = doc.data();
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
  days = 30
): Promise<Array<{ name: string; count: number }>> {
  const db = getDb();
  const since = new Date();
  since.setDate(since.getDate() - days);

  const snap = await db
    .collection("events")
    .where("timestamp", ">=", since)
    .select("name")
    .get();

  const counts: Record<string, number> = {};
  snap.forEach((doc) => {
    const name = doc.data().name as string | undefined;
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
export async function getFunnelCounts(days = 30) {
  const db = getDb();
  const since = new Date();
  since.setDate(since.getDate() - days);

  async function countEvent(name: string): Promise<number> {
    const snap = await db
      .collection("events")
      .where("timestamp", ">=", since)
      .where("name", "==", name)
      .count()
      .get();
    return snap.data().count;
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
export async function getRetentionCohorts(weeks = 8) {
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
      .select("userId", "createdAt")
      .get();

    const users: Array<{ uid: string; created: Date }> = [];
    snap.forEach((doc) => {
      const data = doc.data();
      const created: any = data.createdAt;
      users.push({
        uid: data.userId,
        created: created?.toDate?.() ?? new Date(),
      });
    });

    if (users.length === 0) continue;

    const retained = await retentionFor(db, users);
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
  users: Array<{ uid: string; created: Date }>
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
      snap.forEach((doc) => retained.add(doc.data().userId));
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
 * Total user count (useful as a top-of-page stat).
 */
export async function getUserCount(): Promise<number> {
  const db = getDb();
  const snap = await db.collection("userProfiles").count().get();
  return snap.data().count;
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
export async function getPurchaseFlowFunnel(days = 30): Promise<{
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

  async function countEvent(name: string): Promise<number> {
    const snap = await db
      .collection("events")
      .where("timestamp", ">=", since)
      .where("name", "==", name)
      .count()
      .get();
    return snap.data().count;
  }

  // Pull failure docs (not just count) so we can aggregate by error_code.
  // Last 30 days of failures should be a small payload — if this collection
  // grows large, paginate or move to an aggregated counters doc.
  const failedSnap = await db
    .collection("events")
    .where("timestamp", ">=", since)
    .where("name", "==", "purchase_failed")
    .select("props")
    .get();

  const codeBuckets: Record<string, number> = {};
  failedSnap.forEach((doc) => {
    const props = (doc.data().props ?? {}) as Record<string, unknown>;
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
    purchaseFailed: failedSnap.size,
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
export async function getLoginCount(days = 30): Promise<number> {
  const db = getDb();
  const since = new Date();
  since.setDate(since.getDate() - days);
  const snap = await db
    .collection("events")
    .where("timestamp", ">=", since)
    .where("name", "==", "login")
    .count()
    .get();
  return snap.data().count;
}
