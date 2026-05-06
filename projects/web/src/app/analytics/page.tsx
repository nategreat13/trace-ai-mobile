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
import AnalyticsDashboardClient from "./dashboard-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AnalyticsPage() {
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
    getSignupsByDay(30).catch(() => []),
    getEventCountsByName(30).catch(() => []),
    getFunnelCounts(30).catch(() => null),
    getRetentionCohorts(8).catch(() => []),
    getAdSpend().catch(() => []),
    getUserCount().catch(() => 0),
    getPurchaseFlowFunnel(30).catch(() => null),
    getLoginCount(30).catch(() => 0),
    getSubscriptionLifecycle(30).catch(() => null),
    getPurchaseFailuresByDay(30).catch(() => []),
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
    />
  );
}
