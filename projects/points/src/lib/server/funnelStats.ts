import "server-only";
import { colRef } from "./firebase";

/**
 * Turns stored pointsEvents into the /admin numbers. Everything is counted
 * per visitor (anonymous browser id), not per event, so refreshing a page or
 * going back and forth doesn't inflate a step.
 */

/** The screens of the funnel, in order. A visitor "reached" a stage if they opened that screen or anything after it. */
export const STAGES = [
  { key: "landing", label: "Landing page" },
  { key: "progs", label: "Q1 · Cards & programs" },
  { key: "bal", label: "Q2 · Balances" },
  { key: "air", label: "Q3 · Home airport" },
  { key: "picks", label: "Q4 · Trip picks" },
  { key: "results", label: "Results" },
  { key: "paywall", label: "Paywall" },
  { key: "checkout", label: "Checkout page" },
  { key: "trial", label: "Started trial" },
] as const;

export type StageKey = (typeof STAGES)[number]["key"];

/** Labels for the utm_content values on the Meta ads. */
const AD_LABELS: Record<string, string> = {
  light_carousel: "Light carousel",
  dark_carousel: "Dark carousel",
  light_single: "Light single image",
  dark_single: "Dark single image",
};

/** A visitor counts as gone once they've been idle this long without starting a trial. */
const IDLE = 30 * 60 * 1000;

interface Ev {
  event: string;
  step?: string;
  path: string | null;
  at: number;
  source: string;
  device: string;
  os: string;
}

export interface Visitor {
  id: string;
  firstAt: number;
  lastAt: number;
  source: string;
  device: string;
  os: string;
  stage: number;
  email: boolean;
  status: "trial" | "active" | "left";
  events: number;
}

export interface Breakdown {
  label: string;
  visitors: number;
  results: number;
  paywall: number;
  trials: number;
}

export interface FunnelStats {
  since: number;
  visitors: Visitor[];
  reached: number[];
  exits: { stage: number; count: number }[];
  emails: number;
  bySource: Breakdown[];
  byDevice: Breakdown[];
  eventCount: number;
  internalSkipped: number;
  truncated: boolean;
}

function stageOf(e: Ev): number {
  const at = (k: StageKey) => STAGES.findIndex((s) => s.key === k);
  switch (e.event) {
    case "trial_started":
      return at("trial");
    case "paywall_view":
    case "plan_selected":
      return at("paywall");
    case "results_view":
    case "funnel_complete":
    case "email_captured":
    case "locked_row_tap":
    case "swipe_save":
    case "swipe_skip":
      return at("results");
    case "picks_set":
    case "airport_selected":
      return at("picks");
    case "balances_entered":
      return at("air");
    case "programs_selected":
      return at("bal");
    case "landing_view":
      return at("landing");
    case "step_view": {
      const map: Record<string, StageKey> = { land: "landing", progs: "progs", bal: "bal", air: "air", picks: "picks", load: "picks", results: "results", pay: "paywall", done: "trial" };
      return map[e.step ?? ""] ? at(map[e.step ?? ""]) : 0;
    }
    case "page_view":
      return e.path?.startsWith("/checkout") ? at("checkout") : 0;
    default:
      return 0;
  }
}

function sourceLabel(utm: { source?: string | null; content?: string | null } | undefined, referrer: string | null | undefined): string {
  if (utm?.content) return AD_LABELS[utm.content] ?? utm.content;
  if (utm?.source) return utm.source === "meta" ? "Meta (untagged ad)" : utm.source;
  if (referrer) {
    if (/facebook|fb\.|instagram/.test(referrer)) return "Facebook / Instagram (no tags)";
    if (!/tracetravel\.co$/.test(referrer)) return referrer.replace(/^www\./, "");
  }
  return "Direct / unknown";
}

/** Midnight in Mountain Time, `daysAgo` days back, as a UTC instant. */
export function denverMidnight(daysAgo = 0): Date {
  const now = new Date();
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  const offset = asUtc - now.getTime(); // Denver wall clock minus real UTC
  const midnightWall = Date.UTC(+parts.year, +parts.month - 1, +parts.day - daysAgo);
  return new Date(midnightWall - offset);
}

const LIMIT = 20000;

export async function loadFunnelStats(since: Date): Promise<FunnelStats> {
  const snap = await colRef("pointsEvents").where("at", ">=", since).orderBy("at").limit(LIMIT).get();

  const byVisitor = new Map<string, Ev[]>();
  let internalSkipped = 0;
  for (const doc of snap.docs) {
    const d = doc.data();
    if (d.internal) {
      internalSkipped++;
      continue;
    }
    const at = d.at?.toMillis?.() ?? d.clientAt ?? 0;
    const ev: Ev = {
      event: d.event,
      step: typeof d.props?.step === "string" ? d.props.step : undefined,
      path: d.path ?? null,
      at,
      source: sourceLabel(d.utm, d.referrer),
      device: d.device ?? "unknown",
      os: d.os ?? "Other",
    };
    const list = byVisitor.get(d.vid) ?? [];
    list.push(ev);
    byVisitor.set(d.vid, list);
  }

  const now = Date.now();
  const visitors: Visitor[] = [];
  for (const [id, evs] of byVisitor) {
    const stage = Math.max(...evs.map(stageOf));
    const lastAt = evs[evs.length - 1].at;
    // The first tagged event wins, so a later direct visit doesn't erase the ad that brought them.
    const tagged = evs.find((e) => e.source !== "Direct / unknown");
    visitors.push({
      id,
      firstAt: evs[0].at,
      lastAt,
      source: (tagged ?? evs[0]).source,
      device: evs[0].device,
      os: evs[0].os,
      stage,
      email: evs.some((e) => e.event === "email_captured"),
      status: stage === STAGES.length - 1 ? "trial" : now - lastAt > IDLE ? "left" : "active",
      events: evs.length,
    });
  }
  visitors.sort((a, b) => b.lastAt - a.lastAt);

  const reached = STAGES.map((_, i) => visitors.filter((v) => v.stage >= i).length);
  const exits = STAGES.slice(0, -1)
    .map((_, stage) => ({ stage, count: visitors.filter((v) => v.status === "left" && v.stage === stage).length }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count);

  const at = (k: StageKey) => STAGES.findIndex((s) => s.key === k);
  const breakdown = (key: (v: Visitor) => string): Breakdown[] => {
    const groups = new Map<string, Visitor[]>();
    for (const v of visitors) groups.set(key(v), [...(groups.get(key(v)) ?? []), v]);
    return [...groups]
      .map(([label, vs]) => ({
        label,
        visitors: vs.length,
        results: vs.filter((v) => v.stage >= at("results")).length,
        paywall: vs.filter((v) => v.stage >= at("paywall")).length,
        trials: vs.filter((v) => v.stage >= at("trial")).length,
      }))
      .sort((a, b) => b.visitors - a.visitors);
  };

  return {
    since: since.getTime(),
    visitors,
    reached,
    exits,
    emails: visitors.filter((v) => v.email).length,
    bySource: breakdown((v) => v.source),
    byDevice: breakdown((v) => `${v.device === "mobile" ? "Mobile" : "Desktop"} · ${v.os}`),
    eventCount: snap.size,
    internalSkipped,
    truncated: snap.size >= LIMIT,
  };
}
