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

type SignupRow = { date: string; count: number };
type EventRow = { name: string; count: number };
type FunnelData = {
  landingViews: number;
  signupCompleted: number;
  onboardingCompleted: number;
  paywallViewed: number;
  purchaseCompleted: number;
};
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

export default function AnalyticsDashboardClient({
  summary,
  signupsByDay,
  eventCounts,
  funnel,
  retention,
  adSpend,
  userCount,
}: Props) {
  const signupsTotal30 = signupsByDay.reduce((acc, r) => acc + r.count, 0);

  const spendByPlatform: Record<string, number> = {};
  for (const row of adSpend) {
    spendByPlatform[row.platform] = (spendByPlatform[row.platform] ?? 0) + row.spendCents;
  }
  const totalSpendCents = Object.values(spendByPlatform).reduce((a, b) => a + b, 0);

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-6">
      <div className="max-w-7xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Trace Analytics</h1>
            <p className="text-sm text-gray-500 mt-1">
              Last 30 days. Data refreshes on every page load.
            </p>
          </div>
          <form action="/analytics/logout" method="POST">
            <button
              type="submit"
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:border-gray-400"
            >
              Sign out
            </button>
          </form>
        </header>

        {/* Top-line stats */}
        <Section title="Overview">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
              label="Total users"
              value={userCount.toLocaleString()}
              sub={`${signupsTotal30} signups in last 30d`}
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
                href="/analytics/spend"
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
      </div>
    </main>
  );
}
