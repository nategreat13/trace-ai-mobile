import { colRef } from "./firebase-admin";
import type { TraceEnv } from "@trace/shared";

/**
 * Append-only audit log of admin actions. Stored in Firestore at
 * `adminAuditLog/{auto-id}`. Reads/writes happen exclusively via the
 * Firebase Admin SDK on the dashboard server — Firestore rules deny all
 * client access.
 *
 * Entries are intentionally minimal: there's no per-admin auth (single
 * shared password), so we can't record *who* performed the action — but
 * timestamp + action + resource + free-form detail is enough to answer
 * "what changed and when."
 */

export interface AuditEntry {
  id: string;
  /** Hierarchical action identifier, e.g. "exclusion.add_email" */
  action: string;
  /** Identifier of the thing that was acted on (email / docId / etc.) */
  resource: string | null;
  /** Optional free-form context — small object only, no PII beyond what's
   * already implied by `resource`. */
  detail: Record<string, unknown> | null;
  performedAt: Date | null;
}

export async function logAuditEvent(
  env: TraceEnv,
  action: string,
  resource: string | null,
  detail?: Record<string, unknown>
): Promise<void> {
  try {
    await colRef(env, "adminAuditLog").add({
      action,
      resource: resource ?? null,
      detail: detail ?? null,
      performedAt: new Date(),
    });
  } catch (err) {
    console.warn("[audit] failed to log:", action, resource, err);
  }
}

export async function listAuditEntries(
  env: TraceEnv,
  limit = 200
): Promise<AuditEntry[]> {
  const snap = await colRef(env, "adminAuditLog")
    .orderBy("performedAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      action: (data.action as string | undefined) ?? "(unknown)",
      resource: (data.resource as string | undefined) ?? null,
      detail: (data.detail as Record<string, unknown> | undefined) ?? null,
      performedAt: (data.performedAt as any)?.toDate?.() ?? null,
    };
  });
}
