"use client";

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { SubscriptionSummary } from "@/lib/revenuecat";
import CohortFilter from "./cohort-filter";

type SignupRow = { date: string; count: number };
type EventRow = { name: string; count: number };
type FunnelData = {
  landingViews: number;
  signupCompleted: number;
  onboardingCompleted: number;
  paywallViewed: number;
  purchaseCompleted: number;
};
type PurchaseFlowData = {
  paywallViewed: number;
  paywallCtaTapped: number;
  purchaseInitiated: number;
  purchaseCompleted: number;
  purchaseCanceled: number;
  purchaseFailed: number;
  failuresByCode: Array<{ code: string; count: number }>;
};
type TrialFunnelData = {
  paywallViewed: number;
  trialOfferShown: number;
  trialCtaTapped: number;
  trialStarted: number;
  trialStartedServer: number;
};
type TrialStateData = {
  currentlyInTrial: number;
  trialsStarted: number;
  converted: number;
};
type DepthDistribution = {
  key: string;
  label: string;
  totalEvents: number;
  usersWithAny: number;
  avgPerUser: number;
  avgPerActiveUser: number;
  medianPerActiveUser: number;
  buckets: Array<{ threshold: number; users: number; pct: number }>;
};
type EngagementDepth = {
  userBase: number;
  swipes: DepthDistribution;
  saves: DepthDistribution;
  views: DepthDistribution;
  clicks: DepthDistribution;
  sessions: DepthDistribution;
  swipesPerSession: number;
  swipesPerActiveDay: number;
  activeDays: number;
  totalSessions: number;
};
type TierBreakdown = { total: number; premium: number; business: number; unknown: number };
type SubscriptionLifecycleData = {
  renewed: TierBreakdown;
  voluntaryChurn: TierBreakdown;
  involuntaryChurn: TierBreakdown;
  billingIssues: TierBreakdown;
  changed: TierBreakdown;
  uncanceled: TierBreakdown;
};
type FailureDayRow = { date: string; count: number };
type RetentionRow = {
  weekStart: string;
  size: number;
  d1: number;
  d7: number;
  d30: number;
};
type AdSpendRow = { platform: string; month: string; spendCents: number };

interface Props {
  summary: SubscriptionSummary | null;
  signupsByDay: SignupRow[];
  eventCounts: EventRow[];
  funnel: FunnelData | null;
  retention: RetentionRow[];
  adSpend: AdSpendRow[];
  userCount: number;
  uniqueDeviceCount: number;
  purchaseFlow: PurchaseFlowData | null;
  trialFunnel: TrialFunnelData | null;
  trialState: TrialStateData | null;
  engagementDepth: EngagementDepth | null;
  loginCount: number;
  subscriptionLifecycle: SubscriptionLifecycleData | null;
  purchaseFailuresByDay: FailureDayRow[];
  excludedCount: number;
  cohortOptions: Array<{ key: string; label: string; count: number }>;
  selectedCohorts: string[] | null;
}

function dollars(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">
        {label}
      </div>
      <div className="text-3xl font-bold text-gray-900 mt-1">{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold text-gray-900 mb-4">{title}</h2>
      {children}
    </section>
  );
}

/**
 * One engagement metric: average + median, plus the threshold-bucket
 * distribution (# users with N+ of the action, and what % of the user base
 * that is). `notInstrumentedHint` shows a soft note when there's no data yet
 * (e.g. deal views/clicks before that event ships).
 */
function DepthCard({ d }: { d: DepthDistribution }) {
  const noData = d.totalEvents === 0;
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">{d.label}</h3>
        <span className="text-xs text-gray-400 tabular-nums">
          {d.totalEvents.toLocaleString()} total · {d.usersWithAny} users
        </span>
      </div>
      {noData ? (
        <p className="text-sm text-gray-400">
          No data yet — this event was only recently instrumented.
        </p>
      ) : (
        <>
          <div className="flex gap-6 mb-4">
            <div>
              <div className="text-2xl font-bold text-gray-900 tabular-nums">
                {d.avgPerUser.toFixed(1)}
              </div>
              <div className="text-xs text-gray-500">avg / user</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 tabular-nums">
                {d.avgPerActiveUser.toFixed(1)}
              </div>
              <div className="text-xs text-gray-500">avg / active user</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 tabular-nums">
                {d.medianPerActiveUser}
              </div>
              <div className="text-xs text-gray-500">median / active</div>
            </div>
          </div>
          <div className="grid grid-cols-6 gap-2">
            {d.buckets.map((b) => (
              <div key={b.threshold} className="text-center">
                <div className="text-xs text-gray-400 mb-1">{b.threshold}+</div>
                <div className="text-base font-semibold text-gray-900 tabular-nums">
                  {b.users}
                </div>
                <div className="text-xs text-gray-500 tabular-nums">
                  {Math.round(b.pct)}%
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function AnalyticsDashboardClient({
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
  excludedCount,
  cohortOptions,
  selectedCohorts,
}: Props) {
  const signupsTotal30 = signupsByDay.reduce((acc, r) => acc + r.count, 0);

  const spendByPlatform: Record<string, number> = {};
  for (const row of adSpend) {
    spendByPlatform[row.platform] = (spendByPlatform[row.platform] ?? 0) + row.spendCents;
  }
  const totalSpendCents = Object.values(spendByPlatform).reduce((a, b) => a + b, 0);

  return (
    <>
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Last 30 days. Data refreshes on every page load.
            {excludedCount > 0 && (
              <>
                {" · "}
                <a
                  href="/exclusions"
                  className="text-rose-500 hover:text-rose-600"
                >
                  {excludedCount} account{excludedCount === 1 ? "" : "s"} excluded
                </a>
              </>
            )}
          </p>
        </header>

        {/* Signup-version cohort filter — narrows ALL analytics below */}
        <CohortFilter options={cohortOptions} selected={selectedCohorts} />

        {/* Top-line stats */}
        <Section title="Overview">
          {/* 5 columns at md+ to fit the new Unique installs card next to
              Total users — they're related ("how many installed" vs "how
              many signed up"), so pairing them visually makes the install→
              signup gap easy to eyeball. */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatCard label="MRR" value={summary ? dollars(summary.mrrCents) : "—"} sub="Monthly recurring revenue" />
            <StatCard
              label="Active subscribers"
              value={summary?.activeSubscribers ?? "—"}
              sub={
                summary
                  ? `${summary.activeByTier.premium} premium · ${summary.activeByTier.business} business`
                  : undefined
              }
            />
            <StatCard
              label="Unique installs"
              value={uniqueDeviceCount.toLocaleString()}
              sub="Distinct devices that opened the app"
            />
            <StatCard
              label="Total users"
              value={userCount.toLocaleString()}
              sub={`${signupsTotal30} signups · ${loginCount.toLocaleString()} logins (30d)`}
            />
            <StatCard
              label="Trial conversions (30d)"
              value={summary?.trialConvertedLast30Days ?? "—"}
              sub={`${summary?.trialStartedLast30Days ?? 0} trials started`}
            />
          </div>
        </Section>

        {/* Subscription mix */}
        <Section title="Subscription mix">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="ARR" value={summary ? dollars(summary.arrCents) : "—"} />
            <StatCard
              label="Monthly plans"
              value={summary?.activeByBilling.monthly ?? "—"}
            />
            <StatCard
              label="Annual plans"
              value={summary?.activeByBilling.annual ?? "—"}
            />
            <StatCard
              label="Churn (30d)"
              value={summary?.churnedLast30Days ?? "—"}
              sub="Expired subscriptions"
            />
          </div>
        </Section>

        {/* Subscription lifecycle (server-side from RC webhook) */}
        {subscriptionLifecycle && (
          <Section title="Subscription lifecycle (last 30 days)">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <StatCard
                label="Renewals"
                value={subscriptionLifecycle.renewed.total.toLocaleString()}
                sub={`${subscriptionLifecycle.renewed.premium} premium · ${subscriptionLifecycle.renewed.business} business`}
              />
              <StatCard
                label="Voluntary churn"
                value={subscriptionLifecycle.voluntaryChurn.total.toLocaleString()}
                sub="Auto-renew turned off"
              />
              <StatCard
                label="Involuntary churn"
                value={subscriptionLifecycle.involuntaryChurn.total.toLocaleString()}
                sub="Billing failed / expired"
              />
              <StatCard
                label="Billing issues"
                value={subscriptionLifecycle.billingIssues.total.toLocaleString()}
                sub="In retry — may recover"
              />
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">
                Lifecycle events by tier
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-gray-600 text-left">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Event</th>
                      <th className="py-2 pr-4 font-medium text-right">Premium</th>
                      <th className="py-2 pr-4 font-medium text-right">Business</th>
                      <th className="py-2 pr-4 font-medium text-right">Unknown</th>
                      <th className="py-2 font-medium text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { name: "Renewed", row: subscriptionLifecycle.renewed },
                      { name: "Voluntary churn (canceled)", row: subscriptionLifecycle.voluntaryChurn },
                      { name: "Involuntary churn (expired)", row: subscriptionLifecycle.involuntaryChurn },
                      { name: "Billing issue", row: subscriptionLifecycle.billingIssues },
                      { name: "Plan changed (up/downgrade)", row: subscriptionLifecycle.changed },
                      { name: "Reactivated", row: subscriptionLifecycle.uncanceled },
                    ].map(({ name, row }) => (
                      <tr key={name} className="border-t border-gray-100">
                        <td className="py-2 pr-4 text-gray-700">{name}</td>
                        <td className="py-2 pr-4 text-right tabular-nums">{row.premium}</td>
                        <td className="py-2 pr-4 text-right tabular-nums">{row.business}</td>
                        <td className="py-2 pr-4 text-right tabular-nums text-gray-400">{row.unknown}</td>
                        <td className="py-2 text-right font-semibold text-gray-900 tabular-nums">{row.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-400 mt-3">
                Voluntary churn = user turned off auto-renew (winback opportunity).
                Involuntary churn = billing failed at renewal (payment retry opportunity).
                Different signals, different responses.
              </p>
            </div>
          </Section>
        )}

        {/* Signups over time */}
        <Section title="Signups (last 30 days)">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={signupsByDay}>
                  <defs>
                    <linearGradient id="signupGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#f43f5e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d) => d.slice(5)}
                    stroke="#9ca3af"
                    fontSize={11}
                  />
                  <YAxis stroke="#9ca3af" fontSize={11} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#f43f5e"
                    fill="url(#signupGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Section>

        {/* Funnel */}
        {funnel && (
          <Section title="Acquisition funnel (last 30 days)">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="space-y-3">
                {[
                  { name: "Landing page views", value: funnel.landingViews },
                  { name: "Signups completed", value: funnel.signupCompleted },
                  { name: "Onboarding completed", value: funnel.onboardingCompleted },
                  { name: "Paywall viewed", value: funnel.paywallViewed },
                  { name: "Purchase completed", value: funnel.purchaseCompleted },
                ].map((step, i, arr) => {
                  const top = arr[0].value || 1;
                  const pct = Math.round((step.value / top) * 100);
                  const prev = i > 0 ? arr[i - 1].value : null;
                  const dropoff =
                    prev && prev > 0 ? Math.round(((prev - step.value) / prev) * 100) : null;
                  return (
                    <div key={step.name}>
                      <div className="flex justify-between items-baseline mb-1">
                        <span className="text-sm font-medium text-gray-700">{step.name}</span>
                        <span className="text-sm tabular-nums">
                          <span className="font-semibold text-gray-900">
                            {step.value.toLocaleString()}
                          </span>
                          <span className="text-gray-400 ml-2">{pct}%</span>
                          {dropoff != null && i > 0 && (
                            <span className={`ml-2 text-xs ${dropoff > 50 ? "text-red-600" : "text-gray-400"}`}>
                              -{dropoff}%
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-rose-500 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Section>
        )}

        {/* Purchase flow */}
        {purchaseFlow && (
          <Section title="Purchase flow (last 30 days)">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Step funnel */}
              <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">
                  Drop-off through the upgrade flow
                </h3>
                <div className="space-y-3">
                  {[
                    { name: "Paywall viewed", value: purchaseFlow.paywallViewed },
                    { name: "Subscribe button tapped", value: purchaseFlow.paywallCtaTapped },
                    { name: "Purchase initiated (StoreKit shown)", value: purchaseFlow.purchaseInitiated },
                    { name: "Purchase completed", value: purchaseFlow.purchaseCompleted },
                  ].map((step, i, arr) => {
                    const top = arr[0].value || 1;
                    const pct = Math.round((step.value / top) * 100);
                    const prev = i > 0 ? arr[i - 1].value : null;
                    const dropoff =
                      prev && prev > 0
                        ? Math.round(((prev - step.value) / prev) * 100)
                        : null;
                    return (
                      <div key={step.name}>
                        <div className="flex justify-between items-baseline mb-1">
                          <span className="text-sm font-medium text-gray-700">
                            {step.name}
                          </span>
                          <span className="text-sm tabular-nums">
                            <span className="font-semibold text-gray-900">
                              {step.value.toLocaleString()}
                            </span>
                            <span className="text-gray-400 ml-2">{pct}%</span>
                            {dropoff != null && i > 0 && (
                              <span
                                className={`ml-2 text-xs ${
                                  dropoff > 50 ? "text-red-600" : "text-gray-400"
                                }`}
                              >
                                -{dropoff}%
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-rose-500 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Drop-off split: of the initiated purchases that didn't
                    complete, how many were user-canceled vs failed errors? */}
                {purchaseFlow.purchaseInitiated > 0 && (
                  <div className="mt-6 pt-5 border-t border-gray-100 grid grid-cols-3 gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">
                        Completed
                      </div>
                      <div className="text-2xl font-bold text-gray-900 tabular-nums">
                        {purchaseFlow.purchaseCompleted.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500">
                        {Math.round(
                          (purchaseFlow.purchaseCompleted /
                            purchaseFlow.purchaseInitiated) *
                            100
                        )}
                        % of initiated
                      </div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">
                        Canceled
                      </div>
                      <div className="text-2xl font-bold text-gray-900 tabular-nums">
                        {purchaseFlow.purchaseCanceled.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500">
                        User dismissed StoreKit
                      </div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">
                        Failed
                      </div>
                      <div
                        className={`text-2xl font-bold tabular-nums ${
                          purchaseFlow.purchaseFailed > 0
                            ? "text-red-600"
                            : "text-gray-900"
                        }`}
                      >
                        {purchaseFlow.purchaseFailed.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500">
                        StoreKit / RC error
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Top failure reasons */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">
                  Top failure reasons
                </h3>
                {purchaseFlow.failuresByCode.length === 0 ? (
                  <p className="text-sm text-gray-400">
                    No purchase failures in the last 30 days.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {purchaseFlow.failuresByCode.map((row) => (
                      <li
                        key={row.code}
                        className="flex justify-between items-baseline text-sm"
                      >
                        <span className="font-mono text-xs text-gray-700 break-all">
                          {row.code}
                        </span>
                        <span className="font-semibold text-gray-900 tabular-nums ml-3">
                          {row.count}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {purchaseFailuresByDay.length > 0 && (
                  <div className="mt-5 pt-4 border-t border-gray-100">
                    <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">
                      Failures over time
                    </div>
                    <div className="h-20">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={purchaseFailuresByDay}>
                          <defs>
                            <linearGradient id="failGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#dc2626" stopOpacity={0.3} />
                              <stop offset="100%" stopColor="#dc2626" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "white",
                              border: "1px solid #e5e7eb",
                              borderRadius: 8,
                              fontSize: 11,
                            }}
                            labelFormatter={(d) => d}
                          />
                          <Area
                            type="monotone"
                            dataKey="count"
                            stroke="#dc2626"
                            fill="url(#failGradient)"
                            strokeWidth={1.5}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-4">
                  Grouped by RevenueCat error_code. A spike in any single code
                  is a signal of a SKU misconfiguration or platform issue.
                </p>
              </div>
            </div>
          </Section>
        )}

        {/* Free trial funnel */}
        {trialFunnel && (
          <Section title="Free trial funnel (last 30 days)">
            {trialState && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <StatCard
                  label="Currently in trial"
                  value={trialState.currentlyInTrial}
                  sub="active right now"
                />
                <StatCard
                  label="Trials started (30d)"
                  value={trialState.trialsStarted}
                />
                <StatCard
                  label="Converted to paid (30d)"
                  value={trialState.converted}
                />
                <StatCard
                  label="Trial → paid rate"
                  value={
                    trialState.trialsStarted > 0
                      ? `${Math.round(
                          (trialState.converted / trialState.trialsStarted) * 100
                        )}%`
                      : "—"
                  }
                  sub="converted ÷ started (rough)"
                />
              </div>
            )}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">
                Trial path: offered → started
              </h3>
              <div className="space-y-3">
                {[
                  { name: "Paywall viewed", value: trialFunnel.paywallViewed },
                  { name: "Trial offer shown", value: trialFunnel.trialOfferShown },
                  { name: "Trial CTA tapped", value: trialFunnel.trialCtaTapped },
                  { name: "Trial started", value: trialFunnel.trialStarted },
                ].map((step, i, arr) => {
                  const top = arr[0].value || 1;
                  const pct = Math.round((step.value / top) * 100);
                  const prev = i > 0 ? arr[i - 1].value : null;
                  const dropoff =
                    prev && prev > 0
                      ? Math.round(((prev - step.value) / prev) * 100)
                      : null;
                  return (
                    <div key={step.name}>
                      <div className="flex justify-between items-baseline mb-1">
                        <span className="text-sm font-medium text-gray-700">
                          {step.name}
                        </span>
                        <span className="text-sm tabular-nums">
                          <span className="font-semibold text-gray-900">
                            {step.value.toLocaleString()}
                          </span>
                          <span className="text-gray-400 ml-2">{pct}%</span>
                          {dropoff != null && i > 0 && (
                            <span
                              className={`ml-2 text-xs ${
                                dropoff > 50 ? "text-red-600" : "text-gray-400"
                              }`}
                            >
                              -{dropoff}%
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-gray-400 mt-4">
                &quot;Trial offer shown&quot; fires only when a free trial is
                actually rendered (user eligible + product carries a free intro
                offer), so it&apos;s the true trial top-of-funnel. Client
                <span className="font-medium"> trial_started</span> ={" "}
                {trialFunnel.trialStarted.toLocaleString()} vs. server
                <span className="font-medium"> trial_started_server</span> ={" "}
                {trialFunnel.trialStartedServer.toLocaleString()} (RevenueCat
                webhook) — these should converge; a persistent gap means client
                events are dropping.
              </p>
            </div>
          </Section>
        )}

        {/* Engagement depth */}
        {engagementDepth && (
          <Section title="Engagement depth (last 30 days)">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
              <StatCard
                label="User base"
                value={engagementDepth.userBase}
                sub="non-excluded signups"
              />
              <StatCard
                label="Avg sessions / user"
                value={engagementDepth.sessions.avgPerUser.toFixed(1)}
                sub={`${engagementDepth.totalSessions} sessions`}
              />
              <StatCard
                label="Swipes / session"
                value={engagementDepth.swipesPerSession.toFixed(1)}
              />
              <StatCard
                label="Swipes / active day"
                value={engagementDepth.swipesPerActiveDay.toFixed(1)}
                sub={`${engagementDepth.activeDays} active days`}
              />
              <StatCard
                label="Avg swipes / user"
                value={engagementDepth.swipes.avgPerUser.toFixed(1)}
                sub={`${engagementDepth.swipes.totalEvents} swipes`}
              />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <DepthCard d={engagementDepth.swipes} />
              <DepthCard d={engagementDepth.saves} />
              <DepthCard d={engagementDepth.views} />
              <DepthCard d={engagementDepth.clicks} />
              <DepthCard d={engagementDepth.sessions} />
            </div>
            <p className="text-xs text-gray-400 mt-3">
              % columns are share of the {engagementDepth.userBase}-user
              non-excluded base. &quot;Active user&quot; = did the action at
              least once. Sessions = distinct sessions containing any deal
              interaction (app_open is under-instrumented, so not used). Deal
              views &amp; URL clicks were instrumented recently and backfill from
              ship date forward.
            </p>
          </Section>
        )}

        {/* Retention cohorts */}
        {retention.length > 0 && (
          <Section title="Retention by signup week">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Week of</th>
                    <th className="px-4 py-3 text-right font-medium">Signups</th>
                    <th className="px-4 py-3 text-right font-medium">Day 1</th>
                    <th className="px-4 py-3 text-right font-medium">Day 7</th>
                    <th className="px-4 py-3 text-right font-medium">Day 30</th>
                  </tr>
                </thead>
                <tbody>
                  {retention.map((row) => (
                    <tr key={row.weekStart} className="border-t border-gray-100">
                      <td className="px-4 py-3">{row.weekStart}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{row.size}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{row.d1}%</td>
                      <td className="px-4 py-3 text-right tabular-nums">{row.d7}%</td>
                      <td className="px-4 py-3 text-right tabular-nums">{row.d30}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}

        {/* Per-platform CAC */}
        <Section title="Ad spend & CAC (last 30 days)">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-500">
                Manually enter monthly ad spend per platform to compute CAC.
              </p>
              <a
                href="/spend"
                className="text-sm font-medium text-rose-500 hover:text-rose-600"
              >
                Manage spend →
              </a>
            </div>
            {totalSpendCents === 0 ? (
              <p className="text-sm text-gray-400">
                No ad spend recorded yet. Add spend to see CAC.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-gray-600 text-left">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Platform</th>
                      <th className="py-2 pr-4 font-medium text-right">Spend (30d)</th>
                      <th className="py-2 pr-4 font-medium text-right">Signups</th>
                      <th className="py-2 pr-4 font-medium text-right">CAC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(spendByPlatform).map(([platform, cents]) => {
                      // Attribution is not wired yet — leave signups blank until
                      // server-side conversion APIs attribute signups to platforms
                      return (
                        <tr key={platform} className="border-t border-gray-100">
                          <td className="py-2 pr-4 capitalize">{platform}</td>
                          <td className="py-2 pr-4 text-right tabular-nums">
                            {dollars(cents)}
                          </td>
                          <td className="py-2 pr-4 text-right text-gray-400">—</td>
                          <td className="py-2 pr-4 text-right text-gray-400">—</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Section>

        {/* Top events */}
        {eventCounts.length > 0 && (
          <Section title="Top events (last 30 days)">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={eventCounts.slice(0, 15)} layout="vertical" margin={{ left: 140 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis type="number" stroke="#9ca3af" fontSize={11} />
                    <YAxis
                      dataKey="name"
                      type="category"
                      stroke="#9ca3af"
                      fontSize={11}
                      width={140}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "white",
                        border: "1px solid #e5e7eb",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="count" fill="#f43f5e" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Section>
        )}
    </>
  );
}
