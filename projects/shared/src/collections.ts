/**
 * Env-aware Firestore collection naming.
 *
 * The whole staging-env feature pivots on this file. Both the prod and the
 * staging environment share a single Firebase project (`trace-ai-b9cba`);
 * we segregate their data by **top-level collection name prefix**:
 *
 *   prod      →  `userProfiles`, `events`, `swipeActions`, …
 *   staging   →  `staging_userProfiles`, `staging_events`, `staging_swipeActions`, …
 *
 * Every Firestore read/write across the app, server, and admin web goes
 * through `col(env, name)`. The `CollectionName` union type is the
 * single source of truth — adding a new collection means adding it here,
 * which then forces you (via TypeScript) to think about its staging
 * counterpart, security rule, and any required composite index.
 *
 * Path-based nesting (`staging/data/userProfiles/{id}`) was considered
 * and rejected because:
 *   - composite indexes become collection-group, which is a one-way door,
 *   - Firestore triggers bind to specific paths and the staging path
 *     would be a different subcollection rather than a sibling top-level,
 *   - security rules would need duplicate nested blocks anyway.
 */

export type TraceEnv = "prod" | "staging";

/**
 * Every top-level Firestore collection used anywhere in Trace.
 *
 * If you're adding a new collection, append it here. Then:
 *   1. Mirror it in firestore.rules (if client-readable).
 *   2. Mirror any composite indexes in firestore.indexes.json.
 *   3. Every read/write must go through `col(env, name)` — the CI
 *      grep guard will fail the build if it sees a raw
 *      `.collection("literal")` call.
 */
export const COLLECTION_NAMES = [
  "userProfiles",
  "swipeActions",
  "flightDeals",
  "dealAlerts",
  "events",
  "notificationTemplates",
  "notificationLog",
  "promoCodes",
  "promoRedemptions",
  "analyticsExclusions",
  "adminAuditLog",
  "destinationContent",
  "sharedDeals",
  "adSpend",
  "hotDealCache",
] as const;

export type CollectionName = (typeof COLLECTION_NAMES)[number];

/**
 * The staging prefix. Exported so consumers (e.g. the runtime assertion
 * in server `colRef`) can sanity-check.
 */
export const STAGING_PREFIX = "staging_";

/**
 * Returns the actual Firestore collection name for `(env, name)`.
 *
 * Pure function — no globals read. Callers thread `env` through
 * explicitly (per-request on the server, from AsyncStorage on the
 * mobile app, from the admin cookie on the web).
 */
export function col(env: TraceEnv, name: CollectionName): string {
  return env === "staging" ? `${STAGING_PREFIX}${name}` : name;
}

/**
 * Inverse of `col` — given a resolved collection string, return the
 * env it belongs to (or null if the string doesn't match any known
 * collection). Used by audit logging and the runtime safety assertion.
 */
export function envFromCollection(resolved: string): TraceEnv | null {
  if ((COLLECTION_NAMES as readonly string[]).includes(resolved)) return "prod";
  if (resolved.startsWith(STAGING_PREFIX)) {
    const stripped = resolved.slice(STAGING_PREFIX.length);
    if ((COLLECTION_NAMES as readonly string[]).includes(stripped)) {
      return "staging";
    }
  }
  return null;
}

/**
 * All resolved collection names for a given env. Useful for things like
 * mirror checks in firestore.rules tests, or generating index entries.
 */
export function allCollectionsFor(env: TraceEnv): string[] {
  return COLLECTION_NAMES.map((name) => col(env, name));
}
