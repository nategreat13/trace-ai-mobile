import "server-only";
import type { Membership } from "../store";
import { ACTIVE_STATUSES, type SyncedState } from "../sync";
import { colRef, FieldValue, normalizeEmail, userDocId } from "./firebase";

/**
 * pointsUsers/{hash(email)}:
 *   email, state (SyncedState), member (Membership | null), verified,
 *   stripeCustomerId, stripeSubscriptionId, stripeStatus, mergedInto,
 *   createdAt, updatedAt
 */
export interface PointsUserDoc {
  email: string;
  /** They proved they own the email (Google or an email link), not just typed it at checkout. */
  verified?: boolean;
  /** This account's membership moved to another email when they signed in with it. */
  mergedInto?: string;
  state?: SyncedState;
  member?: Membership | null;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripeStatus?: string;
  /** scrypt hash (password.ts). Set only from a signed-in session; never moves with mergeAccount. */
  passwordHash?: string;
  /** Wrong-password count since the last success, and when sign-in reopens after too many. */
  passwordFails?: number;
  passwordLockedUntil?: number;
}

export const userRef = (email: string) => colRef("pointsUsers").doc(userDocId(email));

export async function getUser(email: string): Promise<PointsUserDoc | null> {
  const snap = await userRef(email).get();
  return snap.exists ? (snap.data() as PointsUserDoc) : null;
}

/** Creates the user doc if it's missing. Returns true when it was created just now. */
export async function ensureUser(email: string): Promise<boolean> {
  const ref = userRef(email);
  return ref.firestore.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) return false;
    tx.set(ref, { email: normalizeEmail(email), createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    return true;
  });
}

export async function markVerified(email: string) {
  await userRef(email).set({ email: normalizeEmail(email), verified: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}

/**
 * Someone paid as `from` (signed in on this device) and then signed in with a
 * different verified email `to`, usually their Google account. Move the
 * membership, Stripe link and saved state to `to`, unless `to` already has a
 * membership of its own. Returns the Stripe customer to re-point, if any.
 */
export async function mergeAccount(from: string, to: string): Promise<string | null> {
  const a = userRef(from);
  const b = userRef(to);
  return a.firestore.runTransaction(async (tx) => {
    const [sa, sb] = await Promise.all([tx.get(a), tx.get(b)]);
    const src = sa.data() as PointsUserDoc | undefined;
    const dst = sb.data() as PointsUserDoc | undefined;
    // Only the unverified account checkout just made moves; switching between verified accounts doesn't.
    if (!src || src.verified || src.mergedInto || dst?.member) return null;
    tx.set(
      b,
      {
        email: normalizeEmail(to),
        member: src.member ?? null,
        stripeCustomerId: src.stripeCustomerId ?? null,
        stripeSubscriptionId: src.stripeSubscriptionId ?? null,
        stripeStatus: src.stripeStatus ?? null,
        ...(dst?.state ? {} : src.state ? { state: { ...src.state, email: normalizeEmail(to) } } : {}),
        updatedAt: FieldValue.serverTimestamp(),
        ...(dst ? {} : { createdAt: FieldValue.serverTimestamp() }),
      },
      { merge: true },
    );
    // The old doc keeps a pointer but no longer answers to the Stripe customer.
    tx.set(a, { member: null, stripeCustomerId: null, mergedInto: normalizeEmail(to), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return src.stripeCustomerId ?? null;
  });
}

export async function setPasswordHash(email: string, passwordHash: string) {
  await userRef(email).set(
    { email: normalizeEmail(email), passwordHash, passwordFails: 0, passwordLockedUntil: 0, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
}

/** Too many wrong passwords in a row locks password sign-in for a while (the email link still works). */
const MAX_FAILS = 8;
const LOCK_MS = 15 * 60 * 1000;

export async function recordPasswordResult(email: string, ok: boolean, fails: number) {
  const next = ok ? 0 : fails + 1;
  await userRef(email).set(
    { passwordFails: next >= MAX_FAILS ? 0 : next, passwordLockedUntil: next >= MAX_FAILS ? Date.now() + LOCK_MS : 0 },
    { merge: true },
  );
}

export async function saveState(email: string, state: SyncedState) {
  await userRef(email).set({ email: normalizeEmail(email), state, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}

export interface StripeMembership {
  email: string;
  plan: Membership["plan"];
  offer?: string;
  status: string;
  trialEnd: number | null;
  customer: string;
  subscription: string;
}

/** Records a subscription from Checkout or the webhook. Idempotent. */
export async function recordSubscription(s: StripeMembership) {
  const active = ACTIVE_STATUSES.includes(s.status);
  const ref = userRef(s.email);
  const prev = (await ref.get()).data() as PointsUserDoc | undefined;
  const member: Membership | null = active
    ? {
        plan: s.plan,
        ...(s.offer ? { offer: s.offer } : {}),
        startedAt: prev?.member?.startedAt ?? new Date().toISOString(),
        trialEndsAt: new Date((s.trialEnd ?? Date.now() / 1000) * 1000).toISOString(),
        testMode: false,
        status: s.status,
        stripeCustomerId: s.customer,
        stripeSubscriptionId: s.subscription,
      }
    : null;
  await ref.set(
    {
      email: normalizeEmail(s.email),
      member,
      stripeCustomerId: s.customer,
      stripeSubscriptionId: s.subscription,
      stripeStatus: s.status,
      updatedAt: FieldValue.serverTimestamp(),
      ...(prev ? {} : { createdAt: FieldValue.serverTimestamp() }),
    },
    { merge: true },
  );
}

/** Webhook updates arrive by Stripe customer; find the member they belong to. */
export async function emailForCustomer(customer: string): Promise<string | null> {
  const q = await colRef("pointsUsers").where("stripeCustomerId", "==", customer).limit(1).get();
  return q.empty ? null : ((q.docs[0].data() as PointsUserDoc).email ?? null);
}
