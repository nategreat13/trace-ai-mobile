import * as Updates from "expo-updates";
import Constants from "expo-constants";
import type { TraceEnv } from "@trace/shared";
import { getItemRaw, setItemRaw } from "./storage";

/**
 * Per-device staging/prod environment switch.
 *
 * The env is stored in AsyncStorage under `trace.env` (the one key
 * that is NOT itself env-prefixed). It's hydrated once at app
 * startup by `initEnvFromStorage()` into a module-local variable,
 * after which `getEnv()` is synchronous — required because every
 * Firestore call site uses `col(getEnv(), "name")` inline.
 *
 * Switching env via `setEnv()` writes to AsyncStorage and reloads
 * the app via `Updates.reloadAsync()`. The reload is mandatory:
 * Firestore listeners, the API base URL, the Auth user, and all
 * env-prefixed AsyncStorage keys are read at module init time
 * and would still hold prod values until a reload.
 *
 * Default: prod. Any failure to read AsyncStorage falls back to
 * prod — the safe default.
 *
 * Note: this module is NOT for ProdFunction's `process.env.TRACE_ENV`
 * — that's a server-side concept handled by `projects/server/src/env.ts`.
 */

export const ENV_STORAGE_KEY = "trace.env";

// Module-local cache, hydrated once by initEnvFromStorage(). Reads
// before hydration return "prod" — safe default.
let currentEnv: TraceEnv = "prod";
let hydrated = false;

/**
 * Synchronous read of the current env. Always safe to call.
 *
 * Before `initEnvFromStorage()` resolves (the first ~10ms of app
 * startup), this returns "prod". Any Firestore reads triggered in
 * that window would hit prod collections — but in practice every
 * Firestore read in the app is gated behind auth state which itself
 * resolves async, well after env hydration completes. So this is
 * safe in practice and the always-safe "prod" default is the
 * intended behavior on first-launch (before the user has had a chance
 * to flip the toggle).
 */
export function getEnv(): TraceEnv {
  return currentEnv;
}

/**
 * Whether `initEnvFromStorage` has resolved. Components that want to
 * render env-dependent UI (e.g. the staging banner on LandingScreen)
 * can defer until this is true to avoid flashing the wrong state.
 */
export function isEnvHydrated(): boolean {
  return hydrated;
}

/**
 * Read the persisted env from AsyncStorage and update the in-memory
 * cache. Call this exactly once at App.tsx top level, before anything
 * Firestore-touching mounts. Idempotent — calling twice is a no-op
 * after the first.
 */
export async function initEnvFromStorage(): Promise<void> {
  if (hydrated) return;
  // Use getItemRaw — the env key itself can't be env-prefixed
  // because we haven't determined the env yet (chicken-and-egg).
  const raw = await getItemRaw(ENV_STORAGE_KEY);
  if (raw === "staging" || raw === "prod") {
    // User has explicitly chosen via the diagnostics screen — respect it.
    currentEnv = raw;
  } else {
    currentEnv = defaultEnvForBuild();
  }
  hydrated = true;
}

/**
 * What env to default to when AsyncStorage has no explicit choice.
 *
 * Production binaries → "prod". Real users see prod data on first
 * launch (and forever, unless they hit the diagnostics screen).
 *
 * Dev mode running against the local server (yarn dev2 sets
 * USE_LOCAL_API=1, which makes app.config.js populate
 * extra.devApiUrl) → "staging". This way local dev never writes
 * to prod Firestore, even on a fresh AsyncStorage. Pairs with the
 * staging-aware wrapper in projects/server/src/dev.ts.
 *
 * Dev mode without the local server (yarn dev:prod) → "prod". The
 * developer is intentionally pointing at production; respect it.
 */
function defaultEnvForBuild(): TraceEnv {
  // @ts-ignore: __DEV__ is defined by React Native at runtime
  if (!__DEV__) return "prod";
  const devApiUrl = (Constants.expoConfig?.extra as
    | { devApiUrl?: string | null }
    | undefined)?.devApiUrl;
  return devApiUrl ? "staging" : "prod";
}

/**
 * Switch env. Persists the choice, then reloads the entire JS bundle.
 *
 * Caller should sign out the current Firebase Auth user BEFORE calling
 * this — the new env may or may not have a userProfile doc for the
 * current Auth UID, and the cleanest UX is to land the user on the
 * Landing screen ready to sign in fresh.
 *
 * Throws if AsyncStorage write fails (caller decides whether to surface).
 */
export async function setEnv(env: TraceEnv): Promise<void> {
  // setItemRaw — never env-prefix the env key itself.
  await setItemRaw(ENV_STORAGE_KEY, env);
  currentEnv = env;
  // Updates.reloadAsync() is supported in both production binaries
  // and dev clients via expo-updates. In dev (`expo start`), it
  // restarts the Metro-served bundle.
  await Updates.reloadAsync();
}
