import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  deleteUser,
  updateProfile,
  User,
} from "firebase/auth";
import { auth } from "./firebase";

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
