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
  getPlatformMix,
  NO_VERSION_COHORT,
} from "@/lib/analytics-queries";
import {
  getExcludedSets,
  getExclusionCount,
  getValidUserIds,
} from "@/lib/exclusions";
import { getAdminEnv, getAdminCohorts } from "@/lib/env";
import AnalyticsDashboardClient from "./dashboard-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AnalyticsPage() {
  const env = await getAdminEnv();
  // Selected signup-version cohorts, persisted in a cookie. null = all.
  const selectedCohorts = await getAdminCohorts();

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
        deviceVersion: {} as Record<string, string>,
      };
    }),
  ]);

  // Narrow the population to the selected cohorts. `populationUserIds` feeds
  // every user-keyed query (engagement, trials, signups, counts, etc.) — so
  // the whole dashboard moves together. No selection = full population.
  const allowed =
    selectedCohorts && selectedCohorts.length > 0
      ? new Set(selectedCohorts)
      : null;
  const populationUserIds = allowed
    ? new Set(
        [...validUserIds].filter((uid) =>
          allowed.has(cohortData.userVersion[uid] ?? NO_VERSION_COHORT)
        )
      )
    : validUserIds;

  // Device set for the guest/device-keyed metrics (acquisition funnel's
  // landing stage + unique installs), which have no userId to filter on.
  // Only built when a cohort is active; undefined = no device filter.
  const cohortDeviceIds = allowed
    ? new Set(
        Object.entries(cohortData.deviceVersion)
          .filter(([, v]) => allowed.has(v))
          .map(([did]) => did)
      )
    : undefined;
  // The cohort user-set passed alongside it (undefined when no cohort active).
  const cohortUserSet = allowed ? populationUserIds : undefined;

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
    platformMix,
  ] = await Promise.all([
    getSubscriptionSummary().catch((e) => {
      console.error("[analytics] RC summary failed:", e);
      return null;
    }),
    getSignupsByDay(env, 30, excluded, populationUserIds).catch(() => []),
    getEventCountsByName(env, 30, excluded, populationUserIds).catch(() => []),
    // Funnel: full validUserIds for orphan filtering + the cohort user/device
    // sets so guest stages (landing) and pre-profile stages (signup) filter too.
    getFunnelCounts(env, 30, excluded, validUserIds, cohortUserSet, cohortDeviceIds).catch(() => null),
    getRetentionCohorts(env, 8, excluded, populationUserIds).catch(() => []),
    getAdSpend(env).catch(() => []),
    getUserCount(env, excluded, populationUserIds).catch(() => 0),
    // Installs: full validUserIds for orphan filtering + cohort device set
    // (guest installs have no userId, so they can only be cohort-filtered by device).
    getUniqueDeviceCount(env, excluded, validUserIds, cohortDeviceIds).catch((e) => {
      console.error("[analytics] getUniqueDeviceCount failed:", e);
      return 0;
    }),
    getPurchaseFlowFunnel(env, 30, excluded, populationUserIds).catch(() => null),
    getTrialFunnel(env, 30, excluded, populationUserIds).catch(() => null),
    getTrialStateSummary(env, 30, excluded, populationUserIds).catch(() => null),
    getEngagementDepth(env, 30, excluded, populationUserIds).catch(() => null),
    getLoginCount(env, 30, excluded, populationUserIds).catch(() => 0),
    getSubscriptionLifecycle(env, 30, excluded, populationUserIds).catch(() => null),
    getPurchaseFailuresByDay(env, 30, excluded, populationUserIds).catch(() => []),
    getPlatformMix(env, excluded, populationUserIds).catch((e) => {
      console.error("[analytics] getPlatformMix failed:", e);
      return { ios: 0, android: 0, web: 0, unknown: 0, total: 0 };
    }),
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
      platformMix={platformMix}
      excludedCount={excludedCount}
      cohortOptions={cohortData.options}
      selectedCohorts={selectedCohorts}
    />
  );
}
