#!/usr/bin/env node
/**
 * retention-diagnostic.mjs — is our retention number real, or an
 * instrumentation gap? (read-only)
 *
 * Answers three questions the cohort script can't:
 *   1. When did `app_open` actually start flowing? (an event added late
 *      makes every earlier cohort look dead on arrival)
 *   2. What share of a cohort's users ever emit `app_open` at all?
 *   3. How much does retention move when app_open/screen_view are counted
 *      vs the four "engagement" events only?
 *
 * Usage: TOKEN=$(gcloud auth print-access-token) COHORT=1.3.6 node scripts/retention-diagnostic.mjs
 */
const TOKEN = process.env.TOKEN;
const COHORT = process.env.COHORT ?? "1.3.6";
const PROJECT = "trace-ai-b9cba";
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
if (!TOKEN) { console.error("Missing TOKEN env"); process.exit(1); }
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
function obj(fields) { const o = {}; for (const k in fields) o[k] = val(fields[k]); return o; }

async function listAll(collection, fieldPaths) {
  const out = [];
  let pageToken = "";
  do {
    const u = new URL(`${BASE}/${collection}`);
    u.searchParams.set("pageSize", "300");
    if (pageToken) u.searchParams.set("pageToken", pageToken);
    for (const fp of fieldPaths ?? []) u.searchParams.append("mask.fieldPaths", fp);
    const r = await fetch(u, { headers: H });
    if (!r.ok) throw new Error(`${collection} failed: ${r.status}`);
    const j = await r.json();
    for (const d of j.documents ?? []) out.push({ id: d.name.split("/").pop(), ...obj(d.fields ?? {}) });
    pageToken = j.nextPageToken ?? "";
  } while (pageToken);
  return out;
}
const pct = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : 0);
const L = console.log;

(async () => {
  const exDocs = await listAll("analyticsExclusions");
  const exUserIds = new Set(), exEmails = new Set();
  for (const e of exDocs) {
    for (const u of e.userIds ?? []) exUserIds.add(u);
    if (e.email) exEmails.add(String(e.email).toLowerCase());
  }
  const isExcluded = (uid, email) =>
    (uid && exUserIds.has(uid)) || (email && exEmails.has(String(email).toLowerCase()));

  const profiles = await listAll("userProfiles", ["userId", "email", "firstAppVersion", "createdAt"]);
  const cohort = profiles.filter((p) => p.firstAppVersion === COHORT && !isExcluded(p.userId, p.email));
  const cohortUids = new Set(cohort.map((p) => p.userId));

  const events = await listAll("events", ["name", "userId", "timestamp"]);
  L(`\n=== retention diagnostic — cohort ${COHORT} (${cohort.length} users) ===`);
  L(`total events scanned: ${events.length}`);

  // ---- 1. app_open timeline across ALL users ----
  const opens = events.filter((e) => e.name === "app_open" && e.timestamp);
  opens.sort((a, b) => a.timestamp - b.timestamp);
  L(`\n-- app_open coverage (all users) --`);
  L(`  total app_open events: ${opens.length}`);
  if (opens.length) {
    L(`  first seen: ${opens[0].timestamp.toISOString().slice(0, 19)}`);
    L(`  last  seen: ${opens[opens.length - 1].timestamp.toISOString().slice(0, 19)}`);
    const byDay = new Map();
    for (const o of opens) {
      const d = o.timestamp.toISOString().slice(0, 10);
      byDay.set(d, (byDay.get(d) ?? 0) + 1);
    }
    L(`  per-day counts (last 14 days with data):`);
    [...byDay.entries()].sort().slice(-14).forEach(([d, n]) => L(`    ${d}  ${n}`));
  }

  // ---- 2. cohort-level coverage per event name ----
  const cohortEvents = events.filter((e) => e.userId && cohortUids.has(e.userId));
  const usersFiring = (name) => {
    const s = new Set();
    for (const e of cohortEvents) if (e.name === name) s.add(e.userId);
    return s.size;
  };
  L(`\n-- cohort users emitting each signal --`);
  for (const n of ["app_open", "screen_view", "swipe", "deal_saved", "deal_expanded", "deal_book_tapped"]) {
    L(`  ${n.padEnd(18)} ${String(usersFiring(n)).padStart(4)} / ${cohort.length}  (${pct(usersFiring(n), cohort.length)}%)`);
  }

  // ---- 3. retention under three definitions ----
  const ENGAGEMENT = new Set(["swipe", "deal_saved", "deal_expanded", "deal_book_tapped"]);
  const byUser = { all: new Map(), eng: new Map(), open: new Map() };
  for (const e of cohortEvents) {
    if (!e.timestamp) continue;
    const t = e.timestamp.getTime();
    const push = (m) => { let a = m.get(e.userId); if (!a) { a = []; m.set(e.userId, a); } a.push(t); };
    push(byUser.all);
    if (ENGAGEMENT.has(e.name)) push(byUser.eng);
    if (e.name === "app_open") push(byUser.open);
  }
  const now = Date.now();

  // exact-day-N window (current definition)
  function retentionExact(map, dayN) {
    let denom = 0, retained = 0;
    for (const p of cohort) {
      if (!p.createdAt) continue;
      const signup = p.createdAt.getTime();
      const ws = signup + dayN * 86400000, we = ws + 86400000;
      if (we > now) continue;
      denom++;
      const ts = map.get(p.userId) ?? [];
      if (ts.some((t) => t >= ws && t < we)) retained++;
    }
    return { denom, retained, pct: pct(retained, denom) };
  }
  // "still active on/after day N" (rolling — the definition most tools mean)
  function retentionRolling(map, dayN) {
    let denom = 0, retained = 0;
    for (const p of cohort) {
      if (!p.createdAt) continue;
      const signup = p.createdAt.getTime();
      const ws = signup + dayN * 86400000;
      if (ws + 86400000 > now) continue;
      denom++;
      const ts = map.get(p.userId) ?? [];
      if (ts.some((t) => t >= ws)) retained++;
    }
    return { denom, retained, pct: pct(retained, denom) };
  }

  const show = (label, fn, map) => {
    const a = fn(map, 1), b = fn(map, 7), c = fn(map, 30);
    L(`  ${label.padEnd(34)} D1 ${String(a.pct).padStart(5)}%  D7 ${String(b.pct).padStart(5)}%  D30 ${String(c.pct).padStart(5)}%`);
  };
  L(`\n-- retention, exact day-N window (what we report today) --`);
  show("engagement events only", retentionExact, byUser.eng);
  show("all events (incl. app_open)", retentionExact, byUser.all);
  show("app_open only", retentionExact, byUser.open);

  L(`\n-- retention, rolling 'active on/after day N' --`);
  show("engagement events only", retentionRolling, byUser.eng);
  show("all events (incl. app_open)", retentionRolling, byUser.all);
  show("app_open only", retentionRolling, byUser.open);

  L("");
})();
