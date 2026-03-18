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
import { UserProfile } from "../types/profile";
import { DealAlert } from "../types/alert";

// ──── User Profiles ────

export async function getUserProfile(userId: string): Promise<(UserProfile & { id: string }) | null> {
  const q = query(collection(db, "userProfiles"), where("userId", "==", userId));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const docSnap = snap.docs[0];
  return { id: docSnap.id, ...docToProfile(docSnap.data()) };
}

export async function createUserProfile(data: Omit<UserProfile, "id" | "createdAt">): Promise<string> {
  const ref = await addDoc(collection(db, "userProfiles"), {
    ...profileToDoc(data),
    createdAt: Timestamp.now(),
  });
  return ref.id;
}

export async function updateUserProfile(docId: string, data: Partial<UserProfile>): Promise<void> {
  await updateDoc(doc(db, "userProfiles", docId), profileToDoc(data));
}

export async function deleteUserProfile(docId: string): Promise<void> {
  await deleteDoc(doc(db, "userProfiles", docId));
}

export function subscribeToProfile(
  userId: string,
  callback: (profile: (UserProfile & { id: string }) | null) => void
): Unsubscribe {
  const q = query(collection(db, "userProfiles"), where("userId", "==", userId));
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
  const ref = await addDoc(collection(db, "swipeActions"), {
    ...data,
    createdAt: Timestamp.now(),
  });
  return ref.id;
}

export async function getSwipeActions(userId: string, maxResults = 500) {
  const q = query(
    collection(db, "swipeActions"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
    limit(maxResults)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function deleteSwipeAction(docId: string): Promise<void> {
  await deleteDoc(doc(db, "swipeActions", docId));
}

export function subscribeToSwipeActions(
  userId: string,
  callback: (swipes: any[]) => void
): Unsubscribe {
  const q = query(
    collection(db, "swipeActions"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

// ──── Flight Deals (saved) ────

export async function saveDeal(data: Record<string, any>): Promise<string> {
  const ref = await addDoc(collection(db, "flightDeals"), {
    ...data,
    createdAt: Timestamp.now(),
  });
  return ref.id;
}

export async function getSavedDeals(userId: string) {
  const q = query(
    collection(db, "flightDeals"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function deleteSavedDeal(docId: string): Promise<void> {
  await deleteDoc(doc(db, "flightDeals", docId));
}

export function subscribeToSavedDeals(
  userId: string,
  callback: (deals: any[]) => void
): Unsubscribe {
  const q = query(
    collection(db, "flightDeals"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

// ──── Deal Alerts ────

export async function createDealAlert(data: Omit<DealAlert, "id" | "createdAt">): Promise<string> {
  const ref = await addDoc(collection(db, "dealAlerts"), {
    ...data,
    createdAt: Timestamp.now(),
  });
  return ref.id;
}

export async function getDealAlerts(userId: string) {
  const q = query(collection(db, "dealAlerts"), where("userId", "==", userId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as (DealAlert & { id: string })[];
}

export async function updateDealAlert(docId: string, data: Partial<DealAlert>): Promise<void> {
  await updateDoc(doc(db, "dealAlerts", docId), data as DocumentData);
}

export async function deleteDealAlert(docId: string): Promise<void> {
  await deleteDoc(doc(db, "dealAlerts", docId));
}

// ──── Helpers ────

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
