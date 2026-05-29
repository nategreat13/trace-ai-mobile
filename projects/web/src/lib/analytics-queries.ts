import { colRef } from "./firebase-admin";
import type { TraceEnv } from "@trace/shared";
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
  env: TraceEnv,
  days = 30,
  excluded?: ExcludedSets
): Promise<Array<{ date: string; count: number }>> {
  // No validUserIds filter here: by definition every userProfile we read
  // exists, so there's nothing to "orphan". The only filter is the
  // explicit exclusion list.
  const since = new Date();
  // "Last N days" means N days ending today (inclusive). The window
  // starts (N - 1) days ago at midnight so today's signups land in
  // the final bucket.
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const snap = await colRef(env, "userProfiles")
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
  env: TraceEnv,
  days = 30,
  excluded?: ExcludedSets,
  validUserIds?: Set<string>
): Promise<Array<{ name: string; count: number }>> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const snap = await colRef(env, "events")
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
  env: TraceEnv,
  days = 30,
  excluded?: ExcludedSets,
  validUserIds?: Set<string>
) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  // Build two sets of "tainted" identifiers for guest events that
  // actually belong to an excluded user:
  //
  //   taintedSessions  — sessions where a signed-in event from an
  //                      excluded user was logged. Within-session
  //                      linking only; can't bridge multiple cold
  //                      launches from the same device.
  //   taintedDevices   — devices that have ever logged an event under
  //                      an excluded user's uid. Cross-session, so it
  //                      catches multi-cold-launch testing (force-quit
  //                      + reopen, OTA fetches, etc.) that the
  //                      session-only logic missed.
  //
  // device_id was added in the OTA after staging-env shipped; legacy
  // events without it fall back to session-only attribution (their
  // missing device_id just doesn't taint anything).
  const taintedSessions = new Set<string>();
  const taintedDevices = new Set<string>();
  if (excluded && excluded.userIds.size > 0) {
    // Firestore `in` is capped at 30 values per query; chunk if needed.
    const userIdsArr = Array.from(excluded.userIds);
    for (let i = 0; i < userIdsArr.length; i += 30) {
      const chunk = userIdsArr.slice(i, i + 30);
      const snap = await colRef(env, "events")
        .where("timestamp", ">=", since)
        .where("userId", "in", chunk)
        .orderBy("timestamp", "desc")
        .select("props.session_id", "props.device_id")
        .get();
      snap.forEach((doc) => {
        const sid = doc.get("props.session_id") as string | undefined;
        if (sid) taintedSessions.add(sid);
        const did = doc.get("props.device_id") as string | undefined;
        if (did) taintedDevices.add(did);
      });
    }
  }

  // Fetch matching events + userId + session_id (rather than count())
  // so we can apply two filters in memory:
  //   1. Standard userId-based exclusion (shouldIncludeUid).
  //   2. Tainted-session filter for guest events (above).
  // For landing_viewed specifically, ALSO dedupe by session_id so a
  // tester opening the app 5 times in different sessions counts as 5
  // (1 per session, the closest we can get to "1 per device" without
  // a real device_id). Other funnel events fire at most once per user
  // anyway, so no dedup needed there.
  //
  // orderBy timestamp DESC is required to use the deployed composite
  // index `events: (name ASC, timestamp DESC)`. Without an explicit
  // orderBy, Firestore implicitly orders by the range field ASC and
  // refuses the query with FAILED_PRECONDITION even though the index
  // exists. The page-level catch swallows the error as 0, masking
  // the misconfiguration as "no data".
  // Pre-profile events fire BEFORE `createUserProfile()` runs. At the
  // moment they're logged, no userProfile doc exists for the userId yet
  // — for abandoners (Firebase Auth succeeded, onboarding never finished),
  // it never will. shouldIncludeUid() can't distinguish "abandoner" from
  // "deleted user" and would silently drop both, so the funnel must
  // skip the `validUserIds` orphan filter for these events. Excluded-UID
  // and tainted-device filtering still apply — those exclude internal
  // testers regardless of profile state.
  const PRE_PROFILE_EVENTS = new Set([
    "signup_completed",
    "onboarding_started",
    // landing_viewed always has userId="guest", so the orphan filter
    // already skips it via the early `if (userId === "guest")` return —
    // listed here for completeness / future per-step events.
    "landing_viewed",
  ]);

  async function countEvent(name: string): Promise<number> {
    const snap = await colRef(env, "events")
      .where("timestamp", ">=", since)
      .where("name", "==", name)
      .orderBy("timestamp", "desc")
      .select("userId", "props.session_id", "props.device_id")
      .get();
    let n = 0;
    const dedupeBySession = name === "landing_viewed";
    const seenSessions = dedupeBySession ? new Set<string>() : null;
    const skipOrphanFilter = PRE_PROFILE_EVENTS.has(name);
    snap.forEach((doc) => {
      const userId = doc.get("userId") as string | undefined;
      const sessionId = doc.get("props.session_id") as string | undefined;
      const deviceId = doc.get("props.device_id") as string | undefined;

      // 1. Standard userId-based exclusion. For pre-profile events, pass
      //    `undefined` for validUserIds so abandoners (UID exists, no
      //    profile) aren't dropped as orphans.
      if (
        !shouldIncludeUid(
          userId,
          excluded,
          skipOrphanFilter ? undefined : validUserIds
        )
      ) {
        return;
      }
      // 2. Guest event whose session belonged to an excluded user.
      if (userId === "guest" && sessionId && taintedSessions.has(sessionId)) return;
      // 3. Guest event whose device belonged to an excluded user. This
      //    is the cross-session attribution that fixes the orphan-
      //    session bug — see `lib/device.ts` for the persistent UUID.
      if (userId === "guest" && deviceId && taintedDevices.has(deviceId)) return;
      // 4. Per-session dedup (landing_viewed only). Events without a
      //    session_id (legacy data) get counted as-is rather than
      //    being silently dropped.
      if (seenSessions && sessionId) {
        if (seenSessions.has(sessionId)) return;
        seenSessions.add(sessionId);
      }

      n++;
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
  env: TraceEnv,
  weeks = 8,
  excluded?: ExcludedSets,
  validUserIds?: Set<string>
) {
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

    const snap = await colRef(env, "userProfiles")
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

    const retained = await retentionFor(env, users, excluded, validUserIds);
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
  env: TraceEnv,
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

      const snap = await colRef(env, "events")
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
export async function getAdSpend(
  env: TraceEnv
): Promise<Array<{ platform: string; month: string; spendCents: number }>> {
  const snap = await colRef(env, "adSpend").orderBy("month", "desc").limit(100).get();
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
export async function getUserCount(
  env: TraceEnv,
  excluded?: ExcludedSets
): Promise<number> {
  if (!excluded || (excluded.userIds.size === 0 && excluded.emails.size === 0)) {
    const snap = await colRef(env, "userProfiles").count().get();
    return snap.data().count;
  }
  // With exclusions we can't use count() — fetch the userIds + emails and
  // filter. At small scale this is fine; at 100k+ users move to a counter doc.
  const snap = await colRef(env, "userProfiles").select("userId", "email").get();
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
 * Distinct device_id values seen in the events collection, excluding
 * devices that have ever logged an event under an excluded user's UID
 * (the same cross-session "tainted devices" logic used by getFunnelCounts).
 *
 * What this is: a count of unique installs that have *opened* the app at
 * least once. We can't see installs that never launched — every event in
 * here implies at least one app open.
 *
 * Why no time window: with the events collection freshly wiped on the
 * ads-launch baseline, "all time" is the meaningful window. If the
 * collection grows past ~100k events this becomes a heavy scan and we'd
 * want a `days` param + the existing `(timestamp DESC)` composite index.
 *
 * Devices whose only events were as a "guest" (pre-auth) but whose
 * device_id later appeared under an excluded UID are correctly dropped
 * via the tainted-devices set.
 */
export async function getUniqueDeviceCount(
  env: TraceEnv,
  excluded?: ExcludedSets,
  validUserIds?: Set<string>
): Promise<number> {
  // Build the tainted-devices set: device_ids that have ever logged an
  // event under one of the excluded UIDs. The `in` query is chunked at 30
  // (Firestore's limit) so it scales with the exclusion list size.
  const taintedDevices = new Set<string>();
  if (excluded && excluded.userIds.size > 0) {
    const userIdsArr = Array.from(excluded.userIds);
    for (let i = 0; i < userIdsArr.length; i += 30) {
      const chunk = userIdsArr.slice(i, i + 30);
      const snap = await colRef(env, "events")
        .where("userId", "in", chunk)
        .select("props.device_id")
        .get();
      snap.forEach((doc) => {
        const did = doc.get("props.device_id") as string | undefined;
        if (did) taintedDevices.add(did);
      });
    }
  }

  // Full scan with .select() so we only pay for the fields we read.
  const snap = await colRef(env, "events")
    .select("userId", "props.device_id")
    .get();
  const devices = new Set<string>();
  snap.forEach((doc) => {
    const userId = doc.get("userId") as string | undefined;
    const deviceId = doc.get("props.device_id") as string | undefined;
    if (!deviceId) return;
    if (!shouldIncludeUid(userId, excluded, validUserIds)) return;
    if (taintedDevices.has(deviceId)) return;
    devices.add(deviceId);
  });
  return devices.size;
}

// -- Per-device drill-down ------------------------------------------------

export interface DeviceRow {
  deviceId: string;
  platform: string | null;
  appVersion: string | null;
  osVersion: string | null;
  country: string | null;
  locale: string | null;
  firstSeenAt: Date | null;
  lastSeenAt: Date | null;
  eventCount: number;
  /** Most-recent non-guest UID seen on this device, if any. */
  lastUserId: string | null;
  /** True if this device fired signup_completed for some UID. */
  signedUp: boolean;
  /** True if a userProfile doc exists for lastUserId. Set by the page. */
  hasProfile?: boolean;
  /** Profile email if hasProfile. */
  email?: string | null;
  /** Profile onboardingComplete if hasProfile. */
  onboardingComplete?: boolean;
}

/**
 * Returns one row per non-excluded device_id seen in events. Same tainted-
 * devices filtering as `getUniqueDeviceCount` so the page count matches.
 *
 * Resolution of profile metadata (hasProfile / email / onboardingComplete)
 * happens in the calling page so we can batch the userProfiles lookup —
 * keeping this function as a single events scan.
 */
export async function listDevices(
  env: TraceEnv,
  excluded?: ExcludedSets,
  validUserIds?: Set<string>
): Promise<DeviceRow[]> {
  // 1. Build tainted-devices set — same pattern as getFunnelCounts.
  const taintedDevices = new Set<string>();
  if (excluded && excluded.userIds.size > 0) {
    const userIdsArr = Array.from(excluded.userIds);
    for (let i = 0; i < userIdsArr.length; i += 30) {
      const chunk = userIdsArr.slice(i, i + 30);
      const snap = await colRef(env, "events")
        .where("userId", "in", chunk)
        .select("props.device_id")
        .get();
      snap.forEach((doc) => {
        const did = doc.get("props.device_id") as string | undefined;
        if (did) taintedDevices.add(did);
      });
    }
  }

  // 2. Scan all events with the props we need.
  const snap = await colRef(env, "events")
    .select(
      "userId",
      "name",
      "timestamp",
      "props.device_id",
      "props.platform",
      "props.app_version",
      "props.os_version",
      "props.country",
      "props.locale"
    )
    .get();

  // 3. Bucket by device_id, applying exclusion filters as we go.
  const buckets = new Map<string, DeviceRow>();
  snap.forEach((doc) => {
    const userId = doc.get("userId") as string | undefined;
    const deviceId = doc.get("props.device_id") as string | undefined;
    if (!deviceId) return;
    if (!shouldIncludeUid(userId, excluded, validUserIds)) return;
    if (taintedDevices.has(deviceId)) return;

    const name = (doc.get("name") as string | undefined) ?? "";
    const ts = (doc.get("timestamp") as FirebaseFirestore.Timestamp | undefined)?.toDate?.() ?? null;

    let row = buckets.get(deviceId);
    if (!row) {
      row = {
        deviceId,
        platform: (doc.get("props.platform") as string | undefined) ?? null,
        appVersion: (doc.get("props.app_version") as string | undefined) ?? null,
        osVersion: (doc.get("props.os_version") as string | undefined) ?? null,
        country: (doc.get("props.country") as string | undefined) ?? null,
        locale: (doc.get("props.locale") as string | undefined) ?? null,
        firstSeenAt: ts,
        lastSeenAt: ts,
        eventCount: 0,
        lastUserId: null,
        signedUp: false,
      };
      buckets.set(deviceId, row);
    }

    row.eventCount++;
    if (ts) {
      if (!row.firstSeenAt || ts < row.firstSeenAt) row.firstSeenAt = ts;
      if (!row.lastSeenAt || ts > row.lastSeenAt) row.lastSeenAt = ts;
    }
    // Track the latest non-guest UID; later events overwrite earlier ones
    // (we want the *current* user of this device, not the first).
    if (userId && userId !== "guest") {
      if (
        !row.lastUserId ||
        (ts && row.lastSeenAt && ts >= row.lastSeenAt)
      ) {
        row.lastUserId = userId;
      }
    }
    if (name === "signup_completed") row.signedUp = true;
  });

  // 4. Most-recent first. Use lastSeenAt; null sorts last.
  return Array.from(buckets.values()).sort((a, b) => {
    const at = a.lastSeenAt?.getTime() ?? 0;
    const bt = b.lastSeenAt?.getTime() ?? 0;
    return bt - at;
  });
}

export interface DeviceEvent {
  id: string;
  name: string;
  userId: string | null;
  timestamp: Date | null;
  props: Record<string, unknown>;
}

/**
 * Full event timeline for a single device_id (no exclusion filtering — if
 * you've already navigated to a specific device's detail page you want to
 * see everything that happened on it, including any later excluded-user
 * events to surface "this tester later used the device").
 */
export async function getDeviceEvents(
  env: TraceEnv,
  deviceId: string,
  limit = 500
): Promise<DeviceEvent[]> {
  // Note: where + orderBy on different fields needs a composite index. To
  // avoid maintaining one for a low-traffic admin page, query by equality
  // only and sort in memory. A single device's event count is well under
  // any practical limit.
  const snap = await colRef(env, "events")
    .where("props.device_id", "==", deviceId)
    .limit(limit)
    .get();
  const events: DeviceEvent[] = snap.docs.map((d) => {
    const data = d.data();
    const props = (data.props as Record<string, unknown> | undefined) ?? {};
    return {
      id: d.id,
      name: (data.name as string | undefined) ?? "",
      userId: (data.userId as string | undefined) ?? null,
      timestamp: (data.timestamp as FirebaseFirestore.Timestamp | undefined)?.toDate?.() ?? null,
      props,
    };
  });
  events.sort((a, b) => (a.timestamp?.getTime() ?? 0) - (b.timestamp?.getTime() ?? 0));
  return events;
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
  env: TraceEnv,
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
  const since = new Date();
  since.setDate(since.getDate() - days);

  // orderBy timestamp DESC — see comment in getFunnelCounts.
  async function countEvent(name: string): Promise<number> {
    const snap = await colRef(env, "events")
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
  const failedSnap = await colRef(env, "events")
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
  env: TraceEnv,
  days = 30,
  excluded?: ExcludedSets,
  validUserIds?: Set<string>
): Promise<number> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const snap = await colRef(env, "events")
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
  env: TraceEnv,
  name: string,
  since: Date,
  excluded?: ExcludedSets,
  validUserIds?: Set<string>
): Promise<TierBreakdown> {
  const snap = await colRef(env, "events")
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
  env: TraceEnv,
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
  const since = new Date();
  since.setDate(since.getDate() - days);

  const [renewed, voluntaryChurn, involuntaryChurn, billingIssues, changed, uncanceled] =
    await Promise.all([
      tierBreakdown(env, "subscription_renewed", since, excluded, validUserIds),
      tierBreakdown(env, "subscription_canceled", since, excluded, validUserIds),
      tierBreakdown(env, "subscription_expired", since, excluded, validUserIds),
      tierBreakdown(env, "billing_issue", since, excluded, validUserIds),
      tierBreakdown(env, "subscription_changed", since, excluded, validUserIds),
      tierBreakdown(env, "subscription_uncanceled", since, excluded, validUserIds),
    ]);

  return { renewed, voluntaryChurn, involuntaryChurn, billingIssues, changed, uncanceled };
}

/**
 * Daily count of `purchase_failed` events. Lets the dashboard show a
 * sparkline so a sudden spike (e.g. a SKU misconfiguration like the
 * Premium-monthly receipt bug) is obvious at a glance.
 */
export async function getPurchaseFailuresByDay(
  env: TraceEnv,
  days = 30,
  excluded?: ExcludedSets,
  validUserIds?: Set<string>
): Promise<Array<{ date: string; count: number }>> {
  const since = new Date();
  // Shift by (days - 1) so today's bucket is included — see comment
  // on getSignupsByDay for the off-by-one this fixes.
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const snap = await colRef(env, "events")
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
