import "server-only";
import { createHash } from "node:crypto";
import * as admin from "firebase-admin";
import { col, envFromCollection, type CollectionName, type TraceEnv } from "@trace/shared";

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "trace-ai-b9cba";

/**
 * Admin SDK for the Points API routes. In production it uses the service
 * account in FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY (same variables as
 * the admin web). Locally, with those unset, it falls back to your gcloud
 * login (`gcloud auth application-default login`).
 */
function app() {
  if (!admin.apps.length) {
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
    admin.initializeApp({
      projectId: PROJECT_ID,
      credential: clientEmail && privateKey ? admin.credential.cert({ projectId: PROJECT_ID, clientEmail, privateKey }) : admin.credential.applicationDefault(),
    });
  }
  return admin.app();
}

/**
 * Which set of collections this deployment uses. Production sets
 * TRACE_ENV=prod; everything else (local dev, previews) defaults to staging
 * so testing never touches real customers.
 */
export function pointsEnv(): TraceEnv {
  return process.env.TRACE_ENV === "prod" ? "prod" : "staging";
}

export function colRef(name: CollectionName) {
  const env = pointsEnv();
  const resolved = col(env, name);
  if (envFromCollection(resolved) !== env) throw new Error(`[points colRef] env mismatch for ${resolved}`);
  return app().firestore().collection(resolved);
}

/**
 * Checks a Firebase ID token from the email-link sign-in and returns the
 * verified email. Only used to prove someone owns an address; Points keeps
 * its own session (see session.ts) so a Points sign-in never becomes a
 * session for the mobile app's account with the same email.
 */
export async function verifiedEmailFromIdToken(idToken: string): Promise<string | null> {
  try {
    const t = await app().auth().verifyIdToken(idToken);
    return t.email && t.email_verified ? t.email.toLowerCase() : null;
  } catch {
    return null;
  }
}

export const normalizeEmail = (e: string) => e.trim().toLowerCase();

/** Points user docs are keyed by a hash of the email, so ids are stable and URL-safe. */
export const userDocId = (email: string) => createHash("sha256").update(normalizeEmail(email)).digest("hex").slice(0, 32);

export const FieldValue = admin.firestore.FieldValue;
