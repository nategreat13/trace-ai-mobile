import { colRef } from "./firebase-admin";
import type { TraceEnv } from "@trace/shared";

/**
 * Sandbox email whitelist — the only addresses allowed to receive Klaviyo
 * email while the server runs in staging. The server's lib/klaviyo.ts gate
 * reads this collection: prod sends to anyone, staging sends only to emails
 * listed here. Lets Trevor test email flows in staging without any risk of
 * mailing a real user.
 *
 * Schema (collection: sandboxEmailWhitelist):
 *   { email: string (lowercased), note?: string, addedAt: Timestamp }
 *
 * It's env-aware like everything else, but only the STAGING copy
 * (`staging_sandboxEmailWhitelist`) is ever consulted — manage it with the
 * admin env toggle set to Staging.
 */

export interface WhitelistDoc {
  id: string;
  email: string;
  note: string | null;
  addedAt: Date | null;
}

export async function listWhitelist(env: TraceEnv): Promise<WhitelistDoc[]> {
  const snap = await colRef(env, "sandboxEmailWhitelist")
    .orderBy("addedAt", "desc")
    .get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      email: (data.email as string) ?? "",
      note: (data.note as string | null) ?? null,
      addedAt: data.addedAt?.toDate?.() ?? null,
    };
  });
}

export async function addWhitelistEmail(
  env: TraceEnv,
  email: string,
  note?: string
): Promise<void> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) throw new Error("Email is required");
  const existing = await colRef(env, "sandboxEmailWhitelist")
    .where("email", "==", normalized)
    .limit(1)
    .get();
  if (!existing.empty) throw new Error("Email already whitelisted");
  await colRef(env, "sandboxEmailWhitelist").add({
    email: normalized,
    note: note?.trim() || null,
    addedAt: new Date(),
  });
}

export async function removeWhitelistEmail(
  env: TraceEnv,
  docId: string
): Promise<void> {
  await colRef(env, "sandboxEmailWhitelist").doc(docId).delete();
}
