import * as admin from "firebase-admin";
import { col, envFromCollection, type CollectionName } from "@trace/shared";
import { getEnv } from "./env";

// Pinned to match `.firebaserc`. Passing it explicitly avoids the
// "Unable to detect a Project Id in the current environment" error
// that bites every new local-dev setup, where the developer has ADC
// from `gcloud auth application-default login` but no
// GOOGLE_CLOUD_PROJECT env var. In production (Cloud Run) the
// runtime sets GOOGLE_CLOUD_PROJECT automatically and would resolve
// to the same value — passing it here is a no-op there.
const FIREBASE_PROJECT_ID = "trace-ai-b9cba";

// Cached once per instance. We deliberately do NOT re-derive the app
// from `admin.apps` / `admin.app()` on every call: under the esbuild-
// bundled CJS interop, `admin.apps.length` was observed truthy while
// `admin.app()` still threw "The default Firebase app does not exist"
// — which broke `colRef()` inside the signup trigger (the Slack
// "user #0" symptom). Initializing once, catching the duplicate-app
// error, and caching the result sidesteps that flaky registry lookup
// entirely — every call after the first is just a cache read.
let cachedApp: ReturnType<typeof admin.initializeApp> | null = null;

function getApp(): ReturnType<typeof admin.initializeApp> {
  if (cachedApp) return cachedApp;
  try {
    cachedApp = admin.initializeApp({
      projectId: FIREBASE_PROJECT_ID,
      credential: admin.credential.applicationDefault(),
    });
  } catch (err: any) {
    // app/duplicate-app → the default app already exists; reuse it.
    if (err?.code === "app/duplicate-app") {
      cachedApp = admin.app();
    } else {
      throw err;
    }
  }
  return cachedApp;
}

export function getAuth() {
  return getApp().auth();
}

export function getDb() {
  return getApp().firestore();
}

/**
 * Env-aware top-level CollectionReference accessor. Use everywhere
 * instead of `getDb().collection("userProfiles")`.
 *
 * Reads `getEnv()` from the per-request AsyncLocalStorage context
 * (see `env.ts`). If you call this outside a `runWithEnv` scope it
 * resolves to "prod" — the safe default.
 *
 * The runtime assertion below catches the worst-case bug: an
 * accidental write to the prod collection from inside a staging
 * request. If we ever resolve to a prod name while the env is
 * staging (or vice versa), throw loudly — better a 500 than corrupted
 * prod data.
 */
export function colRef(
  name: CollectionName
): FirebaseFirestore.CollectionReference {
  const env = getEnv();
  const resolved = col(env, name);
  const inferredEnv = envFromCollection(resolved);
  if (inferredEnv !== env) {
    throw new Error(
      `[firebase.colRef] env mismatch: requested env=${env}, ` +
        `but resolved name "${resolved}" maps to env=${inferredEnv}. ` +
        `This indicates a bug in @trace/shared/collections.`
    );
  }
  return getDb().collection(resolved);
}
