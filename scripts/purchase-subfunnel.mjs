#!/usr/bin/env node
/**
 * purchase-subfunnel.mjs — paywall → store-popup → purchase sub-funnel, by cohort.
 * Read-only. Usage: TOKEN=$(gcloud auth print-access-token) node scripts/purchase-subfunnel.mjs 1.3.6 1.3.5
 */
const TOKEN = process.env.TOKEN;
const COHORTS = process.argv.slice(2).length ? process.argv.slice(2) : ["1.3.6", "1.3.5"];
const PROJECT = "trace-ai-b9cba";
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
if (!TOKEN) { console.error("Missing TOKEN"); process.exit(1); }
const H = { Authorization: `Bearer ${TOKEN}` };

function val(v) {
  if (v == null) return undefined;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("booleanValue" in v) return v.booleanValue;
  if ("timestampValue" in v) return new Date(v.timestampValue);
  if ("arrayValue" in v) return (v.arrayValue.values ?? []).map(val);
  if ("mapValue" in v) return obj(v.mapValue.fields ?? {});
  return undefined;
}
function obj(fields) { const o = {}; for (const k in fields) o[k] = val(fields[k]); return o; }
async function listAll(collection, fieldPaths) {
  const out = []; let pageToken = "";
  do {
    const u = new URL(`${BASE}/${collection}`);
    u.searchParams.set("pageSize", "300");
    if (pageToken) u.searchParams.set("pageToken", pageToken);
    for (const fp of fieldPaths ?? []) u.searchParams.append("mask.fieldPaths", fp);
    const r = await fetch(u, { headers: H });
    if (!r.ok) throw new Error(`${collection}: ${r.status}`);
    const j = await r.json();
    for (const d of j.documents ?? []) out.push({ id: d.name.split("/").pop(), ...obj(d.fields ?? {}) });
    pageToken = j.nextPageToken ?? "";
  } while (pageToken);
  return out;
}
const pct = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : 0);

(async () => {
  const exDocs = await listAll("analyticsExclusions");
  const exUserIds = new Set(); const exEmails = new Set();
  for (const e of exDocs) { for (const u of e.userIds ?? []) exUserIds.add(u); if (e.email) exEmails.add(String(e.email).toLowerCase()); }
  const profiles = await listAll("userProfiles", ["userId", "email", "firstAppVersion"]);
  const isEx = (uid, email) => (uid && exUserIds.has(uid)) || (email && exEmails.has(String(email).toLowerCase()));
  const events = await listAll("events", ["name", "userId"]);

  for (const COHORT of COHORTS) {
    const cohortUids = new Set(profiles.filter((p) => p.firstAppVersion === COHORT && !isEx(p.userId, p.email)).map((p) => p.userId));
    const ce = events.filter((e) => e.userId && cohortUids.has(e.userId));
    const uf = (name) => new Set(ce.filter((e) => e.name === name).map((e) => e.userId)).size;
    const signups = cohortUids.size;
    const viewed = uf("paywall_viewed");
    const cta = uf("paywall_cta_tapped");
    const initiated = uf("purchase_initiated");   // == store popup shown
    const completed = uf("purchase_completed");
    console.log(`\n=== v${COHORT} — purchase sub-funnel (distinct users) ===`);
    console.log(`  signups                 ${signups}`);
    console.log(`  paywall_viewed          ${viewed}  (${pct(viewed, signups)}% of signups)`);
    console.log(`  paywall_cta_tapped      ${cta}  (${pct(cta, viewed)}% of viewers)`);
    console.log(`  purchase_initiated      ${initiated}  (${pct(initiated, signups)}% of signups, ${pct(initiated, viewed)}% of viewers)`);
    console.log(`  purchase_completed      ${completed}  (${pct(completed, signups)}% of signups, ${pct(completed, initiated)}% of purchase_initiated)`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
