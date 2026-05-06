/**
 * Session-id management for analytics.
 *
 * A "session" starts on cold launch and ends when the app is backgrounded
 * for SESSION_TIMEOUT_MS (kept in sync with App.tsx) without coming back to
 * the foreground. The session_id is included on every analytics event so
 * we can compute session-scoped metrics (events per session, session
 * length, sessions per user) — none of which are recoverable from raw
 * events without this identifier.
 *
 * The id is in-memory only; it does not persist across cold launches.
 * That's intentional — a fresh launch IS a new session by definition.
 */

let currentSessionId: string | null = null;

/**
 * Lightweight UUID v4. We don't need cryptographic strength for an
 * analytics correlation id; the goal is just collision-free across the
 * device's session history. Math.random() is sufficient.
 */
function makeId(): string {
  // RFC 4122-ish v4 (the bit-fiddling produces the right "4" and "y" nibbles)
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Returns the current session id, generating one lazily on first call.
 * Most callers should not need to think about this — `logEvent` reads it
 * automatically.
 */
export function getSessionId(): string {
  if (!currentSessionId) currentSessionId = makeId();
  return currentSessionId;
}

/**
 * Force a new session id. Call from App.tsx on cold launch and on
 * foreground resume after a long background interval.
 */
export function resetSessionId(): string {
  currentSessionId = makeId();
  return currentSessionId;
}
