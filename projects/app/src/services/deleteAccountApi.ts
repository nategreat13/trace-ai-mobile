import { auth } from "./firebase";
import { API_BASE_URL } from "../lib/constants";

/**
 * Calls the server's POST /delete-account endpoint to fully delete
 * the user's account. Server-side deletion bypasses Firebase's
 * `auth/requires-recent-login` guardrail (the Admin SDK isn't subject
 * to it), so the user doesn't have to re-enter their password.
 *
 * The server deletes both Firestore data and the Auth user. Once it
 * returns, the user's ID token is invalid; AuthContext's auth-state
 * listener will detect this and sign them out locally.
 */
export async function deleteAccount(): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("You need to be signed in to delete your account.");
  }
  const token = await user.getIdToken();

  const res = await fetch(`${API_BASE_URL}/delete-account`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    let message = "Could not delete account.";
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
}
