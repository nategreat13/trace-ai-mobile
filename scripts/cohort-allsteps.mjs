#!/usr/bin/env node
/**
 * cohort-allsteps.mjs — every event a cohort fired, distinct users + total fires.
 * Read-only. Usage: TOKEN=$(gcloud auth print-access-token) node scripts/cohort-allsteps.mjs 1.3.6
 */
const TOKEN = process.env.TOKEN;
const COHORT = process.argv[2] ?? "1.3.6";
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
  const cohortUids = new Set(profiles.filter((p) => p.firstAppVersion === COHORT && !isEx(p.userId, p.email)).map((p) => p.userId));
  const signups = cohortUids.size;

  const events = await listAll("events", ["name", "userId"]);
  const ce = events.filter((e) => e.userId && cohortUids.has(e.userId));

  // tally distinct users + total fires per event name
  const users = new Map(); const totals = new Map();
  for (const e of ce) {
    if (!e.name) continue;
    totals.set(e.name, (totals.get(e.name) ?? 0) + 1);
    let s = users.get(e.name); if (!s) { s = new Set(); users.set(e.name, s); }
    s.add(e.userId);
  }
  const rows = [...users.keys()].map((name) => ({
    name, users: users.get(name).size, total: totals.get(name),
  })).sort((a, b) => b.users - a.users || b.total - a.total);

  console.log(`\n=== v${COHORT} — EVERY event fired by the cohort ===`);
  console.log(`signups (denominator): ${signups}\n`);
  console.log(`${"event".padEnd(28)} ${"users".padStart(6)} ${"%signup".padStart(8)} ${"fires".padStart(7)} ${"per-user".padStart(9)}`);
  console.log("-".repeat(64));
  for (const r of rows) {
    const perUser = r.users ? (r.total / r.users).toFixed(1) : "0";
    console.log(`${r.name.padEnd(28)} ${String(r.users).padStart(6)} ${(pct(r.users, signups) + "%").padStart(8)} ${String(r.total).padStart(7)} ${String(perUser).padStart(9)}`);
  }
  console.log("");
})().catch((e) => { console.error(e); process.exit(1); });
