import { getItemRaw, setItemRaw } from "./storage";

/**
 * Stable per-install device id.
 *
 * Persisted in AsyncStorage at `trace.device_id` (a RAW key — device is
 * env-agnostic, so we don't prefix with `trace.{env}.`). Generated once
 * on first launch and reused for the life of the install.
 *
 * Why we need it: `session_id` rotates on every cold launch + every
 * 30-minute background interval, so pre-signup (guest) events can only
 * be linked to a future user when both share a single session. Multi-
 * session usage from the same device (force-quit + reopen, kill + OTA
 * fetch, anything that triggers a cold launch) creates orphan guest
 * sessions that the session-based taint logic can't attribute. A stable
 * device_id closes that gap — every event from the same physical install
 * carries the same identifier, so excluding a user retroactively taints
 * every event from their device regardless of session.
 *
 * Privacy notes:
 *   - This is a random UUID, not the OS-level advertising ID or any
 *     other identifier with tracking implications.
 *   - It's scoped to this install — uninstall + reinstall gets a fresh id.
 *   - It's never sent to third parties; it lives in our `events` props
 *     and is used only for internal funnel attribution.
 */

const DEVICE_ID_KEY = "trace.device_id";

// Hydrated once by `initDeviceId()` at App.tsx startup. Reads before
// hydration return "" — events that fire in that ~10ms window will be
// missing device_id, which is fine: the funnel query treats empty-
// device-id events as un-attributable (i.e. counts them) — same as
// today's behavior pre-fix.
let cachedDeviceId: string | null = null;
let hydrated = false;

/**
 * Lightweight UUID v4 (same algorithm as session.ts). Math.random is
 * sufficient — collision-free at our scale and this is internal-only.
 */
function makeId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Synchronous read of the cached device id. Returns "" if called before
 * `initDeviceId()` completes. Same hydration pattern as `getEnv()`.
 */
export function getDeviceId(): string {
  return cachedDeviceId ?? "";
}

/**
 * Whether `initDeviceId()` has resolved.
 */
export function isDeviceIdHydrated(): boolean {
  return hydrated;
}

/**
 * Read (or generate + persist) the device id. Call exactly once at
 * App.tsx top level before rendering. Idempotent.
 *
 * Falls back to an in-memory-only id if AsyncStorage fails — that way
 * a broken storage at least keeps a stable id for the current session
 * instead of regenerating on every read.
 */
export async function initDeviceId(): Promise<void> {
  if (hydrated) return;
  try {
    let id = await getItemRaw(DEVICE_ID_KEY);
    if (!id) {
      id = makeId();
      await setItemRaw(DEVICE_ID_KEY, id);
    }
    cachedDeviceId = id;
  } catch {
    // best-effort — use an in-memory id this launch.
    cachedDeviceId = makeId();
  } finally {
    hydrated = true;
  }
}
