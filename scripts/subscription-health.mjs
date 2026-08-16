#!/usr/bin/env node
/**
 * subscription-health.mjs — weekly subscription funnel + entry-point attribution.
 *
 * Answers two questions the cohort scripts can't:
 *   1. Is the money funnel healthy *right now*, app-wide, independent of which
 *      signup cohort a user belongs to? (A cohort report can look fine while
 *      current-week purchases have stopped.)
 *   2. Which paywall entry point actually earns money — using the entry_point
 *      attribution shipped 2026-08-10 (commit 4ad80dd). Before that, every CTA
 *      tap and purchase was unattributable.
 *
 * Read-only. Usage:
 *   TOKEN=$(gcloud auth print-access-token) node scripts/subscription-health.mjs
 */
const TOKEN = process.env.TOKEN;
const PROJECT = "trace-ai-b9cba";
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const H = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };
if (!TOKEN) { console.error("Missing TOKEN env"); process.exit(1); }

function val(v) {
  if (v == null) return undefined;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("timestampValue" in v) return new Date(v.timestampValue);
  if ("mapValue" in v) return obj(v.mapValue.fields ?? {});
  if ("nullValue" in v) return null;
  return undefined;
}
const obj = (f) => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, val(v)]));

async function listAll(c, fp) {
  const out = []; let pt = "";
  do {
    const u = new URL(`${BASE}/${c}`);
    u.searchParams.set("pageSize", "300");
    if (pt) u.searchParams.set("pageToken", pt);
    for (const p of fp ?? []) u.searchParams.append("mask.fieldPaths", p);
    const r = await fetch(u, { headers: H });
    if (!r.ok) { console.error(c, "FAIL", r.status); process.exit(1); }
    const j = await r.json();
    for (const d of j.documents ?? []) out.push(obj(d.fields ?? {}));
    pt = j.nextPageToken ?? "";
  } while (pt);
  return out;
}

const ev = await listAll("events", ["name", "userId", "timestamp", "props"]);
console.log(`events scanned: ${ev.length}\n`);

// ---- weekly funnel ----
const KEYS = ["paywall_viewed", "trial_offer_shown", "paywall_cta_tapped", "purchase_initiated",
  "purchase_completed", "purchase_failed", "purchase_canceled", "trial_started_server",
  "trial_converted", "subscription_renewed", "subscription_expired"];
const SHORT = { paywall_viewed: "pwView", trial_offer_shown: "trialOffr", paywall_cta_tapped: "ctaTap",
  purchase_initiated: "purchInit", purchase_completed: "DONE", purchase_failed: "failed",
  purchase_canceled: "cancel", trial_started_server: "trialSRV", trial_converted: "converted",
  subscription_renewed: "renewed", subscription_expired: "expired" };
const wk = (d) => {
  const t = new Date(d);
  const on = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()));
  on.setUTCDate(on.getUTCDate() - ((on.getUTCDay() + 6) % 7));
  return on.toISOString().slice(0, 10);
};
const byweek = new Map();
for (const e of ev) {
  if (!e.timestamp || !KEYS.includes(e.name)) continue;
  const w = wk(e.timestamp);
  if (!byweek.has(w)) byweek.set(w, {});
  byweek.get(w)[e.name] = (byweek.get(w)[e.name] ?? 0) + 1;
}
const weeks = [...byweek.keys()].sort().slice(-9);
console.log("week(mon)   " + KEYS.map((k) => SHORT[k].padStart(10)).join(""));
console.log("-".repeat(12 + 10 * KEYS.length));
for (const w of weeks) {
  console.log(w.padEnd(12) + KEYS.map((k) => String(byweek.get(w)[k] ?? 0).padStart(10)).join(""));
}

// ---- most recent revenue events ----
const money = ev.filter((e) => ["purchase_completed", "trial_started_server", "trial_converted",
  "subscription_started"].includes(e.name) && e.timestamp).sort((a, b) => b.timestamp - a.timestamp);
console.log("\n-- most recent revenue events --");
for (const m of money.slice(0, 8)) {
  console.log(`  ${m.timestamp.toISOString().slice(0, 19)}  ${m.name}`);
}
if (!money.length) console.log("  NONE");

// ---- entry-point attribution (post 2026-08-10) ----
const CUT = new Date("2026-08-10T00:00:00Z");
const tally = (name) => {
  const m = new Map();
  for (const e of ev) {
    if (e.name !== name || !e.timestamp || e.timestamp < CUT) continue;
    const ep = e.props?.entry_point ?? "(none)";
    m.set(ep, (m.get(ep) ?? 0) + 1);
  }
  return m;
};
const views = tally("paywall_viewed"), taps = tally("paywall_cta_tapped"), done = tally("purchase_completed");
console.log("\n-- paywall by entry point, since the attribution fix (2026-08-10) --");
console.log("  entry_point                       views   taps  bought   tap-rate");
console.log("  " + "-".repeat(64));
const eps = [...new Set([...views.keys(), ...taps.keys(), ...done.keys()])]
  .sort((a, b) => (views.get(b) ?? 0) - (views.get(a) ?? 0));
let tv = 0, tt = 0, td = 0;
for (const ep of eps) {
  const v = views.get(ep) ?? 0, t = taps.get(ep) ?? 0, d = done.get(ep) ?? 0;
  tv += v; tt += t; td += d;
  console.log(`  ${ep.padEnd(32)} ${String(v).padStart(5)} ${String(t).padStart(6)} ${String(d).padStart(7)}` +
    `   ${(v ? (t / v * 100).toFixed(1) + "%" : "—").padStart(8)}`);
}
console.log("  " + "-".repeat(64));
console.log(`  ${"TOTAL".padEnd(32)} ${String(tv).padStart(5)} ${String(tt).padStart(6)} ${String(td).padStart(7)}` +
  `   ${(tv ? (tt / tv * 100).toFixed(1) + "%" : "—").padStart(8)}`);
console.log("");
