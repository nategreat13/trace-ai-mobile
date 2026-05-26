import * as admin from "firebase-admin";
import { col, envFromCollection, type CollectionName, type TraceEnv } from "@trace/shared";

function getApp() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });
  }
  return admin.app();
}

export function getDb() {
  return getApp().firestore();
}

/**
 * Env-aware Firestore collection reference for the admin web project.
 *
 * Every `lib/*.ts` data-fetching function takes `env: TraceEnv` as its
 * first argument, then calls `colRef(env, "foo")` to get the right
 * Firestore collection. Pages resolve `env` once via `getAdminEnv()`
 * (reads the admin's cookie) and thread it down.
 *
 * **Stripe / customer-facing routes** (subscribe / webhook / cancel /
 * switch-plan / preview-switch) MUST always pass `"prod"` regardless of
 * the admin cookie — real customers paying real money can't be routed
 * to staging by an admin's accidental toggle. Each such file passes
 * `"prod"` explicitly with a comment explaining why.
 *
 * The runtime assertion catches the worst-case bug: if `col()` ever
 * resolved a name that doesn't match its env, throw loudly. Better a
 * 500 than corrupted prod data.
 */
export function colRef(
  env: TraceEnv,
  name: CollectionName
): FirebaseFirestore.CollectionReference {
  const resolved = col(env, name);
  const inferredEnv = envFromCollection(resolved);
  if (inferredEnv !== env) {
    throw new Error(
      `[firebase-admin.colRef] env mismatch: requested env=${env}, ` +
        `but resolved name "${resolved}" maps to env=${inferredEnv}. ` +
        `This indicates a bug in @trace/shared/collections.`
    );
  }
  return getDb().collection(resolved);
}
