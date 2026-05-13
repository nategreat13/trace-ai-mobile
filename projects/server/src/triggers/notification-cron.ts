import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import { colRef } from "../firebase";
import { runWithEnv } from "../env";
import { sendToUser } from "../lib/push";
import { getTemplate, renderString } from "../lib/notification-templates";

const DEALS_API_BASE = "https://us-central1-embarckstravel.cloudfunctions.net/api";
const DEALS_API_KEY = process.env.DEALS_API_KEY || "web-api-key";

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
    // Cron is prod-only by default. The staging counterpart (gated on
    // `ENABLE_STAGING_CRON`) wraps `runDailyNotifications` in
    // `runWithEnv("staging", …)` and lives below.
    return runWithEnv("prod", () => runDailyNotifications());
  }
);

async function runDailyNotifications() {
    const now = new Date();

    // ─── Welcome (T+1 day after signup) ───────────────────────────
    {
      const cutoffStart = new Date(now.getTime() - 25 * 60 * 60 * 1000);
      const cutoffEnd = new Date(now.getTime() - 23 * 60 * 60 * 1000);
      const snap = await colRef("userProfiles")
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

    // ─── Trial ending in 3 days ───────────────────────────────────
    {
      const cutoffEnd = new Date(now.getTime() + 73 * 60 * 60 * 1000);
      const cutoffStart = new Date(now.getTime() + 71 * 60 * 60 * 1000);
      const snap = await colRef("userProfiles")
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
        await sendForTemplate(data.userId, "trial_ending_3d", {});
      }
      console.log(`[cron] trial_ending_3d: scanned ${snap.size} candidates`);
    }

    // ─── Trial ending in 24h ──────────────────────────────────────
    {
      const cutoffEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000);
      const cutoffStart = new Date(now.getTime() + 23 * 60 * 60 * 1000);
      const snap = await colRef("userProfiles")
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
      const snap = await colRef("userProfiles")
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
      const snap = await colRef("userProfiles")
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

    // ─── 14-day inactivity ────────────────────────────────────────
    {
      const cutoffEnd = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      const cutoffStart = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
      const snap = await colRef("userProfiles")
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
        await sendForTemplate(data.userId, "inactivity_14d", {
          dealCount,
          homeAirport: data.homeAirport ?? "your home airport",
        });
      }
      console.log(`[cron] inactivity_14d: scanned ${snap.size} candidates`);
    }

    // ─── Hot deal alert (≥60% off, premium + business only) ───────
    {
      const hotDealTemplate = await getTemplate("hot_deal_alert");
      if (hotDealTemplate?.enabled) {
        const snap = await colRef("userProfiles")
          .where("notificationsEnabled", "==", true)
          .select("userId", "homeAirport", "subscriptionStatus")
          .get();

        // Group eligible users by home airport to minimise external API calls.
        const byAirport = new Map<string, Array<{ userId: string }>>();
        for (const doc of snap.docs) {
          const data = doc.data() as {
            userId?: string;
            homeAirport?: string;
            subscriptionStatus?: string;
          };
          if (!data.userId || !data.homeAirport) continue;
          if (data.subscriptionStatus !== "premium" && data.subscriptionStatus !== "business") continue;
          if (!byAirport.has(data.homeAirport)) byAirport.set(data.homeAirport, []);
          byAirport.get(data.homeAirport)!.push({ userId: data.userId });
        }

        let sent = 0;
        for (const [airport, users] of byAirport) {
          try {
            const response = await fetch(
              `${DEALS_API_BASE}/deals/${airport}?limit=500`,
              { headers: { "x-api-key": DEALS_API_KEY } }
            );
            if (!response.ok) continue;
            const raw = await response.json() as unknown;
            const deals: Array<{ discount_pct?: number; destination?: string; price?: number }> =
              Array.isArray(raw) ? raw : ((raw as Record<string, unknown>).deals as typeof deals ?? []);

            const hotDeals = deals.filter((d) => (d.discount_pct ?? 0) >= 60);
            if (hotDeals.length === 0) continue;

            const best = hotDeals.reduce((a, b) =>
              (a.discount_pct ?? 0) >= (b.discount_pct ?? 0) ? a : b
            );

            for (const user of users) {
              await sendForTemplate(user.userId, "hot_deal_alert", {
                discount: Math.round(best.discount_pct ?? 60),
                destination: best.destination ?? airport,
                price: best.price ?? 0,
                homeAirport: airport,
              });
              sent++;
            }
          } catch (err) {
            console.warn(`[cron] hot_deal_alert: error fetching deals for ${airport}:`, err);
          }
        }
        console.log(`[cron] hot_deal_alert: sent to ${sent} users across ${byAirport.size} airports`);
      } else {
        console.log("[cron] hot_deal_alert: template disabled, skipping");
      }
    }

    // ─── Subscription renewal in 24h (premium/business paid subs) ─
    {
      const cutoffStart = new Date(now.getTime() + 23 * 60 * 60 * 1000);
      const cutoffEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000);
      const snap = await colRef("userProfiles")
        .where("subscriptionSource", "==", "store")
        .where("trialEndDate", ">=", cutoffStart)
        .where("trialEndDate", "<", cutoffEnd)
        .select("userId", "subscriptionStatus", "notificationsEnabled")
        .get();
      for (const doc of snap.docs) {
        const data = doc.data() as {
          userId?: string;
          subscriptionStatus?: string;
          notificationsEnabled?: boolean;
        };
        if (!data.userId || !data.notificationsEnabled) continue;
        // Only paid subscribers — exclude trial users who share the same date field.
        if (data.subscriptionStatus !== "premium" && data.subscriptionStatus !== "business") continue;
        await sendForTemplate(data.userId, "subscription_renewal_24h", {});
      }
      console.log(`[cron] subscription_renewal_24h: scanned ${snap.size} candidates`);
    }

    // ─── Business class nudge (premium users, T+5 days since first purchase) ─
    {
      const cutoffEnd = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
      const cutoffStart = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
      const snap = await colRef("userProfiles")
        .where("subscriptionStatus", "==", "premium")
        .where("firstPurchaseAt", ">=", cutoffStart)
        .where("firstPurchaseAt", "<", cutoffEnd)
        .select("userId", "homeAirport", "notificationsEnabled")
        .get();
      for (const doc of snap.docs) {
        const data = doc.data() as {
          userId?: string;
          homeAirport?: string;
          notificationsEnabled?: boolean;
        };
        if (!data.userId || !data.notificationsEnabled) continue;
        await sendForTemplate(data.userId, "business_class_nudge_5d", {
          homeAirport: data.homeAirport ?? "your home airport",
        });
      }
      console.log(`[cron] business_class_nudge_5d: scanned ${snap.size} candidates`);
    }

    // ─── Business class nudge (premium users, T+7 days since first purchase) ─
    {
      const cutoffEnd = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const cutoffStart = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
      const snap = await colRef("userProfiles")
        .where("subscriptionStatus", "==", "premium")
        .where("firstPurchaseAt", ">=", cutoffStart)
        .where("firstPurchaseAt", "<", cutoffEnd)
        .select("userId", "homeAirport", "notificationsEnabled")
        .get();
      for (const doc of snap.docs) {
        const data = doc.data() as {
          userId?: string;
          homeAirport?: string;
          notificationsEnabled?: boolean;
        };
        if (!data.userId || !data.notificationsEnabled) continue;
        await sendForTemplate(data.userId, "business_class_nudge", {
          homeAirport: data.homeAirport ?? "your home airport",
        });
      }
      console.log(`[cron] business_class_nudge: scanned ${snap.size} candidates`);
    }

    // ─── Premium nudge (free users, T+5 days since signup) ────────
    {
      const cutoffEnd = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
      const cutoffStart = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
      const snap = await colRef("userProfiles")
        .where("subscriptionStatus", "==", "free")
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
        await sendForTemplate(data.userId, "premium_nudge", {
          homeAirport: data.homeAirport ?? "your home airport",
        });
      }
      console.log(`[cron] premium_nudge: scanned ${snap.size} candidates`);
    }

    // ─── Premium nudge (free users, T+10 days since signup) ───────
    {
      const cutoffEnd = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
      const cutoffStart = new Date(now.getTime() - 11 * 24 * 60 * 60 * 1000);
      const snap = await colRef("userProfiles")
        .where("subscriptionStatus", "==", "free")
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
        await sendForTemplate(data.userId, "premium_nudge_10d", {
          homeAirport: data.homeAirport ?? "your home airport",
        });
      }
      console.log(`[cron] premium_nudge_10d: scanned ${snap.size} candidates`);
    }

    // ─── Premium nudge (free users, T+20 days since signup) ───────
    {
      const cutoffEnd = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000);
      const cutoffStart = new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000);
      const snap = await colRef("userProfiles")
        .where("subscriptionStatus", "==", "free")
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
        await sendForTemplate(data.userId, "premium_nudge_20d", {
          homeAirport: data.homeAirport ?? "your home airport",
        });
      }
      console.log(`[cron] premium_nudge_20d: scanned ${snap.size} candidates`);
    }

    // ─── Discount on premium (free users, T+25 days since signup) ─
    {
      const cutoffEnd = new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000);
      const cutoffStart = new Date(now.getTime() - 26 * 24 * 60 * 60 * 1000);
      const snap = await colRef("userProfiles")
        .where("subscriptionStatus", "==", "free")
        .where("createdAt", ">=", cutoffStart)
        .where("createdAt", "<", cutoffEnd)
        .select("userId", "notificationsEnabled")
        .get();
      for (const doc of snap.docs) {
        const data = doc.data() as {
          userId?: string;
          notificationsEnabled?: boolean;
        };
        if (!data.userId || !data.notificationsEnabled) continue;
        await sendForTemplate(data.userId, "discount_on_premium", {});
      }
      console.log(`[cron] discount_on_premium: scanned ${snap.size} candidates`);
    }

    // ─── Discount on business (premium users, T+30 days since first purchase) ─
    {
      const cutoffEnd = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const cutoffStart = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000);
      const snap = await colRef("userProfiles")
        .where("subscriptionStatus", "==", "premium")
        .where("firstPurchaseAt", ">=", cutoffStart)
        .where("firstPurchaseAt", "<", cutoffEnd)
        .select("userId", "notificationsEnabled")
        .get();
      for (const doc of snap.docs) {
        const data = doc.data() as {
          userId?: string;
          notificationsEnabled?: boolean;
        };
        if (!data.userId || !data.notificationsEnabled) continue;
        await sendForTemplate(data.userId, "discount_on_business", {});
      }
      console.log(`[cron] discount_on_business: scanned ${snap.size} candidates`);
    }

    // ─── Deal alert match (premium/business users with saved alerts) ─
    {
      const alertsSnap = await colRef("dealAlerts")
        .where("status", "==", "active")
        .get();

      if (!alertsSnap.empty) {
        type AlertRecord = { id: string; destination: string; month: string | null };
        type DealRecord = { destination?: string; price?: number; discount_pct?: number; travel_window?: string };

        // Group active alerts by userId.
        const alertsByUser = new Map<string, AlertRecord[]>();
        for (const doc of alertsSnap.docs) {
          const data = doc.data() as { userId?: string; destination?: string; month?: string | null };
          if (!data.userId || !data.destination) continue;
          if (!alertsByUser.has(data.userId)) alertsByUser.set(data.userId, []);
          alertsByUser.get(data.userId)!.push({ id: doc.id, destination: data.destination, month: data.month ?? null });
        }

        // Cache deal fetches by home airport to avoid redundant API calls.
        const dealsByAirport = new Map<string, DealRecord[]>();
        const fetchDeals = async (airport: string): Promise<DealRecord[]> => {
          if (dealsByAirport.has(airport)) return dealsByAirport.get(airport)!;
          try {
            const res = await fetch(`${DEALS_API_BASE}/deals/${airport}?limit=500`, {
              headers: { "x-api-key": DEALS_API_KEY },
            });
            if (!res.ok) { dealsByAirport.set(airport, []); return []; }
            const raw = await res.json() as unknown;
            const list: DealRecord[] = Array.isArray(raw)
              ? (raw as DealRecord[])
              : (((raw as Record<string, unknown>).deals as DealRecord[]) ?? []);
            dealsByAirport.set(airport, list);
            return list;
          } catch {
            dealsByAirport.set(airport, []);
            return [];
          }
        };

        let sent = 0;
        for (const [userId, alerts] of alertsByUser) {
          const profileSnap = await colRef("userProfiles")
            .where("userId", "==", userId)
            .limit(1)
            .select("homeAirport", "subscriptionStatus", "notificationsEnabled")
            .get();
          if (profileSnap.empty) continue;
          const profile = profileSnap.docs[0].data() as {
            homeAirport?: string;
            subscriptionStatus?: string;
            notificationsEnabled?: boolean;
          };
          if (!profile.notificationsEnabled) continue;
          if (profile.subscriptionStatus !== "premium" && profile.subscriptionStatus !== "business") continue;
          if (!profile.homeAirport) continue;

          const deals = await fetchDeals(profile.homeAirport);

          for (const alert of alerts) {
            const alertDest = alert.destination.toLowerCase();
            const match = deals.find((d) => {
              const dealDest = (d.destination ?? "").toLowerCase();
              const destMatch = dealDest.includes(alertDest) || alertDest.includes(dealDest);
              if (!destMatch) return false;
              if (!alert.month) return true;
              return (d.travel_window ?? "").toLowerCase().includes(alert.month.toLowerCase());
            });
            if (!match) continue;

            await sendForTemplate(userId, "deal_alert_match", {
              destination: alert.destination,
              price: match.price ?? 0,
              discount: Math.round(match.discount_pct ?? 0),
            });
            // Mark matched so this alert never fires again.
            await colRef("dealAlerts").doc(alert.id).update({ status: "matched" });
            sent++;
          }
        }
        console.log(`[cron] deal_alert_match: sent ${sent} notifications, scanned ${alertsSnap.size} active alerts`);
      } else {
        console.log("[cron] deal_alert_match: no active alerts");
      }
    }
}

/**
 * Optional staging cron. Off by default (decision 6: "Off"). Enable on a
 * per-deploy basis by setting `ENABLE_STAGING_CRON=1` in the function's
 * env. Reads/writes staging_* collections; otherwise identical to the
 * prod variant. Useful when QA needs to verify a notification trigger
 * end-to-end before shipping.
 */
export const dailyStagingNotificationTriggers =
  process.env.ENABLE_STAGING_CRON === "1"
    ? onSchedule(
        {
          schedule: "0 14 * * *",
          timeZone: "UTC",
          secrets: [adminApiToken],
        },
        async () => runWithEnv("staging", () => runDailyNotifications())
      )
    : null;
