import { API_BASE_URL } from "../lib/constants";
import { auth } from "./firebase";

interface TrackSignupParams {
  userId: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  country?: string | null;
}

/**
 * Fire-and-forget POST to /track-signup so the server can forward a
 * Meta CAPI `CompleteRegistration` event with the user's hashed PII and
 * (server-side) client IP + user-agent.
 *
 * Called right after `createUserWithEmailAndPassword` (or any other
 * Firebase Auth signup path) resolves. The server endpoint requires
 * a Bearer ID token — we pull it from the current Firebase user.
 *
 * Failures are logged and swallowed. The user already has a real
 * account; we never want to surface a CAPI-fan-out error to them.
 */
export async function trackSignup(params: TrackSignupParams): Promise<void> {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.warn("[trackSignup] no auth user; skipping");
      return;
    }
    const token = await user.getIdToken();
    const res = await fetch(`${API_BASE_URL}/track-signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "(unreadable)");
      console.warn("[trackSignup] non-OK", res.status, body);
    }
  } catch (err) {
    console.warn("[trackSignup] failed:", err);
  }
}
