import { cookies } from "next/headers";
import type { TraceEnv } from "@trace/shared";

/**
 * Admin web environment switch.
 *
 * The admin portal can view either prod or staging Firestore data,
 * controlled by a cookie set via the env-switch UI in the header. The
 * cookie is set by `/api/set-env` and read here for every server
 * component / server action.
 *
 * Defaults when no explicit cookie:
 *   - `next dev` (local development) → staging. So `yarn dev:web`
 *     starts pointing at staging and no one accidentally edits prod
 *     data while iterating locally.
 *   - Anything else (Vercel preview / production builds) → prod. Real
 *     admins on the live deployment see prod unless they explicitly
 *     flip the toggle. Parallel to how `lib/env.ts` defaults the
 *     mobile app in `__DEV__`.
 */

export const ADMIN_ENV_COOKIE = "trace_admin_env";

/**
 * Read the admin's current env from the cookie. Safe to call from any
 * server component, server action, or route handler.
 */
export async function getAdminEnv(): Promise<TraceEnv> {
  const store = await cookies();
  const value = store.get(ADMIN_ENV_COOKIE)?.value;
  if (value === "staging" || value === "prod") return value;
  // No explicit choice yet — use the build-mode default.
  return process.env.NODE_ENV === "development" ? "staging" : "prod";
}

/**
 * Signup-version cohort selection for the analytics dashboard. Persisted in a
 * cookie (set by `/api/set-cohorts`) so the choice survives navigation and
 * sessions, like the env switch. Value is a comma-separated list of cohort
 * keys; absent or empty means "all cohorts".
 */
export const ADMIN_COHORTS_COOKIE = "trace_admin_cohorts";

/**
 * Read the selected cohort keys, or `null` for "all cohorts" (default).
 */
export async function getAdminCohorts(): Promise<string[] | null> {
  const store = await cookies();
  const raw = store.get(ADMIN_COHORTS_COOKIE)?.value?.trim();
  if (!raw) return null;
  const keys = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return keys.length > 0 ? keys : null;
}
