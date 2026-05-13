import { AsyncLocalStorage } from "node:async_hooks";
import type { TraceEnv } from "@trace/shared";

/**
 * Per-request environment context for the Cloud Function.
 *
 * Why AsyncLocalStorage and not a plain module-level variable: Cloud Run
 * serves multiple concurrent requests per instance. A module-level
 * `let currentEnv` would be racy — request A could set it to "staging"
 * while request B's handler is mid-await on a Firestore read, and B
 * would then read from the staging collection by accident.
 *
 * Instead, each entry point wraps its handler in `runWithEnv(env, fn)`.
 * Every async hook inside that call (Firestore reads, fetch calls,
 * setTimeout, etc.) inherits the same store, so `getEnv()` deep inside
 * a route handler returns the right value even with overlapping requests.
 *
 * Outside of a request scope (e.g. cold-start module init), `getEnv()`
 * returns "prod" — the safe default.
 */

const envStore = new AsyncLocalStorage<TraceEnv>();

/**
 * Run `fn` with the given env bound for all async operations it
 * spawns. Returns whatever `fn` returns (sync or promise).
 */
export function runWithEnv<T>(env: TraceEnv, fn: () => T): T {
  return envStore.run(env, fn);
}

/**
 * The current request's env, or "prod" if called outside any
 * `runWithEnv` scope. Background triggers (Firestore onCreate, scheduled
 * functions) set this explicitly via their own `runWithEnv` wrapper.
 */
export function getEnv(): TraceEnv {
  return envStore.getStore() ?? "prod";
}
