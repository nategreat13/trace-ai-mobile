import { getSubscriptionSummary } from "@/lib/revenuecat";
import {
  getSignupsByDay,
  getEventCountsByName,
  getFunnelCounts,
  getRetentionCohorts,
  getAdSpend,
  getUserCount,
  getUniqueDeviceCount,
  getPurchaseFlowFunnel,
  getLoginCount,
  getSubscriptionLifecycle,
  getPurchaseFailuresByDay,
} from "@/lib/analytics-queries";
import {
  getExcludedSets,
  getExclusionCount,
  getValidUserIds,
} from "@/lib/exclusions";
import { getAdminEnv } from "@/lib/env";
import AnalyticsDashboardClient from "./dashboard-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AnalyticsPage() {
  const env = await getAdminEnv();
  // Resolve the exclusion list and the set of valid (non-deleted) userIds
  // up front so every downstream query can filter both test/internal
  // accounts AND orphan events (events whose authoring user no longer
  // has a userProfile).
  const [excluded, validUserIds] = await Promise.all([
    getExcludedSets(env).catch((e) => {
      console.error("[analytics] failed to load exclusions:", e);
      return { userIds: new Set<string>(), emails: new Set<string>() };
    }),
    getValidUserIds(env).catch((e) => {
      console.error("[analytics] failed to load valid userIds:", e);
      return new Set<string>();
    }),
  ]);
  // Count exclusion docs directly, not userIds.size + emails.size. The
  // latter double-counts because each exclusion stores both an email
  // AND its resolved userId — 7 docs showed up as "14".
  const excludedCount = await getExclusionCount(env).catch(() => 0);

  // Kick off all the queries in parallel
  const [
    summary,
    signupsByDay,
    eventCounts,
    funnel,
    retention,
    adSpend,
    userCount,
    uniqueDeviceCount,
    purchaseFlow,
    loginCount,
    subscriptionLifecycle,
    purchaseFailuresByDay,
  ] = await Promise.all([
    getSubscriptionSummary().catch((e) => {
      console.error("[analytics] RC summary failed:", e);
      return null;
    }),
    getSignupsByDay(env, 30, excluded).catch(() => []),
    getEventCountsByName(env, 30, excluded, validUserIds).catch(() => []),
    getFunnelCounts(env, 30, excluded, validUserIds).catch(() => null),
    getRetentionCohorts(env, 8, excluded, validUserIds).catch(() => []),
    getAdSpend(env).catch(() => []),
    getUserCount(env, excluded).catch(() => 0),
    getUniqueDeviceCount(env, excluded, validUserIds).catch((e) => {
      console.error("[analytics] getUniqueDeviceCount failed:", e);
      return 0;
    }),
    getPurchaseFlowFunnel(env, 30, excluded, validUserIds).catch(() => null),
    getLoginCount(env, 30, excluded, validUserIds).catch(() => 0),
    getSubscriptionLifecycle(env, 30, excluded, validUserIds).catch(() => null),
    getPurchaseFailuresByDay(env, 30, excluded, validUserIds).catch(() => []),
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
      uniqueDeviceCount={uniqueDeviceCount}
      purchaseFlow={purchaseFlow}
      loginCount={loginCount}
      subscriptionLifecycle={subscriptionLifecycle}
      purchaseFailuresByDay={purchaseFailuresByDay}
      excludedCount={excludedCount}
    />
  );
}
