import { getSubscriptionSummary } from "@/lib/revenuecat";
import {
  getSignupsByDay,
  getEventCountsByName,
  getFunnelCounts,
  getRetentionCohorts,
  getAdSpend,
  getUserCount,
  getPurchaseFlowFunnel,
  getLoginCount,
  getSubscriptionLifecycle,
  getPurchaseFailuresByDay,
} from "@/lib/analytics-queries";
import { getExcludedSets } from "@/lib/exclusions";
import AnalyticsDashboardClient from "./dashboard-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AnalyticsPage() {
  // Resolve the exclusion list first (one Firestore round-trip) so every
  // downstream query can filter test/internal accounts out before
  // aggregation.
  const excluded = await getExcludedSets().catch((e) => {
    console.error("[analytics] failed to load exclusions:", e);
    return { userIds: new Set<string>(), emails: new Set<string>() };
  });
  const excludedCount = excluded.userIds.size + excluded.emails.size;

  // Kick off all the queries in parallel
  const [
    summary,
    signupsByDay,
    eventCounts,
    funnel,
    retention,
    adSpend,
    userCount,
    purchaseFlow,
    loginCount,
    subscriptionLifecycle,
    purchaseFailuresByDay,
  ] = await Promise.all([
    getSubscriptionSummary().catch((e) => {
      console.error("[analytics] RC summary failed:", e);
      return null;
    }),
    getSignupsByDay(30, excluded).catch(() => []),
    getEventCountsByName(30, excluded).catch(() => []),
    getFunnelCounts(30, excluded).catch(() => null),
    getRetentionCohorts(8, excluded).catch(() => []),
    getAdSpend().catch(() => []),
    getUserCount(excluded).catch(() => 0),
    getPurchaseFlowFunnel(30, excluded).catch(() => null),
    getLoginCount(30, excluded).catch(() => 0),
    getSubscriptionLifecycle(30, excluded).catch(() => null),
    getPurchaseFailuresByDay(30, excluded).catch(() => []),
  ]);

  return (
    <AnalyticsDashboardClient
      summary={summary}
      signupsByDay={signupsByDay}
      eventCounts={eventCounts}
      funnel={funnel}
      retention={retention}
      adSpend={adSpend}
      userCount={userCount}
      purchaseFlow={purchaseFlow}
      loginCount={loginCount}
      subscriptionLifecycle={subscriptionLifecycle}
      purchaseFailuresByDay={purchaseFailuresByDay}
      excludedCount={excludedCount}
    />
  );
}
