import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
  DocumentData,
  QuerySnapshot,
  Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import { col, UserProfile, DealAlert, SavedDeal } from "@trace/shared";
import { getEnv } from "../lib/env";

/**
 * A flightDeals Firestore doc as it actually exists at runtime: the
 * `SavedDeal` shape, with `id` guaranteed (we always set it from the
 * doc id), plus an optional `dateString` because some older saved
 * docs stored the source Deal's `dateString` instead of (or alongside)
 * `travelWindow`. Read-tolerant typing.
 */
export type SavedDealRecord = SavedDeal & {
  id: string;
  dateString?: string;
};

/**
 * Env-aware wrapper around `firebase/firestore`'s `collection(db, name)`.
 * Resolves to either `userProfiles` (prod) or `staging_userProfiles`
 * (staging) based on the device's current env, hydrated from
 * AsyncStorage at app startup by `initEnvFromStorage()`.
 */
function envCollection(name: Parameters<typeof col>[1]) {
  return collection(db, col(getEnv(), name));
}

/**
 * Env-aware wrapper around `doc(db, name, id)` for the top-level
 * env-prefixed collections.
 */
function envDoc(name: Parameters<typeof col>[1], id: string) {
  return doc(db, col(getEnv(), name), id);
}

// ──── User Profiles ────

export async function getUserProfile(userId: string): Promise<(UserProfile & { id: string }) | null> {
  const q = query(envCollection("userProfiles"), where("userId", "==", userId));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const docSnap = snap.docs[0];
  return { id: docSnap.id, ...docToProfile(docSnap.data()) };
}

export async function createUserProfile(data: Omit<UserProfile, "id" | "createdAt">): Promise<string> {
  const ref = await addDoc(envCollection("userProfiles"), stripUndefined({
    ...profileToDoc(data),
    createdAt: Timestamp.now(),
  }));
  return ref.id;
}

export async function updateUserProfile(docId: string, data: Partial<UserProfile>): Promise<void> {
  await updateDoc(envDoc("userProfiles", docId), stripUndefined(profileToDoc(data)));
}

export async function deleteUserProfile(docId: string): Promise<void> {
  await deleteDoc(envDoc("userProfiles", docId));
}

/** Delete all Firestore data for a user (profile, swipes, saved deals, alerts). */
export async function deleteAllUserData(userId: string, profileDocId?: string): Promise<void> {
  // Delete all user profile documents (handles duplicates)
  const profileSnap = await getDocs(
    query(envCollection("userProfiles"), where("userId", "==", userId))
  );
  await Promise.all(profileSnap.docs.map((d) => deleteDoc(d.ref)));

  // Delete swipe actions
  const swipeSnap = await getDocs(
    query(envCollection("swipeActions"), where("userId", "==", userId))
  );
  await Promise.all(swipeSnap.docs.map((d) => deleteDoc(d.ref)));

  // Delete saved flight deals
  const dealsSnap = await getDocs(
    query(envCollection("flightDeals"), where("userId", "==", userId))
  );
  await Promise.all(dealsSnap.docs.map((d) => deleteDoc(d.ref)));

  // Delete deal alerts
  const alertsSnap = await getDocs(
    query(envCollection("dealAlerts"), where("userId", "==", userId))
  );
  await Promise.all(alertsSnap.docs.map((d) => deleteDoc(d.ref)));
}

export function subscribeToProfile(
  userId: string,
  callback: (profile: (UserProfile & { id: string }) | null) => void
): Unsubscribe {
  const q = query(envCollection("userProfiles"), where("userId", "==", userId));
  return onSnapshot(q, (snap) => {
    if (snap.empty) {
      callback(null);
    } else {
      const d = snap.docs[0];
      callback({ id: d.id, ...docToProfile(d.data()) });
    }
  });
}

// ──── Swipe Actions ────

export async function createSwipeAction(data: {
  userId: string;
  dealId: string;
  action: string;
  dealType: string | null;
  destination: string;
  continent: string | null;
  price: number;
  domesticOrInternational: string | null;
}): Promise<string> {
  const ref = await addDoc(envCollection("swipeActions"), stripUndefined({
    ...data,
    createdAt: Timestamp.now(),
  }));
  return ref.id;
}

export async function getSwipeActions(userId: string, maxResults = 500) {
  const q = query(
    envCollection("swipeActions"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
    limit(maxResults)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function deleteSwipeAction(docId: string): Promise<void> {
  await deleteDoc(envDoc("swipeActions", docId));
}

export function subscribeToSwipeActions(
  userId: string,
  callback: (swipes: any[]) => void
): Unsubscribe {
  const q = query(
    envCollection("swipeActions"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

// ──── Flight Deals (saved) ────

export async function saveDeal(data: Record<string, any>): Promise<string> {
  const ref = await addDoc(envCollection("flightDeals"), stripUndefined({
    ...data,
    createdAt: Timestamp.now(),
  }));
  return ref.id;
}

export async function getSavedDeals(userId: string): Promise<SavedDealRecord[]> {
  const q = query(
    envCollection("flightDeals"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  // The spread of `d.data()` (DocumentData = { [k: string]: any })
  // loses its index signature in TS unless we widen explicitly.
  // Casting to SavedDealRecord here keeps field access typed at
  // every call site instead of producing the bare `{ id: string }`
  // TS would otherwise infer.
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as SavedDealRecord));
}

export async function deleteSavedDeal(docId: string): Promise<void> {
  await deleteDoc(envDoc("flightDeals", docId));
}

export function subscribeToSavedDeals(
  userId: string,
  callback: (deals: SavedDealRecord[]) => void
): Unsubscribe {
  const q = query(
    envCollection("flightDeals"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as SavedDealRecord)));
  });
}

// ──── Deal Alerts ────

export async function createDealAlert(data: Omit<DealAlert, "id" | "createdAt">): Promise<string> {
  const ref = await addDoc(envCollection("dealAlerts"), stripUndefined({
    ...data,
    createdAt: Timestamp.now(),
  }));
  return ref.id;
}

export async function getDealAlerts(userId: string) {
  const q = query(envCollection("dealAlerts"), where("userId", "==", userId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as (DealAlert & { id: string })[];
}

export async function updateDealAlert(docId: string, data: Partial<DealAlert>): Promise<void> {
  await updateDoc(envDoc("dealAlerts", docId), stripUndefined(data as Record<string, any>));
}

export async function deleteDealAlert(docId: string): Promise<void> {
  await deleteDoc(envDoc("dealAlerts", docId));
}

// ──── Helpers ────

/** Replace undefined values with null so Firestore doesn't reject the write. */
function stripUndefined(obj: Record<string, any>): Record<string, any> {
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    clean[key] = value === undefined ? null : value;
  }
  return clean;
}

function profileToDoc(data: Partial<UserProfile>): Record<string, any> {
  const d: Record<string, any> = { ...data };
  if (d.trialEndDate instanceof Date) {
    d.trialEndDate = Timestamp.fromDate(d.trialEndDate);
  }
  if (d.createdAt instanceof Date) {
    d.createdAt = Timestamp.fromDate(d.createdAt);
  }
  return d;
}

function docToProfile(data: DocumentData): UserProfile {
  return {
    ...data,
    trialEndDate: data.trialEndDate?.toDate?.() ?? null,
    createdAt: data.createdAt?.toDate?.() ?? new Date(),
  } as UserProfile;
}
