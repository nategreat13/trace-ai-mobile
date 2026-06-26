import { getAdminEnv } from "@/lib/env";
import { getExcludedSets } from "@/lib/exclusions";
import {
  getCohortEventMatrix,
  type CohortEventStage,
} from "@/lib/analytics-queries";
import CohortAiSummary from "./ai-summary";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const STAGES: CohortEventStage[] = [
  "Activation",
  "Engagement",
  "Paywall & purchase",
  "Notifications",
];

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);

/** Light heat shading so high-engagement rows pop without a legend. */
function cellTint(p: number): string {
  if (p >= 75) return "bg-rose-100 text-rose-900";
  if (p >= 40) return "bg-rose-50 text-rose-800";
  if (p >= 15) return "bg-amber-50 text-amber-800";
  if (p > 0) return "text-gray-700";
  return "text-gray-300";
}

export default async function CohortsPage() {
  const env = await getAdminEnv();
  const excluded = await getExcludedSets(env).catch(() => ({
    userIds: new Set<string>(),
    emails: new Set<string>(),
  }));
  const matrix = await getCohortEventMatrix(env, excluded).catch((e) => {
    console.error("[cohorts] getCohortEventMatrix failed:", e);
    return null;
  });

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-gray-900">Cohort journey</h1>
        <p className="text-sm text-gray-600 max-w-3xl">
          Distinct users from each signup-version cohort who reached every key
          step of the journey, in funnel order. Each cell shows the user count
          and that as a share of the cohort&apos;s signups. Test/internal
          accounts are excluded. Cohorts are tagged by the app version a user
          first onboarded on; columns show the {matrix?.cohorts.length ?? 0} most
          recent.
        </p>
      </header>

      {matrix && matrix.cohorts.length > 0 && <CohortAiSummary />}

      {!matrix || matrix.cohorts.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">
          No cohort data available.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="sticky left-0 z-10 bg-gray-50 px-4 py-3 text-left font-semibold text-gray-700">
                  Step
                </th>
                {matrix.cohorts.map((c) => (
                  <th
                    key={c.key}
                    className="px-4 py-3 text-right font-semibold text-gray-700 whitespace-nowrap"
                  >
                    <div>{c.label}</div>
                    <div className="text-xs font-normal text-gray-400">
                      {c.size} signups
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {STAGES.map((stage) => {
                const stageRows = matrix.rows.filter((r) => r.stage === stage);
                if (stageRows.length === 0) return null;
                return (
                  <StageGroup
                    key={stage}
                    stage={stage}
                    rows={stageRows}
                    cohorts={matrix.cohorts}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-400 max-w-3xl">
        Notes: counts are distinct users, not raw event fires. “Reached store
        popup” is <code>purchase_initiated</code> (the Apple/Google sheet), which
        fires together with the subscribe-button tap. Retention isn&apos;t shown
        here — see the Dashboard. Newest cohorts are still maturing, so their
        later-stage numbers will keep rising.
      </p>
    </div>
  );
}

function StageGroup({
  stage,
  rows,
  cohorts,
}: {
  stage: CohortEventStage;
  rows: Array<{ label: string; byCohort: Record<string, number> }>;
  cohorts: Array<{ key: string; label: string; size: number }>;
}) {
  return (
    <>
      <tr className="border-b border-gray-200 bg-gray-100/70">
        <td
          colSpan={cohorts.length + 1}
          className="sticky left-0 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500"
        >
          {stage}
        </td>
      </tr>
      {rows.map((r) => (
        <tr key={r.label} className="border-b border-gray-100 hover:bg-gray-50">
          <td className="sticky left-0 z-10 bg-white px-4 py-2 text-gray-800 whitespace-nowrap">
            {r.label}
          </td>
          {cohorts.map((c) => {
            const users = r.byCohort[c.key] ?? 0;
            const p = pct(users, c.size);
            return (
              <td
                key={c.key}
                className={"px-4 py-2 text-right tabular-nums " + cellTint(p)}
              >
                <span className="font-medium">{users}</span>
                <span className="ml-1 text-xs opacity-70">{p}%</span>
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
