import type { Metadata } from "next";
import Link from "next/link";
import { Card, Eyebrow, Logo, PrimaryButton } from "@/components/ui";
import { adminPassword, isAdmin } from "@/lib/server/admin";
import { pointsEnv } from "@/lib/server/firebase";
import { denverMidnight, loadFunnelStats, STAGES, type Breakdown, type FunnelStats } from "@/lib/server/funnelStats";
import { signIn, signOut } from "./actions";

export const metadata: Metadata = { title: "Trace Points · Analytics", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const RANGES = {
  today: { label: "Today", days: 0 },
  "7d": { label: "7 days", days: 6 },
  "30d": { label: "30 days", days: 29 },
} as const;
type Range = keyof typeof RANGES;

// ui.tsx is a client module, so this server page can't call its cx().
const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : "–");

function ago(ms: number) {
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

const when = (ms: number) =>
  new Date(ms).toLocaleString("en-US", { timeZone: "America/Denver", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ range?: string; wrong?: string }> }) {
  const { range: raw, wrong } = await searchParams;
  if (!(await isAdmin())) return <Login wrong={!!wrong} disabled={!adminPassword()} />;

  const range: Range = raw && raw in RANGES ? (raw as Range) : "7d";
  let stats: FunnelStats | null = null;
  let error = "";
  try {
    stats = await loadFunnelStats(denverMidnight(RANGES[range].days));
  } catch (e) {
    console.error("[admin] couldn't load events", e);
    error = "Couldn't load events from Firestore. Check the server key and try again.";
  }
  const env = pointsEnv();

  return (
    <div className="flex flex-col gap-5 px-5 pt-6 pb-16">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Logo className="h-5" />
          <span className="text-[15px] font-extrabold">Points analytics</span>
        </div>
        <form action={signOut}>
          <button type="submit" className="text-[13px] font-bold text-muted">
            Sign out
          </button>
        </form>
      </header>

      <div className="flex items-center justify-between gap-3">
        <nav className="flex gap-1 rounded-2xl bg-soft p-1">
          {(Object.keys(RANGES) as Range[]).map((r) => (
            <Link
              key={r}
              href={`/admin?range=${r}`}
              className={cx("rounded-xl px-3.5 py-2 text-[13.5px] font-bold", r === range ? "bg-surface text-ink shadow-sm" : "text-muted")}
            >
              {RANGES[r].label}
            </Link>
          ))}
        </nav>
        <span className={cx("rounded-full px-2.5 py-1 text-[11px] font-extrabold tracking-wide uppercase", env === "prod" ? "bg-ok-bg text-ok" : "bg-near-bg text-near")}>
          {env === "prod" ? "Live data" : "Staging"}
        </span>
      </div>

      {error && <p className="rounded-2xl bg-near-bg p-4 text-[14px] font-semibold text-near">{error}</p>}
      {stats && <Dashboard stats={stats} />}
    </div>
  );
}

function Dashboard({ stats }: { stats: FunnelStats }) {
  const { reached, visitors } = stats;
  const total = reached[0];
  const at = (k: (typeof STAGES)[number]["key"]) => STAGES.findIndex((s) => s.key === k);
  const active = visitors.filter((v) => v.status === "active").length;

  if (!total) {
    return (
      <Card className="p-5 text-[15px] text-muted">
        No visitors in this range yet. Tracking started when this page went live, so earlier visits (and the first Meta leads) aren&apos;t here.
      </Card>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-2.5">
        <Tile label="Visitors" value={total} sub={active ? `${active} on the site now` : undefined} />
        <Tile label="Saw results" value={reached[at("results")]} sub={pct(reached[at("results")], total)} />
        <Tile label="Hit paywall" value={reached[at("paywall")]} sub={pct(reached[at("paywall")], total)} />
        <Tile label="Started trial" value={reached[at("trial")]} sub={pct(reached[at("trial")], total)} />
      </div>

      <Section title="Funnel" note="Visitors who got at least this far. The red number is how many stopped at the step before.">
        <div className="flex flex-col gap-3.5">
          {STAGES.map((s, i) => {
            const lost = i ? reached[i - 1] - reached[i] : 0;
            return (
              <div key={s.key} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3 text-[14px]">
                  <span className="font-bold">{s.label}</span>
                  <span className="shrink-0 tabular-nums">
                    {lost > 0 && <span className="mr-2 text-[12.5px] font-bold text-trace-red">−{lost}</span>}
                    <span className="font-extrabold">{reached[i]}</span>
                    <span className="ml-1.5 text-muted">{pct(reached[i], total)}</span>
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-soft">
                  <div className="h-full rounded-full bg-trace" style={{ width: `${(reached[i] / total) * 100}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-[13px] text-muted">
          {stats.emails} {stats.emails === 1 ? "visitor" : "visitors"} gave their email on the results page ({pct(stats.emails, reached[at("results")])} of those who saw results).
        </p>
      </Section>

      <Section title="Where people leave" note="Visitors idle for 30+ minutes without starting a trial, by the screen they were last on.">
        {stats.exits.length ? (
          <div className="flex flex-col gap-2.5">
            {stats.exits.map((x) => (
              <div key={x.stage} className="flex items-center justify-between gap-3 text-[14px]">
                <span className="font-semibold">{STAGES[x.stage].label}</span>
                <span className="tabular-nums">
                  <span className="font-extrabold">{x.count}</span>
                  <span className="ml-1.5 text-muted">{pct(x.count, total)}</span>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[14px] text-muted">Nobody has left yet.</p>
        )}
      </Section>

      <Section title="By ad" note="From the utm tags on the ad link. Results, paywall and trials show how many of each ad's visitors got that far.">
        <BreakdownList rows={stats.bySource} />
      </Section>

      <Section title="By device">
        <BreakdownList rows={stats.byDevice} />
      </Section>

      <Section title="Recent visitors" note="Anonymous. Newest activity first.">
        <ul className="flex flex-col divide-y divide-line">
          {visitors.slice(0, 60).map((v) => (
            <li key={v.id} className="flex flex-col gap-0.5 py-2.5 text-[13.5px]">
              <div className="flex items-center justify-between gap-3">
                <span className="font-bold">
                  {v.status === "trial" ? "Started trial" : v.status === "active" ? `On ${STAGES[v.stage].label}` : `Left at ${STAGES[v.stage].label}`}
                </span>
                <span
                  className={cx(
                    "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-extrabold uppercase",
                    v.status === "trial" ? "bg-ok-bg text-ok" : v.status === "active" ? "bg-near-bg text-near" : "bg-soft text-muted",
                  )}
                >
                  {v.status === "active" ? "Live" : v.status === "trial" ? "Trial" : "Left"}
                </span>
              </div>
              <span className="text-muted">
                {v.source} · {v.device === "mobile" ? "Mobile" : "Desktop"} {v.os}
                {v.email ? " · gave email" : ""}
              </span>
              <span className="text-[12.5px] text-muted">
                First seen {when(v.firstAt)} · last active {ago(v.lastAt)}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <p className="text-[12px] leading-snug text-muted">
        {stats.eventCount} events from {when(stats.since)} (Mountain Time).
        {stats.internalSkipped ? ` ${stats.internalSkipped} events from browsers signed in here were left out.` : ""}
        {stats.truncated ? " Only the first 20,000 events are counted; pick a shorter range." : ""} Tracking started when this page went live, so earlier visits aren&apos;t included.
      </p>
    </>
  );
}

function Tile({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <Card className="flex flex-col gap-0.5 p-4">
      <Eyebrow>{label}</Eyebrow>
      <span className="text-[28px] leading-tight font-extrabold tabular-nums">{value}</span>
      {sub && <span className="text-[13px] font-semibold text-muted">{sub}</span>}
    </Card>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-[18px] font-extrabold">{title}</h2>
        {note && <p className="text-[13px] leading-snug text-muted">{note}</p>}
      </div>
      {children}
    </Card>
  );
}

function BreakdownList({ rows }: { rows: Breakdown[] }) {
  return (
    <div className="flex flex-col divide-y divide-line">
      {rows.map((r) => (
        <div key={r.label} className="flex flex-col gap-1 py-2.5">
          <div className="flex items-baseline justify-between gap-3 text-[14px]">
            <span className="font-bold">{r.label}</span>
            <span className="shrink-0 font-extrabold tabular-nums">
              {r.visitors} <span className="font-semibold text-muted">visitors</span>
            </span>
          </div>
          <div className="flex gap-4 text-[12.5px] text-muted tabular-nums">
            <span>
              Results <b className="text-ink">{r.results}</b> {pct(r.results, r.visitors)}
            </span>
            <span>
              Paywall <b className="text-ink">{r.paywall}</b> {pct(r.paywall, r.visitors)}
            </span>
            <span>
              Trials <b className="text-ink">{r.trials}</b> {pct(r.trials, r.visitors)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function Login({ wrong, disabled }: { wrong: boolean; disabled: boolean }) {
  return (
    <div className="flex min-h-dvh flex-col justify-center gap-6 px-6">
      <div className="flex flex-col gap-2">
        <Logo className="h-6 self-start" />
        <h1 className="text-[28px] font-extrabold">Points analytics</h1>
        <p className="text-[15px] text-muted">
          {disabled ? "The admin password isn't set up on this server yet (POINTS_ADMIN_PASSWORD)." : "Team only. Enter the admin password."}
        </p>
      </div>
      {!disabled && (
        <form action={signIn} className="flex flex-col gap-3">
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            autoFocus
            aria-label="Admin password"
            placeholder="Password"
            className="min-h-[54px] rounded-2xl border border-line bg-surface px-4 text-[16px] text-ink outline-none focus:border-trace-red"
          />
          {wrong && <p className="text-[14px] font-semibold text-trace-red">That password didn&apos;t work.</p>}
          <PrimaryButton type="submit">Sign in</PrimaryButton>
        </form>
      )}
    </div>
  );
}
