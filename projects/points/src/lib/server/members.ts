import "server-only";
import type { Membership } from "../store";
import { ACTIVE_STATUSES, type SyncedState } from "../sync";
import { colRef, FieldValue, normalizeEmail, userDocId } from "./firebase";

/**
 * pointsUsers/{hash(email)}:
 *   email, state (SyncedState), member (Membership | null),
 *   stripeCustomerId, stripeSubscriptionId, stripeStatus, createdAt, updatedAt
 */
export interface PointsUserDoc {
  email: string;
  state?: SyncedState;
  member?: Membership | null;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripeStatus?: string;
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

export async function saveState(email: string, state: SyncedState) {
  await userRef(email).set({ email: normalizeEmail(email), state, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}

export interface StripeMembership {
  email: string;
  plan: Membership["plan"];
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
