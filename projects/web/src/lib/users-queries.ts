import { getDb } from "./firebase-admin";
import type { ExcludedSets } from "./exclusions";

export interface UserRow {
  /** Firestore docId — present in case multiple userProfile docs share a userId */
  id: string;
  /** Firebase Auth UID — primary identifier we use everywhere */
  userId: string;
  email: string;
  displayName: string | null;
  homeAirport: string | null;
  subscriptionStatus: string;
  trialEndDate: Date | null;
  createdAt: Date | null;
  lastSeenAt: Date | null;
  firstPurchaseAt: Date | null;
  lifetimeRevenueCents: number;
  country: string | null;
  firstPlatform: string | null;
  excluded: boolean;
}

/**
 * Returns all userProfiles for the admin Users list. At small scale we
 * just fetch every doc and filter in memory; the query is bounded by the
 * userProfiles collection size. If/when this exceeds ~10k users, switch
 * to server-side pagination + an Algolia/Typesense index for substring
 * email search.
 */
export async function listUsers(opts: {
  search?: string;
  limit?: number;
  excluded?: ExcludedSets;
} = {}): Promise<{ rows: UserRow[]; total: number }> {
  const db = getDb();
  const limit = opts.limit ?? 200;
  const search = opts.search?.trim().toLowerCase();

  const snap = await db
    .collection("userProfiles")
    .select(
      "userId",
      "email",
      "displayName",
      "homeAirport",
      "subscriptionStatus",
      "trialEndDate",
      "createdAt",
      "lastSeenAt",
      "firstPurchaseAt",
      "lifetimeRevenueCents",
      "country",
      "firstPlatform"
    )
    .get();

  const all: UserRow[] = [];
  snap.forEach((doc) => {
    const data = doc.data();
    const email = (data.email as string | undefined) ?? "";
    const displayName = (data.displayName as string | undefined) ?? null;
    const userId = (data.userId as string | undefined) ?? "";
    const excluded =
      (opts.excluded?.userIds.has(userId) ?? false) ||
      (email && opts.excluded?.emails.has(email.toLowerCase())) ||
      false;
    all.push({
      id: doc.id,
      userId,
      email,
      displayName,
      homeAirport: (data.homeAirport as string | undefined) ?? null,
      subscriptionStatus: (data.subscriptionStatus as string | undefined) ?? "free",
      trialEndDate: (data.trialEndDate as any)?.toDate?.() ?? null,
      createdAt: (data.createdAt as any)?.toDate?.() ?? null,
      lastSeenAt: (data.lastSeenAt as any)?.toDate?.() ?? null,
      firstPurchaseAt: (data.firstPurchaseAt as any)?.toDate?.() ?? null,
      lifetimeRevenueCents: (data.lifetimeRevenueCents as number | undefined) ?? 0,
      country: (data.country as string | undefined) ?? null,
      firstPlatform: (data.firstPlatform as string | undefined) ?? null,
      excluded,
    });
  });

  const filtered = search
    ? all.filter(
        (r) =>
          r.email.toLowerCase().includes(search) ||
          (r.displayName ?? "").toLowerCase().includes(search) ||
          r.userId.toLowerCase().includes(search) ||
          r.id.toLowerCase().includes(search)
      )
    : all;

  // Sort by createdAt desc (newest first)
  filtered.sort((a, b) => {
    const ta = a.createdAt?.getTime() ?? 0;
    const tb = b.createdAt?.getTime() ?? 0;
    return tb - ta;
  });

  return {
    rows: filtered.slice(0, limit),
    total: filtered.length,
  };
}

export interface UserDetail extends UserRow {
  /** Raw profile doc (everything else not in UserRow) */
  raw: Record<string, unknown>;
  swipeCount: number;
  streakDays: number;
  dealHunterLevel: number;
  badges: string[];
  travelPersonality: string | null;
  destinationPreference: string | null;
  dealTypes: string[];
  travelTimeframe: string[];
  firstAppVersion: string | null;
  firstSeenAt: Date | null;
  lastPurchaseAt: Date | null;
  everUsedFreeTrial: boolean;
  /** Empty if the user was deleted */
  exists: boolean;
}

/**
 * Returns the detail record for a given userId. If the userProfile no
 * longer exists (deleted account), returns a minimal record so we can
 * still render the page from event data. Picks the most recently
 * created userProfile if there are duplicates.
 */
export async function getUserDetail(userId: string): Promise<UserDetail | null> {
  if (!userId) return null;
  const db = getDb();
  const snap = await db
    .collection("userProfiles")
    .where("userId", "==", userId)
    .get();

  if (snap.empty) {
    // Deleted account — fabricate a minimal record from the userId alone.
    return {
      id: "",
      userId,
      email: "",
      displayName: null,
      homeAirport: null,
      subscriptionStatus: "deleted",
      trialEndDate: null,
      createdAt: null,
      lastSeenAt: null,
      firstPurchaseAt: null,
      lifetimeRevenueCents: 0,
      country: null,
      firstPlatform: null,
      excluded: false,
      raw: {},
      swipeCount: 0,
      streakDays: 0,
      dealHunterLevel: 0,
      badges: [],
      travelPersonality: null,
      destinationPreference: null,
      dealTypes: [],
      travelTimeframe: [],
      firstAppVersion: null,
      firstSeenAt: null,
      lastPurchaseAt: null,
      everUsedFreeTrial: false,
      exists: false,
    };
  }

  // Pick most recent profile doc (in case of duplicates from past bugs)
  const docs = snap.docs.slice().sort((a, b) => {
    const ta = (a.data().createdAt as any)?.toDate?.()?.getTime() ?? 0;
    const tb = (b.data().createdAt as any)?.toDate?.()?.getTime() ?? 0;
    return tb - ta;
  });
  const doc = docs[0];
  const data = doc.data();

  return {
    id: doc.id,
    userId,
    email: (data.email as string | undefined) ?? "",
    displayName: (data.displayName as string | undefined) ?? null,
    homeAirport: (data.homeAirport as string | undefined) ?? null,
    subscriptionStatus: (data.subscriptionStatus as string | undefined) ?? "free",
    trialEndDate: (data.trialEndDate as any)?.toDate?.() ?? null,
    createdAt: (data.createdAt as any)?.toDate?.() ?? null,
    lastSeenAt: (data.lastSeenAt as any)?.toDate?.() ?? null,
    firstPurchaseAt: (data.firstPurchaseAt as any)?.toDate?.() ?? null,
    lifetimeRevenueCents: (data.lifetimeRevenueCents as number | undefined) ?? 0,
    country: (data.country as string | undefined) ?? null,
    firstPlatform: (data.firstPlatform as string | undefined) ?? null,
    excluded: false, // computed at page level by the caller
    raw: data as Record<string, unknown>,
    swipeCount: (data.swipeCount as number | undefined) ?? 0,
    streakDays: (data.streakDays as number | undefined) ?? 0,
    dealHunterLevel: (data.dealHunterLevel as number | undefined) ?? 0,
    badges: (data.badges as string[] | undefined) ?? [],
    travelPersonality: (data.travelPersonality as string | undefined) ?? null,
    destinationPreference: (data.destinationPreference as string | undefined) ?? null,
    dealTypes: (data.dealTypes as string[] | undefined) ?? [],
    travelTimeframe: (data.travelTimeframe as string[] | undefined) ?? [],
    firstAppVersion: (data.firstAppVersion as string | undefined) ?? null,
    firstSeenAt: (data.firstSeenAt as any)?.toDate?.() ?? null,
    lastPurchaseAt: (data.lastPurchaseAt as any)?.toDate?.() ?? null,
    everUsedFreeTrial: Boolean(data.everUsedFreeTrial),
    exists: true,
  };
}

export interface UserEvent {
  id: string;
  name: string;
  timestamp: Date | null;
  source: string | null;
  props: Record<string, unknown>;
}

/**
 * Recent events for a single user, newest first. Capped to keep page
 * loads fast — increase the limit param if you need a deeper history.
 */
export async function getUserEvents(
  userId: string,
  limit = 100
): Promise<UserEvent[]> {
  if (!userId) return [];
  const db = getDb();
  const snap = await db
    .collection("events")
    .where("userId", "==", userId)
    .orderBy("timestamp", "desc")
    .limit(limit)
    .get();

  return snap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      name: (data.name as string | undefined) ?? "(unknown)",
      timestamp: (data.timestamp as any)?.toDate?.() ?? null,
      source: (data.source as string | undefined) ?? null,
      props: (data.props ?? {}) as Record<string, unknown>,
    };
  });
}

/**
 * Counts of saved deals + active alerts for the user (cheap aggregates
 * for the detail page header stats).
 */
export async function getUserCollectionCounts(userId: string): Promise<{
  savedDeals: number;
  alerts: number;
}> {
  if (!userId) return { savedDeals: 0, alerts: 0 };
  const db = getDb();
  const [savedSnap, alertsSnap] = await Promise.all([
    db.collection("flightDeals").where("userId", "==", userId).count().get(),
    db.collection("dealAlerts").where("userId", "==", userId).count().get(),
  ]);
  return {
    savedDeals: savedSnap.data().count,
    alerts: alertsSnap.data().count,
  };
}
