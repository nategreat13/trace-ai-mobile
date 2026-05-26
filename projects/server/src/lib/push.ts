import { Expo, ExpoPushMessage, ExpoPushTicket } from "expo-server-sdk";
import * as admin from "firebase-admin";
import { colRef } from "../firebase";
import { isTemplateAllowedForUser } from "./notification-preferences";

/**
 * Server-side push notification helpers.
 *
 * Wraps expo-server-sdk with our domain logic:
 *   - Resolve a userId → all of that user's push tokens
 *   - Render templates with per-user variables
 *   - Batch sends (Expo accepts up to 100 messages per HTTP call)
 *   - Log every send to `notificationLog` for audit + analytics
 *   - Clean up tokens that Expo reports as DeviceNotRegistered (the
 *     user uninstalled, OS-level revoked perms, etc.)
 *
 * Callers (admin endpoints, cron triggers, webhook handlers) just call
 * sendToUser / sendToTier / sendBroadcast — no need to know about
 * expo-server-sdk internals.
 */

const expo = new Expo();

export interface PushPayload {
  title: string;
  body: string;
  /** Free-form JSON delivered alongside the notification; deepLink and
   *  templateKey are recognized by the mobile app. */
  data?: Record<string, unknown>;
  /** Optional iOS sub-title under the title */
  subtitle?: string;
}

export interface SendResult {
  /** Number of messages we actually attempted to deliver */
  attempted: number;
  /** Number Expo accepted (may still fail downstream at APNs/FCM) */
  ok: number;
  /** Tokens we cleaned up because Expo said they're dead */
  removedTokens: string[];
  /** Errors we hit at the request level */
  errors: string[];
}

/**
 * Send a push to a specific user. Resolves all of the user's registered
 * push tokens and fans out. Respects two layers of opt-out:
 *
 *   1. `notificationsEnabled` — master switch. If false, nothing fires.
 *   2. `notificationPreferences[category]` — per-category toggles set
 *      in the mobile app's Profile screen. The category for each
 *      template key is in `notification-preferences.ts`. If the user
 *      has toggled the relevant category off, this returns ok: 0.
 *
 * `force` bypasses BOTH layers. Use sparingly — it exists for the
 * test-send button on the admin user-detail page and the "Fire a
 * template" admin tool, where the admin explicitly wants to deliver
 * regardless of the recipient's settings.
 */
export async function sendToUser(
  userId: string,
  payload: PushPayload,
  opts: { templateKey?: string; force?: boolean } = {}
): Promise<SendResult> {
  const snap = await colRef("userProfiles")
    .where("userId", "==", userId)
    .limit(1)
    .get();
  if (snap.empty) {
    return { attempted: 0, ok: 0, removedTokens: [], errors: ["no profile"] };
  }
  const docSnap = snap.docs[0];
  const data = docSnap.data();
  if (!opts.force && data.notificationsEnabled !== true) {
    return {
      attempted: 0,
      ok: 0,
      removedTokens: [],
      errors: ["user opted out"],
    };
  }
  if (
    !opts.force &&
    !isTemplateAllowedForUser(opts.templateKey, data.notificationPreferences)
  ) {
    return {
      attempted: 0,
      ok: 0,
      removedTokens: [],
      errors: ["user opted out of this category"],
    };
  }
  const tokens = ((data.pushTokens ?? []) as Array<{ token: string }>)
    .map((t) => t.token)
    .filter(Boolean);
  if (tokens.length === 0) {
    return { attempted: 0, ok: 0, removedTokens: [], errors: ["no tokens"] };
  }
  const result = await sendToTokens(tokens, payload);

  // If Expo flagged tokens as dead, prune them from the userProfile.
  if (result.removedTokens.length > 0) {
    const remaining = ((data.pushTokens ?? []) as Array<{ token: string }>).filter(
      (t) => !result.removedTokens.includes(t.token)
    );
    await docSnap.ref.update({ pushTokens: remaining });
  }

  await logSend({
    userId,
    templateKey: opts.templateKey ?? null,
    title: payload.title,
    body: payload.body,
    data: payload.data ?? null,
    attempted: result.attempted,
    ok: result.ok,
    errors: result.errors,
    audience: "user",
  });

  return result;
}

/**
 * Send to a raw list of Expo push tokens. Drops anything that doesn't
 * look like a valid Expo token, batches into chunks of 100, and
 * surfaces DeviceNotRegistered tickets in `removedTokens` so the
 * caller can prune.
 */
export async function sendToTokens(
  tokens: string[],
  payload: PushPayload
): Promise<SendResult> {
  // Dedupe by token string. The client's registerPushToken can race
  // when the gate fires multiple times concurrently (mount + AppState
  // foreground + recheck signal), and `arrayUnion` only dedupes by
  // whole-record equality — so a profile can end up with multiple
  // records that share the same Expo token string, just with slightly
  // different `addedAt` timestamps. Without this Set, each duplicate
  // would result in one extra push delivery to the same device.
  const valid = [...new Set(tokens.filter((t) => Expo.isExpoPushToken(t)))];
  if (valid.length === 0) {
    return { attempted: 0, ok: 0, removedTokens: [], errors: [] };
  }

  const messages: ExpoPushMessage[] = valid.map((t) => ({
    to: t,
    title: payload.title,
    body: payload.body,
    data: payload.data,
    subtitle: payload.subtitle,
    sound: "default",
    priority: "high",
  }));

  const removedTokens: string[] = [];
  const errors: string[] = [];
  let ok = 0;

  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      const tickets: ExpoPushTicket[] = await expo.sendPushNotificationsAsync(chunk);
      tickets.forEach((ticket, i) => {
        if (ticket.status === "ok") {
          ok++;
        } else {
          // ExpoPushErrorTicket — token-level failure
          const errCode = ticket.details?.error;
          if (errCode === "DeviceNotRegistered") {
            const targetMsg = chunk[i];
            if (typeof targetMsg.to === "string") {
              removedTokens.push(targetMsg.to);
            }
          }
          errors.push(`${ticket.message ?? "(no message)"} [${errCode ?? "?"}]`);
        }
      });
    } catch (err: any) {
      errors.push(err?.message ?? String(err));
    }
  }

  return { attempted: valid.length, ok, removedTokens, errors };
}

/**
 * Audience filter for broadcast sends. Each field is optional and acts
 * as an AND filter when present. All audiences require
 * notificationsEnabled === true and at least one push token.
 */
export interface BroadcastAudience {
  /** Restrict to specific subscription tiers */
  tiers?: Array<"free" | "trial" | "premium" | "business">;
  /** Restrict to a specific platform */
  platform?: "ios" | "android";
}

export interface BroadcastResult extends SendResult {
  /** How many users matched the audience filter */
  matchedUsers: number;
}

/**
 * Broadcast a push to many users. The audience filter is applied
 * Firestore-side where possible (subscriptionStatus IN ...) and
 * post-filtered in memory for everything else.
 */
export async function sendBroadcast(
  audience: BroadcastAudience,
  payload: PushPayload,
  opts: { templateKey?: string } = {}
): Promise<BroadcastResult> {
  let query: admin.firestore.Query = colRef("userProfiles").where(
    "notificationsEnabled",
    "==",
    true
  );
  if (audience.tiers && audience.tiers.length > 0) {
    query = query.where("subscriptionStatus", "in", audience.tiers);
  }

  const snap = await query
    .select("userId", "pushTokens", "subscriptionStatus")
    .get();

  const tokens: string[] = [];
  let matched = 0;
  snap.forEach((doc) => {
    const data = doc.data() as {
      pushTokens?: Array<{ token: string; platform?: string }>;
    };
    const userTokens = data.pushTokens ?? [];
    const filtered = audience.platform
      ? userTokens.filter((t) => t.platform === audience.platform)
      : userTokens;
    if (filtered.length > 0) {
      matched++;
      filtered.forEach((t) => {
        if (t.token) tokens.push(t.token);
      });
    }
  });

  const result = await sendToTokens(tokens, payload);

  // No per-user token cleanup on broadcasts — Expo returns tickets in
  // batch and identifying which user owns each removed token would
  // require a second Firestore round-trip. Skip; cleanup happens
  // organically on per-user sends.

  await logSend({
    userId: null,
    templateKey: opts.templateKey ?? null,
    title: payload.title,
    body: payload.body,
    data: payload.data ?? null,
    attempted: result.attempted,
    ok: result.ok,
    errors: result.errors,
    audience: "broadcast",
    audienceFilter: audience,
    matchedUsers: matched,
  });

  return { ...result, matchedUsers: matched };
}

/**
 * Append an entry to the notificationLog collection. Schema is intentionally
 * flat so the admin "history" page can render rows without joins.
 */
async function logSend(entry: {
  userId: string | null;
  templateKey: string | null;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  attempted: number;
  ok: number;
  errors: string[];
  audience: "user" | "broadcast";
  audienceFilter?: BroadcastAudience;
  matchedUsers?: number;
}): Promise<void> {
  try {
    await colRef("notificationLog").add({
      ...entry,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.warn("[push] logSend failed:", err);
  }
}
