import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInAnonymously,
  linkWithCredential,
  EmailAuthProvider,
  signOut,
  deleteUser,
  updateProfile,
  User,
} from "firebase/auth";
import { auth } from "./firebase";

/**
 * Begin an anonymous session so onboarding can run before we ask who they are.
 *
 * Account creation used to be the second screen in the app: you gave Trace an
 * email and invented a password before you had seen a single fare. That is the
 * highest-friction request we make, asked at the lowest-motivation moment, and
 * everyone who declined it never reached the demo, the feed or the paywall.
 *
 * Anonymous sessions let the whole funnel run first. The uid is real from the
 * start, so analytics, the deal fetch and RevenueCat all key off it normally,
 * and `linkEmailPassword` later upgrades that same uid in place rather than
 * creating a second account — nothing the user did along the way is orphaned.
 */
export async function startAnonymousSession(): Promise<User> {
  const cred = await signInAnonymously(auth);
  return cred.user;
}

/**
 * Turn the current anonymous session into a permanent email/password account,
 * keeping the uid. Safe to call on an already-permanent user (no-op).
 *
 * Throws Firebase's own errors — notably `auth/email-already-in-use`, which
 * means this person already has an account. That case can't be auto-resolved
 * here: signing them in would discard the answers they just gave, so the
 * caller has to decide what to tell them.
 */
export async function linkEmailPassword(
  email: string,
  password: string,
  displayName?: string,
): Promise<User> {
  const current = auth.currentUser;
  if (!current) throw new Error("No session to upgrade.");
  if (!current.isAnonymous) return current;
  const credential = EmailAuthProvider.credential(email, password);
  const { user } = await linkWithCredential(current, credential);
  if (displayName) {
    await updateProfile(user, { displayName }).catch(() => {});
  }
  return user;
}

export async function login(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function signup(
  email: string,
  password: string,
  displayName?: string
): Promise<User> {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName) {
    await updateProfile(cred.user, { displayName });
  }
  return cred.user;
}

export async function logout(): Promise<void> {
  await signOut(auth);
}

/**
 * Send a password-reset email through Firebase Auth's built-in flow.
 * Firebase's hosted reset page handles the new-password entry; the
 * email arrives from no-reply@<project>.firebaseapp.com.
 *
 * Throws on invalid email format. Treats "user-not-found" as success
 * to avoid leaking which emails are registered (standard practice).
 */
export async function requestPasswordReset(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email.trim());
  } catch (err: any) {
    // Don't reveal whether the email exists — return silently for that one.
    if (err?.code === "auth/user-not-found") return;
    throw err;
  }
}

export function getCurrentUser(): User | null {
  return auth.currentUser;
}

export async function deleteAuthUser(): Promise<void> {
  if (auth.currentUser) {
    await deleteUser(auth.currentUser);
  }
}

export async function updateUserProfile(updates: {
  displayName?: string;
  photoURL?: string;
}): Promise<void> {
  if (auth.currentUser) {
    await updateProfile(auth.currentUser, updates);
  }
}
