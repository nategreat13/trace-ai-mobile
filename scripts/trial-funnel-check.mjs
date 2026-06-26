#!/usr/bin/env node
/**
 * trial-funnel-check.mjs — instrumentation drill-down for the trial paywall
 * funnel within a signup-version cohort. Read-only (Firestore REST).
 *
 * Steps: paywall_viewed → trial_offer_shown → paywall_cta_tapped(is_trial)
 *        → purchase_initiated(is_trial) → trial_started.
 *
 * Usage: TOKEN=$(gcloud auth print-access-token) COHORT=1.3.5 node scripts/trial-funnel-check.mjs
 */
const TOKEN = process.env.TOKEN;
const COHORT = process.env.COHORT ?? "1.3.5";
const PROJECT = "trace-ai-b9cba";
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
if (!TOKEN) { console.error("Missing TOKEN"); process.exit(1); }
const H = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };

function val(v) {
  if (v == null) return undefined;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("timestampValue" in v) return new Date(v.timestampValue);
  if ("arrayValue" in v) return (v.arrayValue.values ?? []).map(val);
  if ("mapValue" in v) return obj(v.mapValue.fields ?? {});
  if ("nullValue" in v) return null;
  return undefined;
}
function obj(f) { const o = {}; for (const k in f) o[k] = val(f[k]); return o; }
async function listAll(c, fp) {
  const out = []; let t = "";
  do {
    const u = new URL(`${BASE}/${c}`);
    u.searchParams.set("pageSize", "300");
    if (t) u.searchParams.set("pageToken", t);
    for (const p of fp ?? []) u.searchParams.append("mask.fieldPaths", p);
    const r = await fetch(u, { headers: H });
    if (!r.ok) throw new Error(`${c}: ${r.status} ${await r.text()}`);
    const j = await r.json();
    for (const d of j.documents ?? []) out.push({ id: d.name.split("/").pop(), ...obj(d.fields ?? {}) });
    t = j.nextPageToken ?? "";
  } while (t);
  return out;
}
const pct = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : 0);

(async () => {
  const ex = await listAll("analyticsExclusions");
  const exU = new Set(), exE = new Set();
  for (const e of ex) { for (const u of e.userIds ?? []) exU.add(u); if (e.email) exE.add(String(e.email).toLowerCase()); }
  const profiles = await listAll("userProfiles", ["userId", "email", "firstAppVersion"]);
  const cohort = profiles.filter((p) => p.firstAppVersion === COHORT &&
    !((p.userId && exU.has(p.userId)) || (p.email && exE.has(String(p.email).toLowerCase()))));
  const uids = new Set(cohort.map((p) => p.userId));

  const events = await listAll("events", ["name", "userId", "timestamp", "props.is_trial", "props.tier", "props.error_code"]);
  const ce = events.filter((e) => e.userId && uids.has(e.userId));

  const usersWith = (name, pred) => {
    const s = new Set();
    for (const e of ce) if (e.name === name && (!pred || pred(e))) s.add(e.userId);
    return s;
  };

  const pv = usersWith("paywall_viewed");
  const offer = usersWith("trial_offer_shown");
  const ctaAll = usersWith("paywall_cta_tapped");
  const ctaTrial = usersWith("paywall_cta_tapped", (e) => e.props?.is_trial === true);
  const initAll = usersWith("purchase_initiated");
  const initTrial = usersWith("purchase_initiated", (e) => e.props?.is_trial === true);
  const started = usersWith("trial_started");
  const pComplete = usersWith("purchase_completed");
  const pCancel = usersWith("purchase_canceled");
  const pFail = usersWith("purchase_failed");

  console.log(`\n=== v${COHORT} trial-paywall instrumentation drill-down (n=${cohort.length}) ===`);
  const step = (lbl, set, base) =>
    console.log(`  ${lbl.padEnd(34)} ${String(set.size).padStart(3)}` +
      (base ? `  (${pct(set.size, base.size)}% of ${base === pv ? "viewers" : "prev"})` : ""));
  step("paywall_viewed", pv);
  step("trial_offer_shown", offer, pv);
  step("paywall_cta_tapped (any)", ctaAll, pv);
  step("  ...of which is_trial=true", ctaTrial, pv);
  step("purchase_initiated (any)", initAll, pv);
  step("  ...of which is_trial=true", initTrial, pv);
  step("trial_started", started, pv);
  console.log(`  ---`);
  step("purchase_completed", pComplete, pv);
  step("purchase_canceled", pCancel, pv);
  step("purchase_failed", pFail, pv);

  // The smoking gun: viewers who saw a paywall but NEVER got a trial offer.
  const noOffer = [...pv].filter((u) => !offer.has(u)).length;
  console.log(`\n  Paywall viewers who NEVER saw a trial offer: ${noOffer}/${pv.size} (${pct(noOffer, pv.size)}%)`);
  console.log(`  → if high, the trial CTA isn't rendering (RC eligibility / $0 intro / remote flag), not a copy problem.\n`);
})().catch((e) => { console.error(e); process.exit(1); });
