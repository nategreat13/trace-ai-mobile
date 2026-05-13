import AsyncStorage from "@react-native-async-storage/async-storage";
import { getEnv } from "./env";

/**
 * AsyncStorage wrapper with two layers:
 *
 * 1. JSON serialization (string-or-object, like the original wrapper).
 * 2. **Env-scoped key prefix** — every key is transparently namespaced
 *    under `trace.{env}.` so prod and staging local state are isolated.
 *    A user who switches to staging won't see their prod deck position
 *    or push prompt state, and vice versa.
 *
 * The env prefix is read at call time via `getEnv()`, so a switch via
 * `setEnv()` (which triggers `Updates.reloadAsync`) cleanly partitions
 * the two stores from then on.
 *
 * Caveat — existing prod users on upgrade: their old unprefixed keys
 * (e.g. `deck_position_2025-01-01`, `trace.push.softPromptDismissedAt`)
 * become invisible because reads now look up `trace.prod.<key>`. We
 * intentionally don't migrate; the cost is one-off:
 *   - per-day deck position resets (regenerates within hours of normal use)
 *   - users who previously dismissed the soft prompt may see it once more
 * Both are mildly annoying but not broken. If we ever want to migrate,
 * do it inside `initEnvFromStorage` with a `trace.env_migration_v1` flag.
 *
 * The `*Raw` variants below bypass the prefix and are used only by
 * `lib/env.ts` itself to read `trace.env` (chicken-and-egg: we can't
 * env-prefix the key that tells us the env).
 */

function prefixed(key: string): string {
  return `trace.${getEnv()}.${key}`;
}

export async function getItem<T = string>(key: string): Promise<T | null> {
  try {
    const value = await AsyncStorage.getItem(prefixed(key));
    if (value === null) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  } catch {
    return null;
  }
}

export async function setItem(key: string, value: any): Promise<void> {
  try {
    const serialized = typeof value === "string" ? value : JSON.stringify(value);
    await AsyncStorage.setItem(prefixed(key), serialized);
  } catch {
    // silent fail
  }
}

export async function removeItem(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(prefixed(key));
  } catch {
    // silent fail
  }
}

/**
 * Bypass the env prefix. Reserved for state ABOUT the env itself
 * (`trace.env`) — everything else should use the prefixed variants
 * above so prod and staging stay isolated.
 */
export async function getItemRaw(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function setItemRaw(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    // silent fail
  }
}

export async function removeItemRaw(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // silent fail
  }
}
