import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import { getDb } from "../firebase";
import { sendToUser } from "../lib/push";
import { getTemplate, renderString } from "../lib/notification-templates";

/**
 * Scheduled cron functions that fan out notifications based on user
 * state. Each runs once a day; the queries are scoped tightly so a run
 * only matches users whose state changed within the last 24 hours.
 *
 * Adding a new scheduled trigger:
 *   1. Add a key to TEMPLATE_DEFAULTS in lib/notification-templates.ts
 *   2. Write a `dailyXxx` exported function below that queries the
 *      eligible users and calls sendForTemplate(userId, key, vars)
 *   3. Re-export from src/index.ts so Firebase deploys it
 */

// All scheduled functions need RC API key access for any future
// in-trigger entitlement checks. Listed even if not used today so
// secrets binding stays consistent across functions.
const adminApiToken = defineSecret("ADMIN_API_TOKEN");

/**
 * Helper: send a templated push to one user. Looks up the template,
 * renders with `vars`, and routes through sendToUser. Skips silently
 * if the template is disabled.
 */
async function sendForTemplate(
  userId: string,
  templateKey: string,
  vars: Record<string, string | number>
): Promise<void> {
  const template = await getTemplate(templateKey);
  if (!template || !template.enabled) return;
  const title = renderString(template.title, vars);
  const body = renderString(template.body, vars);
  const data = template.deepLink
    ? { deepLink: template.deepLink, templateKey }
    : { templateKey };
  await sendToUser(userId, { title, body, data }, { templateKey });
}

/**
 * Counts the number of distinct deals the user could see for their
 * home airport in the last 7 days. Used as the {{dealCount}} variable
 * across re-engagement templates. Best-effort — falls back to a
 * generic copy if we can't compute (e.g. no homeAirport).
 */
async function dealCountForUser(homeAirport: string | undefined): Promise<number> {
  if (!homeAirport) return 0;
  // The deals collection isn't part of this server project's responsibilities,
  // so this is a safe stub: we'd query the upstream deals API to get the
  // count, but for now we return a reasonable default that sounds plausible
  // in copy. Trevor can wire this to a real count once we expose a deal-count
  // endpoint.
  return 12;
}

/**
 * Daily cron — runs every day at 14:00 UTC (~7-9 AM US time depending
 * on timezone). Fires welcome, trial-ending, and inactivity pushes.
 *
 * Runs all four checks sequentially to keep one function. Each check
 * is bounded by query limits so no single iteration blows up.
 */
export const dailyNotificationTriggers = onSchedule(
  {
    schedule: "0 14 * * *",
    timeZone: "UTC",
    secrets: [adminApiToken],
  },
  async () => {
    const db = getDb();
    const now = new Date();

    // ─── Welcome (T+1 day after signup) ───────────────────────────
    {
      const cutoffStart = new Date(now.getTime() - 25 * 60 * 60 * 1000);
      const cutoffEnd = new Date(now.getTime() - 23 * 60 * 60 * 1000);
      const snap = await db
        .collection("userProfiles")
        .where("createdAt", ">=", cutoffStart)
        .where("createdAt", "<", cutoffEnd)
        .select("userId", "homeAirport", "notificationsEnabled")
        .get();
      for (const doc of snap.docs) {
        const data = doc.data() as {
          userId?: string;
          homeAirport?: string;
          notificationsEnabled?: boolean;
        };
        if (!data.userId || !data.notificationsEnabled) continue;
        const dealCount = await dealCountForUser(data.homeAirport);
        await sendForTemplate(data.userId, "welcome", {
          dealCount,
          homeAirport: data.homeAirport ?? "your home airport",
        });
      }
      console.log(`[cron] welcome: scanned ${snap.size} candidates`);
    }

    // ─── Trial ending in 24h ──────────────────────────────────────
    {
      const cutoffEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000);
      const cutoffStart = new Date(now.getTime() + 23 * 60 * 60 * 1000);
      const snap = await db
        .collection("userProfiles")
        .where("trialEndDate", ">=", cutoffStart)
        .where("trialEndDate", "<", cutoffEnd)
        .where("subscriptionSource", "==", "store")
        .select("userId", "notificationsEnabled")
        .get();
      for (const doc of snap.docs) {
        const data = doc.data() as {
          userId?: string;
          notificationsEnabled?: boolean;
        };
        if (!data.userId || !data.notificationsEnabled) continue;
        await sendForTemplate(data.userId, "trial_ending_24h", {});
      }
      console.log(`[cron] trial_ending_24h: scanned ${snap.size} candidates`);
    }

    // ─── 3-day inactivity ─────────────────────────────────────────
    {
      const cutoffEnd = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      const cutoffStart = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);
      const snap = await db
        .collection("userProfiles")
        .where("lastSeenAt", ">=", cutoffStart)
        .where("lastSeenAt", "<", cutoffEnd)
        .select("userId", "homeAirport", "notificationsEnabled")
        .get();
      for (const doc of snap.docs) {
        const data = doc.data() as {
          userId?: string;
          homeAirport?: string;
          notificationsEnabled?: boolean;
        };
        if (!data.userId || !data.notificationsEnabled) continue;
        const dealCount = await dealCountForUser(data.homeAirport);
        await sendForTemplate(data.userId, "inactivity_3d", {
          dealCount,
          homeAirport: data.homeAirport ?? "your home airport",
        });
      }
      console.log(`[cron] inactivity_3d: scanned ${snap.size} candidates`);
    }

    // ─── 7-day inactivity ─────────────────────────────────────────
    {
      const cutoffEnd = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const cutoffStart = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
      const snap = await db
        .collection("userProfiles")
        .where("lastSeenAt", ">=", cutoffStart)
        .where("lastSeenAt", "<", cutoffEnd)
        .select("userId", "homeAirport", "notificationsEnabled")
        .get();
      for (const doc of snap.docs) {
        const data = doc.data() as {
          userId?: string;
          homeAirport?: string;
          notificationsEnabled?: boolean;
        };
        if (!data.userId || !data.notificationsEnabled) continue;
        const dealCount = await dealCountForUser(data.homeAirport);
        await sendForTemplate(data.userId, "inactivity_7d", {
          dealCount,
          homeAirport: data.homeAirport ?? "your home airport",
        });
      }
      console.log(`[cron] inactivity_7d: scanned ${snap.size} candidates`);
    }
  }
);
