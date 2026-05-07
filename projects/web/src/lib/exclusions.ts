import { getDb } from "./firebase-admin";
import type { Firestore } from "firebase-admin/firestore";

/**
 * Analytics exclusions — internal / test / employee accounts that should
 * not skew dashboard metrics. Stored in Firestore so the list can be
 * edited from the admin page without code deploys.
 *
 * Schema (collection: analyticsExclusions):
 *   {
 *     email?: string         // canonical identifier when known
 *     userIds: string[]      // resolved at add-time; can be re-resolved
 *                            // from the admin UI if the user re-signs up
 *     note?: string          // optional human label, e.g. "QA bot"
 *     addedAt: Timestamp
 *   }
 *
 * Email is preferred but optional — if the user signed up under a
 * different email or you only know their UID, we accept the UID directly.
 */

export interface ExclusionDoc {
  id: string;
  email: string | null;
  userIds: string[];
  note: string | null;
  addedAt: Date | null;
}

export interface ExcludedSets {
  userIds: Set<string>;
  emails: Set<string>;
}

/**
 * Returns all excluded userIds and emails as sets, suitable for filtering
 * query results in memory. Called once per dashboard page load — pass the
 * result through to each query function so they can post-filter.
 */
export async function getExcludedSets(): Promise<ExcludedSets> {
  const db = getDb();
  const snap = await db.collection("analyticsExclusions").get();
  const userIds = new Set<string>();
  const emails = new Set<string>();
  snap.forEach((doc) => {
    const data = doc.data();
    const email = (data.email as string | undefined)?.toLowerCase();
    if (email) emails.add(email);
    const ids = (data.userIds as string[] | undefined) ?? [];
    for (const uid of ids) userIds.add(uid);
  });
  return { userIds, emails };
}

/**
 * Loads the full list of exclusion docs for the admin UI.
 */
export async function listExclusions(): Promise<ExclusionDoc[]> {
  const db = getDb();
  const snap = await db
    .collection("analyticsExclusions")
    .orderBy("addedAt", "desc")
    .get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      email: (data.email as string | null) ?? null,
      userIds: (data.userIds as string[] | undefined) ?? [],
      note: (data.note as string | null) ?? null,
      addedAt: data.addedAt?.toDate?.() ?? null,
    };
  });
}

/**
 * Looks up all userProfile docs matching the given email and returns
 * their userIds. There can be more than one — some accounts have
 * duplicate userProfile docs from older signup bugs, and the email
 * might also have been used by multiple Firebase Auth users over time.
 */
export async function resolveUserIdsForEmail(
  db: Firestore,
  email: string
): Promise<string[]> {
  const snap = await db
    .collection("userProfiles")
    .where("email", "==", email.toLowerCase())
    .select("userId")
    .get();
  const ids: string[] = [];
  snap.forEach((doc) => {
    const uid = doc.data().userId as string | undefined;
    if (uid) ids.push(uid);
  });
  // Deduplicate
  return Array.from(new Set(ids));
}

/**
 * Add an exclusion by email. Resolves matching userIds at add-time so
 * dashboard queries can filter immediately — no second round-trip.
 *
 * If the email isn't found in userProfiles yet, the exclusion is still
 * recorded (with empty userIds) so the user gets excluded as soon as
 * they sign up. Re-resolution can be done via the admin UI.
 */
export async function addExclusionByEmail(
  email: string,
  note?: string
): Promise<void> {
  const db = getDb();
  const normalized = email.trim().toLowerCase();
  if (!normalized) throw new Error("Email is required");

  const userIds = await resolveUserIdsForEmail(db, normalized);
  await db.collection("analyticsExclusions").add({
    email: normalized,
    userIds,
    note: note?.trim() || null,
    addedAt: new Date(),
  });
}

/**
 * Add an exclusion by userId directly. Useful when the email is unknown
 * or you only have the UID from a console log.
 */
export async function addExclusionByUserId(
  userId: string,
  note?: string
): Promise<void> {
  const db = getDb();
  const trimmed = userId.trim();
  if (!trimmed) throw new Error("User ID is required");

  // Try to fetch the email so the doc is more readable in the UI.
  let email: string | null = null;
  try {
    const snap = await db
      .collection("userProfiles")
      .where("userId", "==", trimmed)
      .select("email")
      .limit(1)
      .get();
    if (!snap.empty) {
      email = (snap.docs[0].data().email as string | undefined) ?? null;
    }
  } catch {
    /* best-effort lookup */
  }

  await db.collection("analyticsExclusions").add({
    email,
    userIds: [trimmed],
    note: note?.trim() || null,
    addedAt: new Date(),
  });
}

export async function removeExclusion(docId: string): Promise<void> {
  const db = getDb();
  await db.collection("analyticsExclusions").doc(docId).delete();
}

/**
 * Returns the set of every userId currently present in `userProfiles`.
 *
 * Used by the dashboard to filter out "orphan" events — events whose
 * authoring userId no longer has a userProfile, typically because the
 * user deleted their account. Those events stay in the database (we
 * don't bulk-delete on account deletion) but they shouldn't appear on
 * the live dashboard.
 *
 * Scale note: returns N docs where N = total userProfiles. Cheap up to
 * ~100k users; past that, switch to a maintained counter set.
 */
export async function getValidUserIds(): Promise<Set<string>> {
  const db = getDb();
  const snap = await db.collection("userProfiles").select("userId").get();
  const ids = new Set<string>();
  snap.forEach((doc) => {
    const uid = doc.data().userId as string | undefined;
    if (uid) ids.add(uid);
  });
  return ids;
}

/**
 * Re-resolve userIds for every email-based exclusion. Useful if a user
 * was excluded before they signed up, or if an account got new
 * userProfile docs after sign-in/sign-up flow changes.
 */
export async function refreshAllUserIds(): Promise<{ updated: number }> {
  const db = getDb();
  const snap = await db.collection("analyticsExclusions").get();
  let updated = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    const email = data.email as string | undefined;
    if (!email) continue; // userId-only exclusions don't have an email to resolve
    const fresh = await resolveUserIdsForEmail(db, email);
    const prev = (data.userIds as string[] | undefined) ?? [];
    const same =
      fresh.length === prev.length && fresh.every((id) => prev.includes(id));
    if (!same) {
      await doc.ref.update({ userIds: fresh });
      updated++;
    }
  }
  return { updated };
}
