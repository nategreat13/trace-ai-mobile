import { Router } from "express";
import * as admin from "firebase-admin";
import { getDb } from "../firebase";
import { authenticate, AuthenticatedRequest } from "../middleware/authenticate";

export const deleteAccountRoutes = Router();

/**
 * Collections that store per-user data and should be wiped when the
 * user deletes their account. Each is queried by `userId == auth.uid`
 * and every matching doc is deleted.
 *
 * Excluded on purpose:
 *   - `events` — analytics data. Orphan events get auto-filtered out of
 *     the dashboard already (see lib/analytics-queries.ts → orphan-filter
 *     logic), so leaving them preserves aggregate signal without
 *     identifying the deleted user.
 *   - `promoRedemptions` — audit trail of redemptions. Useful even after
 *     account deletion for code-level analytics.
 */
const PER_USER_COLLECTIONS = [
  "userProfiles",
  "swipeActions",
  "flightDeals",
  "dealAlerts",
];

const FIRESTORE_BATCH_LIMIT = 500;

async function deleteUserDocs(userId: string): Promise<{
  deleted: Record<string, number>;
}> {
  const db = getDb();
  const deleted: Record<string, number> = {};

  for (const collection of PER_USER_COLLECTIONS) {
    const snap = await db
      .collection(collection)
      .where("userId", "==", userId)
      .get();
    if (snap.empty) {
      deleted[collection] = 0;
      continue;
    }
    // Chunk into batches of 500 (Firestore write-batch limit).
    let count = 0;
    for (let i = 0; i < snap.docs.length; i += FIRESTORE_BATCH_LIMIT) {
      const batch = db.batch();
      const slice = snap.docs.slice(i, i + FIRESTORE_BATCH_LIMIT);
      slice.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      count += slice.length;
    }
    deleted[collection] = count;
  }
  return { deleted };
}

/**
 * POST /delete-account
 * Auth: Firebase ID token in Authorization: Bearer header.
 *
 * Server-side account deletion using the Firebase Admin SDK. Bypasses
 * the client-only `auth/requires-recent-login` guardrail because Admin
 * SDK calls aren't subject to it. Lets users delete their account
 * without re-entering their password.
 *
 * Order matters: delete Firestore data first (while the user's data
 * is still resolvable), then delete the Auth user (which invalidates
 * their session). The mobile client's auth-state listener will fire
 * shortly after and route the user back to the Landing screen.
 *
 * Returns:
 *   { ok: true, deleted: { userProfiles: 1, swipeActions: 12, ... } }
 */
deleteAccountRoutes.post(
  "/delete-account",
  authenticate,
  async (req: AuthenticatedRequest, res) => {
    const userId = req.user?.uid;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    try {
      // 1. Wipe Firestore data
      const { deleted } = await deleteUserDocs(userId);

      // 2. Delete the Auth user. This invalidates the client's ID
      //    token; the next API call will 401 and the auth-state
      //    listener will sign them out locally.
      try {
        await admin.auth().deleteUser(userId);
      } catch (err: any) {
        // If the auth user is already gone (e.g. previous attempt got
        // partway through), treat as success.
        if (err?.code === "auth/user-not-found") {
          console.warn(
            `[delete-account] Auth user ${userId} already gone; treating as success`
          );
        } else {
          throw err;
        }
      }

      console.log(
        `[delete-account] deleted user ${userId}:`,
        JSON.stringify(deleted)
      );
      res.json({ ok: true, deleted });
    } catch (err: any) {
      console.error("[delete-account] failed:", err);
      res.status(500).json({
        error: err?.message ?? "Failed to delete account",
      });
    }
  }
);
