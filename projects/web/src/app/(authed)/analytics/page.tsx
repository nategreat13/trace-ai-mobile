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
  getTrialFunnel,
  getTrialStateSummary,
  getEngagementDepth,
  getLoginCount,
  getSubscriptionLifecycle,
  getPurchaseFailuresByDay,
  getCohortData,
  NO_VERSION_COHORT,
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

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ cohorts?: string }>;
}) {
  const env = await getAdminEnv();
  const params = await searchParams;
  // Selected signup-version cohorts (comma-separated keys in the URL).
  // Absent/empty = include all cohorts.
  const selectedCohorts =
    params?.cohorts && params.cohorts.trim()
      ? params.cohorts.split(",").map((s) => s.trim()).filter(Boolean)
      : null;

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
  const [excludedCount, cohortData] = await Promise.all([
    getExclusionCount(env).catch(() => 0),
    getCohortData(env, excluded).catch((e) => {
      console.error("[analytics] failed to load cohorts:", e);
      return {
        options: [] as Array<{ key: string; label: string; count: number }>,
        userVersion: {} as Record<string, string>,
      };
    }),
  ]);

  // Narrow the population to the selected cohorts. This single set feeds
  // every query — event filters AND user-count denominators — so the whole
  // dashboard moves together. No selection = full population (no-op).
  let cohortUserIds = validUserIds;
  if (selectedCohorts && selectedCohorts.length > 0) {
    const allowed = new Set(selectedCohorts);
    cohortUserIds = new Set(
      [...validUserIds].filter((uid) =>
        allowed.has(cohortData.userVersion[uid] ?? NO_VERSION_COHORT)
      )
    );
  }

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
    trialFunnel,
    trialState,
    engagementDepth,
    loginCount,
    subscriptionLifecycle,
    purchaseFailuresByDay,
  ] = await Promise.all([
    getSubscriptionSummary().catch((e) => {
      console.error("[analytics] RC summary failed:", e);
      return null;
    }),
    getSignupsByDay(env, 30, excluded, cohortUserIds).catch(() => []),
    getEventCountsByName(env, 30, excluded, cohortUserIds).catch(() => []),
    getFunnelCounts(env, 30, excluded, cohortUserIds).catch(() => null),
    getRetentionCohorts(env, 8, excluded, cohortUserIds).catch(() => []),
    getAdSpend(env).catch(() => []),
    getUserCount(env, excluded, cohortUserIds).catch(() => 0),
    getUniqueDeviceCount(env, excluded, cohortUserIds).catch((e) => {
      console.error("[analytics] getUniqueDeviceCount failed:", e);
      return 0;
    }),
    getPurchaseFlowFunnel(env, 30, excluded, cohortUserIds).catch(() => null),
    getTrialFunnel(env, 30, excluded, cohortUserIds).catch(() => null),
    getTrialStateSummary(env, 30, excluded, cohortUserIds).catch(() => null),
    getEngagementDepth(env, 30, excluded, cohortUserIds).catch(() => null),
    getLoginCount(env, 30, excluded, cohortUserIds).catch(() => 0),
    getSubscriptionLifecycle(env, 30, excluded, cohortUserIds).catch(() => null),
    getPurchaseFailuresByDay(env, 30, excluded, cohortUserIds).catch(() => []),
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
      trialFunnel={trialFunnel}
      trialState={trialState}
      engagementDepth={engagementDepth}
      loginCount={loginCount}
      subscriptionLifecycle={subscriptionLifecycle}
      purchaseFailuresByDay={purchaseFailuresByDay}
      excludedCount={excludedCount}
      cohortOptions={cohortData.options}
      selectedCohorts={selectedCohorts}
    />
  );
}
