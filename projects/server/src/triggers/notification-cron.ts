import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import { colRef } from "../firebase";
import { runWithEnv } from "../env";
import { sendToUser } from "../lib/push";
import { getTemplate, renderString, TEMPLATE_CATEGORY } from "../lib/notification-templates";

type NotificationPrefs = {
  deals?: boolean;
  account?: boolean;
  reengagement?: boolean;
  offers?: boolean;
};

const DEALS_API_BASE = "https://us-central1-embarckstravel.cloudfunctions.net/api";
const DEALS_API_KEY = process.env.DEALS_API_KEY || "web-api-key";

type RawDeal = {
  discount_pct?: number;
  percentOff?: number;
  destination?: string;
  price?: number;
  dealPriceUSD?: number;
  domestic_or_international?: string;
  domesticOrInternational?: string;
  deal_type?: string | null;
  type?: string | null;
};

/**
 * Returns the deal type tags for a deal based on destination keywords and price.
 * Mirrors the logic in projects/app/src/lib/dealClassifier.ts — kept in sync manually.
 */
function classifyDeal(deal: RawDeal): string[] {
  const types = new Set<string>();
  const dest = (deal.destination || "").toLowerCase();
  const price = deal.dealPriceUSD ?? deal.price ?? 0;
  const discount = deal.percentOff ?? deal.discount_pct ?? 0;
  const apiType = (deal.type ?? deal.deal_type ?? "").toLowerCase();

  if (apiType) types.add(apiType);
  if (price > 0 && price <= 350) types.add("budget");
  if (discount >= 35) types.add("budget");
  if (price >= 800 || /maldives|bora bora|dubai|mykonos|santorini|seychelles|tahiti|aspen|monaco/.test(dest)) types.add("luxury");
  if (/patagonia|peru|machu picchu|galapagos|costa rica|kenya|safari|nepal|iceland|faroe|fjord|dolomites|queenstown|milford/.test(dest)) types.add("adventure");
  if (/rome|paris|athens|istanbul|cairo|florence|venice|kyoto|delhi|agra|marrakech|mexico city|havana|istanbul/.test(dest)) types.add("cultural");
  if (/cancun|cabo|bali|phuket|hawaii|honolulu|maui|bahamas|aruba|punta cana|maldives|seychelles|riviera|barbados|jamaica/.test(dest)) types.add("relaxation");
  if (/orlando|disney|universal|san diego|new york|chicago|london|paris|tokyo|sydney|cancun|bahamas|hawaii/.test(dest)) types.add("family");

  return Array.from(types);
}

/**
 * Returns the best deal for a user given their preferences.
 * - Respects destinationPreference (domestic / international / both)
 * - Respects dealTypes (filters by classified type; "surprise" matches everything)
 * - Among matching deals, picks the highest discount_pct
 */
function pickDealForUser(
  deals: RawDeal[],
  dealTypes: string[],
  destinationPreference: string,
): RawDeal | null {
  const wantsSurprise = dealTypes.length === 0 || dealTypes.includes("surprise");

  const filtered = deals.filter((d) => {
    // Domestic / international filter
    if (destinationPreference !== "both") {
      const isdom = (d.domesticOrInternational ?? d.domestic_or_international ?? "").toLowerCase() === "domestic";
      if (destinationPreference === "domestic" && !isdom) return false;
      if (destinationPreference === "international" && isdom) return false;
    }
    // Deal type filter
    if (wantsSurprise) return true;
    const tags = classifyDeal(d);
    return dealTypes.some((t) => tags.includes(t));
  });

  if (filtered.length === 0) return null;
  return filtered.reduce((a, b) => (a.percentOff ?? a.discount_pct ?? 0) >= (b.percentOff ?? b.discount_pct ?? 0) ? a : b);
}

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
  vars: Record<string, string | number>,
  prefs?: NotificationPrefs
): Promise<void> {
  if (prefs) {
    const category = TEMPLATE_CATEGORY[templateKey];
    if (category && prefs[category] === false) return;
  }
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
 * In-memory cache for deals fetched from the external API during a single
 * cron run. Keyed by airport code. Prevents re-fetching the same airport
 * for users who share a home airport.
 */
const _dealsFetchCache = new Map<string, RawDeal[]>();

async function fetchDealsForAirport(airport: string): Promise<RawDeal[]> {
  if (_dealsFetchCache.has(airport)) return _dealsFetchCache.get(airport)!;
  try {
    const res = await fetch(`${DEALS_API_BASE}/deals/${airport}?limit=500`, {
      headers: { "x-api-key": DEALS_API_KEY },
    });
    if (!res.ok) { _dealsFetchCache.set(airport, []); return []; }
    const raw = await res.json() as unknown;
    const deals: RawDeal[] = Array.isArray(raw)
      ? (raw as RawDeal[])
      : (((raw as Record<string, unknown>).deals as RawDeal[]) ?? []);
    _dealsFetchCache.set(airport, deals);
    return deals;
  } catch {
    _dealsFetchCache.set(airport, []);
    return [];
  }
}

/**
 * Returns the real count of deals available for a home airport.
 * Used as the {{dealCount}} variable in re-engagement templates.
 */
async function dealCountForUser(homeAirport: string | undefined): Promise<number> {
  if (!homeAirport) return 0;
  const deals = await fetchDealsForAirport(homeAirport);
  return deals.length;
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
        .select("userId", "homeAirport", "notificationsEnabled", "notificationPreferences")
        .get();
      for (const doc of snap.docs) {
        const data = doc.data() as {
          userId?: string;
          homeAirport?: string;
          notificationsEnabled?: boolean;
          notificationPreferences?: NotificationPrefs;
        };
        if (!data.userId || !data.notificationsEnabled) continue;
        const dealCount = await dealCountForUser(data.homeAirport);
        await sendForTemplate(data.userId, "welcome", {
          dealCount,
          homeAirport: data.homeAirport ?? "your home airport",
        }, data.notificationPreferences);
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
        .select("userId", "notificationsEnabled", "notificationPreferences")
        .get();
      for (const doc of snap.docs) {
        const data = doc.data() as {
          userId?: string;
          notificationsEnabled?: boolean;
          notificationPreferences?: NotificationPrefs;
        };
        if (!data.userId || !data.notificationsEnabled) continue;
        await sendForTemplate(data.userId, "trial_ending_3d", {}, data.notificationPreferences);
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
        .select("userId", "notificationsEnabled", "notificationPreferences")
        .get();
      for (const doc of snap.docs) {
        const data = doc.data() as {
          userId?: string;
          notificationsEnabled?: boolean;
          notificationPreferences?: NotificationPrefs;
        };
        if (!data.userId || !data.notificationsEnabled) continue;
        await sendForTemplate(data.userId, "trial_ending_24h", {}, data.notificationPreferences);
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
        .select("userId", "homeAirport", "notificationsEnabled", "notificationPreferences", "dealTypes", "destinationPreference")
        .get();
      for (const doc of snap.docs) {
        const data = doc.data() as {
          userId?: string;
          homeAirport?: string;
          notificationsEnabled?: boolean;
          notificationPreferences?: NotificationPrefs;
          dealTypes?: string[];
          destinationPreference?: string;
        };
        if (!data.userId || !data.notificationsEnabled) continue;
        const deals = await fetchDealsForAirport(data.homeAirport ?? "");
        if (deals.length === 0) continue; // no deals at all — skip
        const dealCount = deals.length;
        // Prefer a deal matching the user's preferences; fall back to the
        // overall best deal so we never send with a blank destination or $0 price.
        const best = pickDealForUser(deals, data.dealTypes ?? [], data.destinationPreference ?? "both")
          ?? pickDealForUser(deals, [], "both");
        const price = best?.dealPriceUSD ?? best?.price ?? 0;
        if (!best?.destination || !price) continue;
        await sendForTemplate(data.userId, "inactivity_3d", {
          dealCount,
          homeAirport: data.homeAirport ?? "your home airport",
          destination: best.destination,
          price,
        }, data.notificationPreferences);
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
        .select("userId", "homeAirport", "notificationsEnabled", "notificationPreferences", "dealTypes", "destinationPreference")
        .get();
      for (const doc of snap.docs) {
        const data = doc.data() as {
          userId?: string;
          homeAirport?: string;
          notificationsEnabled?: boolean;
          notificationPreferences?: NotificationPrefs;
          dealTypes?: string[];
          destinationPreference?: string;
        };
        if (!data.userId || !data.notificationsEnabled) continue;
        const deals = await fetchDealsForAirport(data.homeAirport ?? "");
        if (deals.length === 0) continue;
        const dealCount = deals.length;
        const best = pickDealForUser(deals, data.dealTypes ?? [], data.destinationPreference ?? "both")
          ?? pickDealForUser(deals, [], "both");
        const price = best?.dealPriceUSD ?? best?.price ?? 0;
        if (!best?.destination || !price) continue;
        await sendForTemplate(data.userId, "inactivity_7d", {
          dealCount,
          homeAirport: data.homeAirport ?? "your home airport",
          destination: best.destination,
          price,
        }, data.notificationPreferences);
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
        .select("userId", "homeAirport", "notificationsEnabled", "notificationPreferences", "dealTypes", "destinationPreference")
        .get();
      for (const doc of snap.docs) {
        const data = doc.data() as {
          userId?: string;
          homeAirport?: string;
          notificationsEnabled?: boolean;
          notificationPreferences?: NotificationPrefs;
          dealTypes?: string[];
          destinationPreference?: string;
        };
        if (!data.userId || !data.notificationsEnabled) continue;
        const deals = await fetchDealsForAirport(data.homeAirport ?? "");
        if (deals.length === 0) continue;
        const dealCount = deals.length;
        const best = pickDealForUser(deals, data.dealTypes ?? [], data.destinationPreference ?? "both")
          ?? pickDealForUser(deals, [], "both");
        const price = best?.dealPriceUSD ?? best?.price ?? 0;
        if (!best?.destination || !price) continue;
        await sendForTemplate(data.userId, "inactivity_14d", {
          dealCount,
          homeAirport: data.homeAirport ?? "your home airport",
          destination: best.destination,
          price,
        }, data.notificationPreferences);
      }
      console.log(`[cron] inactivity_14d: scanned ${snap.size} candidates`);
    }

    // ─── Hot deal alert (≥60% off, premium + business only) ───────
    {
      const hotDealTemplate = await getTemplate("hot_deal_alert");
      if (hotDealTemplate?.enabled) {
        const snap = await colRef("userProfiles")
          .where("notificationsEnabled", "==", true)
          .select("userId", "homeAirport", "subscriptionStatus", "notificationPreferences", "dealTypes", "destinationPreference")
          .get();

        // Group eligible users by home airport to minimise external API calls.
        const byAirport = new Map<string, Array<{
          userId: string;
          prefs?: NotificationPrefs;
          dealTypes: string[];
          destinationPreference: string;
        }>>();
        for (const doc of snap.docs) {
          const data = doc.data() as {
            userId?: string;
            homeAirport?: string;
            subscriptionStatus?: string;
            notificationPreferences?: NotificationPrefs;
            dealTypes?: string[];
            destinationPreference?: string;
          };
          if (!data.userId || !data.homeAirport) continue;
          if (data.subscriptionStatus !== "premium" && data.subscriptionStatus !== "business") continue;
          if (!byAirport.has(data.homeAirport)) byAirport.set(data.homeAirport, []);
          byAirport.get(data.homeAirport)!.push({
            userId: data.userId,
            prefs: data.notificationPreferences,
            dealTypes: data.dealTypes ?? [],
            destinationPreference: data.destinationPreference ?? "both",
          });
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
            const allDeals: RawDeal[] =
              Array.isArray(raw) ? raw : ((raw as Record<string, unknown>).deals as RawDeal[] ?? []);

            const hotDeals = allDeals.filter((d) => (d.percentOff ?? d.discount_pct ?? 0) >= 60);
            if (hotDeals.length === 0) continue;

            for (const user of users) {
              // Pick the best deal matching this user's preferences.
              const best = pickDealForUser(hotDeals, user.dealTypes, user.destinationPreference);
              if (!best) continue;

              // Dedup per user — skip if this destination was sent within the last 7 days.
              const destination = (best.destination ?? "").toLowerCase().trim();
              const cacheRef = colRef("hotDealCache").doc(user.userId);
              const cacheDoc = await cacheRef.get();
              const sentLog: Record<string, number> = cacheDoc.exists
                ? (cacheDoc.data()?.sentLog ?? {})
                : {};
              const lastSent = sentLog[destination] ?? 0;
              const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
              if (Date.now() - lastSent < sevenDaysMs) continue;
              sentLog[destination] = Date.now();
              // Prune entries older than 30 days to keep the doc small.
              const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
              for (const dest of Object.keys(sentLog)) {
                if (Date.now() - sentLog[dest] > thirtyDaysMs) delete sentLog[dest];
              }
              await cacheRef.set({ sentLog });

              await sendForTemplate(user.userId, "hot_deal_alert", {
                discount: Math.round(best.percentOff ?? best.discount_pct ?? 60),
                destination: best.destination ?? airport,
                price: best.dealPriceUSD ?? best.price ?? 0,
                homeAirport: airport,
              }, user.prefs);
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
          notificationPreferences?: NotificationPrefs;
        };
        if (!data.userId || !data.notificationsEnabled) continue;
        // Only paid subscribers — exclude trial users who share the same date field.
        if (data.subscriptionStatus !== "premium" && data.subscriptionStatus !== "business") continue;
        await sendForTemplate(data.userId, "subscription_renewal_24h", {}, data.notificationPreferences);
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
        .select("userId", "homeAirport", "notificationsEnabled", "notificationPreferences")
        .get();
      for (const doc of snap.docs) {
        const data = doc.data() as {
          userId?: string;
          homeAirport?: string;
          notificationsEnabled?: boolean;
          notificationPreferences?: NotificationPrefs;
        };
        if (!data.userId || !data.notificationsEnabled) continue;
        await sendForTemplate(data.userId, "business_class_nudge_5d", {
          homeAirport: data.homeAirport ?? "your home airport",
        }, data.notificationPreferences);
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
        .select("userId", "homeAirport", "notificationsEnabled", "notificationPreferences")
        .get();
      for (const doc of snap.docs) {
        const data = doc.data() as {
          userId?: string;
          homeAirport?: string;
          notificationsEnabled?: boolean;
          notificationPreferences?: NotificationPrefs;
        };
        if (!data.userId || !data.notificationsEnabled) continue;
        await sendForTemplate(data.userId, "business_class_nudge", {
          homeAirport: data.homeAirport ?? "your home airport",
        }, data.notificationPreferences);
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
        .select("userId", "homeAirport", "notificationsEnabled", "notificationPreferences")
        .get();
      for (const doc of snap.docs) {
        const data = doc.data() as {
          userId?: string;
          homeAirport?: string;
          notificationsEnabled?: boolean;
          notificationPreferences?: NotificationPrefs;
        };
        if (!data.userId || !data.notificationsEnabled) continue;
        await sendForTemplate(data.userId, "premium_nudge", {
          homeAirport: data.homeAirport ?? "your home airport",
        }, data.notificationPreferences);
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
        .select("userId", "homeAirport", "notificationsEnabled", "notificationPreferences")
        .get();
      for (const doc of snap.docs) {
        const data = doc.data() as {
          userId?: string;
          homeAirport?: string;
          notificationsEnabled?: boolean;
          notificationPreferences?: NotificationPrefs;
        };
        if (!data.userId || !data.notificationsEnabled) continue;
        await sendForTemplate(data.userId, "premium_nudge_10d", {
          homeAirport: data.homeAirport ?? "your home airport",
        }, data.notificationPreferences);
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
        .select("userId", "homeAirport", "notificationsEnabled", "notificationPreferences")
        .get();
      for (const doc of snap.docs) {
        const data = doc.data() as {
          userId?: string;
          homeAirport?: string;
          notificationsEnabled?: boolean;
          notificationPreferences?: NotificationPrefs;
        };
        if (!data.userId || !data.notificationsEnabled) continue;
        await sendForTemplate(data.userId, "premium_nudge_20d", {
          homeAirport: data.homeAirport ?? "your home airport",
        }, data.notificationPreferences);
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
        .select("userId", "notificationsEnabled", "notificationPreferences")
        .get();
      for (const doc of snap.docs) {
        const data = doc.data() as {
          userId?: string;
          notificationsEnabled?: boolean;
          notificationPreferences?: NotificationPrefs;
        };
        if (!data.userId || !data.notificationsEnabled) continue;
        await sendForTemplate(data.userId, "discount_on_premium", {}, data.notificationPreferences);
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
        .select("userId", "notificationsEnabled", "notificationPreferences")
        .get();
      for (const doc of snap.docs) {
        const data = doc.data() as {
          userId?: string;
          notificationsEnabled?: boolean;
          notificationPreferences?: NotificationPrefs;
        };
        if (!data.userId || !data.notificationsEnabled) continue;
        await sendForTemplate(data.userId, "discount_on_business", {}, data.notificationPreferences);
      }
      console.log(`[cron] discount_on_business: scanned ${snap.size} candidates`);
    }

    // ─── Deal of the day (all users, daily) ───────────────────────
    {
      const dotdTemplate = await getTemplate("deal_of_the_day");
      if (dotdTemplate?.enabled) {
        const snap = await colRef("userProfiles")
          .where("notificationsEnabled", "==", true)
          .select("userId", "homeAirport", "notificationPreferences", "dealTypes", "destinationPreference")
          .get();

        const byAirport = new Map<string, Array<{
          userId: string;
          prefs?: NotificationPrefs;
          dealTypes: string[];
          destinationPreference: string;
        }>>();
        for (const doc of snap.docs) {
          const data = doc.data() as {
            userId?: string;
            homeAirport?: string;
            notificationPreferences?: NotificationPrefs;
            dealTypes?: string[];
            destinationPreference?: string;
          };
          if (!data.userId || !data.homeAirport) continue;
          if (!byAirport.has(data.homeAirport)) byAirport.set(data.homeAirport, []);
          byAirport.get(data.homeAirport)!.push({
            userId: data.userId,
            prefs: data.notificationPreferences,
            dealTypes: data.dealTypes ?? [],
            destinationPreference: data.destinationPreference ?? "both",
          });
        }

        let sent = 0;
        const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
        for (const [airport, users] of byAirport) {
          const deals = await fetchDealsForAirport(airport);
          if (deals.length === 0) continue;
          for (const user of users) {
            const best = pickDealForUser(deals, user.dealTypes, user.destinationPreference)
              ?? pickDealForUser(deals, [], "both");
            if (!best?.destination) continue;
            const price = best.dealPriceUSD ?? best.price ?? 0;
            const discount = Math.round(best.percentOff ?? best.discount_pct ?? 0);
            if (!price || !discount) continue;

            // Dedup — skip if this destination was sent within 3 days.
            const destination = (best.destination).toLowerCase().trim();
            const cacheRef = colRef("dotdCache").doc(user.userId);
            const cacheDoc = await cacheRef.get();
            const sentLog: Record<string, number> = cacheDoc.exists ? (cacheDoc.data()?.sentLog ?? {}) : {};
            if (Date.now() - (sentLog[destination] ?? 0) < threeDaysMs) continue;
            sentLog[destination] = Date.now();
            // Prune entries older than 7 days.
            for (const dest of Object.keys(sentLog)) {
              if (Date.now() - sentLog[dest] > 7 * 24 * 60 * 60 * 1000) delete sentLog[dest];
            }
            await cacheRef.set({ sentLog });

            await sendForTemplate(user.userId, "deal_of_the_day", {
              destination: best.destination,
              price,
              discount,
            }, user.prefs);
            sent++;
          }
        }
        console.log(`[cron] deal_of_the_day: sent to ${sent} users`);
      } else {
        console.log("[cron] deal_of_the_day: template disabled, skipping");
      }
    }

    // ─── Deal alert match (premium/business users with saved alerts) ─
    {
      const alertsSnap = await colRef("dealAlerts")
        .where("status", "==", "active")
        .get();

      if (!alertsSnap.empty) {
        type AlertRecord = { id: string; destination: string; month: string | null };
        type DealRecord = { destination?: string; dealPriceUSD?: number; price?: number; percentOff?: number; discount_pct?: number; travel_window?: string; dateString?: string; monthType?: string };

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
            .select("homeAirport", "subscriptionStatus", "notificationsEnabled", "notificationPreferences")
            .get();
          if (profileSnap.empty) continue;
          const profile = profileSnap.docs[0].data() as {
            homeAirport?: string;
            subscriptionStatus?: string;
            notificationsEnabled?: boolean;
            notificationPreferences?: NotificationPrefs;
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
              const travelWindow = d.dateString ?? d.monthType ?? d.travel_window ?? "";
              return travelWindow.toLowerCase().includes(alert.month.toLowerCase());
            });
            if (!match) continue;

            const matchedPrice = match.dealPriceUSD ?? match.price ?? 0;
            const matchedDiscount = Math.round(match.percentOff ?? match.discount_pct ?? 0);
            await sendForTemplate(userId, "deal_alert_match", {
              destination: alert.destination,
              price: matchedPrice,
              discount: matchedDiscount,
            }, profile.notificationPreferences);
            // Store matched deal snapshot so the app can show a tappable deal card.
            await colRef("dealAlerts").doc(alert.id).update({
              status: "matched",
              matchedAt: new Date(),
              matchedDeal: {
                destination: match.destination ?? alert.destination,
                price: matchedPrice,
                discount: matchedDiscount,
                url: (match as any).url ?? null,
                imageUrl: (match as any).image_url ?? null,
                airlines: (match as any).airlines ?? null,
                travelWindow: (match as any).travel_window ?? (match as any).dateString ?? null,
                origin: (match as any).origin ?? null,
                destinationCode: (match as any).destination_code ?? null,
              },
            });
            sent++;
          }
        }
        console.log(`[cron] deal_alert_match: sent ${sent} notifications, scanned ${alertsSnap.size} active alerts`);
      } else {
        console.log("[cron] deal_alert_match: no active alerts");
      }
    }

    // ─── Cleanup stale matched alerts ────────────────────────────
    // Remove matched alerts where the deal is no longer in the live API
    // so the app's alerts tab stays clean automatically.
    {
      const matchedSnap = await colRef("dealAlerts")
        .where("status", "==", "matched")
        .get();

      if (!matchedSnap.empty) {
        // Group by userId to fetch home airports in bulk.
        const byUser = new Map<string, { docId: string; destination: string }[]>();
        for (const doc of matchedSnap.docs) {
          const data = doc.data() as { userId?: string; destination?: string };
          if (!data.userId || !data.destination) continue;
          if (!byUser.has(data.userId)) byUser.set(data.userId, []);
          byUser.get(data.userId)!.push({ docId: doc.id, destination: data.destination });
        }

        let removed = 0;
        for (const [userId, alerts] of byUser) {
          const profileSnap = await colRef("userProfiles")
            .where("userId", "==", userId)
            .limit(1)
            .select("homeAirport")
            .get();
          if (profileSnap.empty) continue;
          const homeAirport = (profileSnap.docs[0].data() as { homeAirport?: string }).homeAirport;
          if (!homeAirport) continue;

          const liveDeals = await fetchDealsForAirport(homeAirport);
          const liveDestinations = new Set(liveDeals.map((d) => (d.destination ?? "").toLowerCase()));

          for (const alert of alerts) {
            if (!liveDestinations.has(alert.destination.toLowerCase())) {
              await colRef("dealAlerts").doc(alert.docId).delete();
              removed++;
            }
          }
        }
        console.log(`[cron] stale_alert_cleanup: removed ${removed} of ${matchedSnap.size} matched alerts`);
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
