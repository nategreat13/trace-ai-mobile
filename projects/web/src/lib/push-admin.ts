import { getDb } from "./firebase-admin";

/**
 * Admin-side helpers for push notification management.
 *
 * Reads/writes:
 *   - notificationTemplates  (admin-editable copy per trigger)
 *   - notificationLog        (audit trail of every send)
 *
 * Sends are NOT done here — they go through the Cloud Function via
 * the admin-push routes, gated by ADMIN_API_TOKEN. This file is just
 * the read side + the admin's write side for templates.
 */

export interface NotificationTemplate {
  key: string;
  title: string;
  body: string;
  deepLink: string | null;
  enabled: boolean;
  description: string;
  variables: string[];
  updatedAt: Date | null;
}

/**
 * The full list of trigger keys the server knows how to fire. Kept in
 * sync manually with projects/server/src/lib/notification-templates.ts —
 * adding a new key requires both a server-side trigger and an entry
 * here. (Could be deduped via @trace/shared eventually.)
 */
export const KNOWN_TEMPLATE_KEYS = [
  "welcome",
  "trial_ending_24h",
  "billing_issue",
  "inactivity_3d",
  "inactivity_7d",
] as const;

export async function listTemplates(): Promise<NotificationTemplate[]> {
  const db = getDb();
  const snap = await db.collection("notificationTemplates").get();
  const byKey: Record<string, NotificationTemplate> = {};
  snap.forEach((doc) => {
    const d = doc.data();
    byKey[doc.id] = {
      key: doc.id,
      title: d.title ?? "",
      body: d.body ?? "",
      deepLink: d.deepLink ?? null,
      enabled: Boolean(d.enabled),
      description: d.description ?? "",
      variables: d.variables ?? [],
      updatedAt: d.updatedAt?.toDate?.() ?? null,
    };
  });
  // Always show every known key, even if not yet seeded in Firestore.
  // This way Trevor can edit a template before its first send.
  return KNOWN_TEMPLATE_KEYS.map(
    (k) =>
      byKey[k] ?? {
        key: k,
        title: "",
        body: "",
        deepLink: null,
        enabled: false,
        description: "(not seeded — save once to create)",
        variables: [],
        updatedAt: null,
      }
  );
}

export async function getTemplate(key: string): Promise<NotificationTemplate | null> {
  const db = getDb();
  const snap = await db.collection("notificationTemplates").doc(key).get();
  if (!snap.exists) return null;
  const d = snap.data()!;
  return {
    key,
    title: d.title ?? "",
    body: d.body ?? "",
    deepLink: d.deepLink ?? null,
    enabled: Boolean(d.enabled),
    description: d.description ?? "",
    variables: d.variables ?? [],
    updatedAt: d.updatedAt?.toDate?.() ?? null,
  };
}

export async function upsertTemplate(
  key: string,
  fields: Partial<NotificationTemplate>
): Promise<void> {
  const db = getDb();
  const allowed: Record<string, unknown> = {
    updatedAt: new Date(),
  };
  if (fields.title !== undefined) allowed.title = fields.title;
  if (fields.body !== undefined) allowed.body = fields.body;
  if (fields.deepLink !== undefined) allowed.deepLink = fields.deepLink;
  if (fields.enabled !== undefined) allowed.enabled = fields.enabled;
  if (fields.description !== undefined) allowed.description = fields.description;
  if (fields.variables !== undefined) allowed.variables = fields.variables;
  await db.collection("notificationTemplates").doc(key).set(allowed, { merge: true });
}

export interface NotificationLogEntry {
  id: string;
  userId: string | null;
  templateKey: string | null;
  title: string;
  body: string;
  attempted: number;
  ok: number;
  errors: string[];
  audience: "user" | "broadcast";
  audienceFilter?: { tiers?: string[]; platform?: string };
  matchedUsers?: number;
  sentAt: Date | null;
}

export async function listRecentSends(limit = 100): Promise<NotificationLogEntry[]> {
  const db = getDb();
  const snap = await db
    .collection("notificationLog")
    .orderBy("sentAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      userId: d.userId ?? null,
      templateKey: d.templateKey ?? null,
      title: d.title ?? "",
      body: d.body ?? "",
      attempted: d.attempted ?? 0,
      ok: d.ok ?? 0,
      errors: d.errors ?? [],
      audience: d.audience ?? "user",
      audienceFilter: d.audienceFilter,
      matchedUsers: d.matchedUsers,
      sentAt: d.sentAt?.toDate?.() ?? null,
    };
  });
}

/**
 * Calls the Cloud Function admin-push endpoints with the shared
 * ADMIN_API_TOKEN. Used by server actions on the admin pages.
 *
 * Requires ADMIN_API_TOKEN and (optionally) NEXT_PUBLIC_API_BASE_URL
 * in the Vercel environment. NEXT_PUBLIC_API_BASE_URL defaults to the
 * production Cloud Run URL if unset.
 */
const DEFAULT_API_BASE = "https://api-7l7vojyykq-uc.a.run.app";

async function callAdminApi<T>(path: string, body: unknown): Promise<T> {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE;
  const token = process.env.ADMIN_API_TOKEN;
  if (!token) {
    throw new Error(
      "ADMIN_API_TOKEN is not set in the web environment. Set it in Vercel env vars."
    );
  }
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Admin API ${path} returned ${res.status}: ${text}`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

export interface SendResult {
  attempted: number;
  ok: number;
  removedTokens?: string[];
  errors?: string[];
}

export interface BroadcastResult extends SendResult {
  matchedUsers: number;
}

export async function sendTestPush(opts: {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  force?: boolean;
}): Promise<SendResult> {
  return callAdminApi<SendResult>("/admin/send-test-push", opts);
}

export async function sendBroadcast(opts: {
  audience: { tiers?: string[]; platform?: "ios" | "android" };
  title: string;
  body: string;
  data?: Record<string, unknown>;
  templateKey?: string;
}): Promise<BroadcastResult> {
  return callAdminApi<BroadcastResult>("/admin/send-broadcast", opts);
}

export async function seedTemplates(): Promise<{ created: string[] }> {
  return callAdminApi<{ created: string[] }>("/admin/seed-templates", {});
}
