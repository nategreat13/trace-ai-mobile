#!/usr/bin/env node
/**
 * cohort-analysis.mjs — signup-version cohort analysis (read-only).
 *
 * Pulls userProfiles + events via Firestore REST (gcloud token) and reproduces
 * the per-cohort metrics the admin dashboard computes (analytics-queries.ts):
 * size, platform mix, onboarding/trial funnel, trial state, engagement depth,
 * and matured d1/d7/d30 retention. Applies the same analyticsExclusions test-
 * account filtering the dashboard uses.
 *
 * Usage:  TOKEN=$(gcloud auth print-access-token) COHORT=1.3.5 node scripts/cohort-analysis.mjs
 */
const TOKEN = process.env.TOKEN;
const COHORT = process.env.COHORT ?? "1.3.5";
const PROJECT = "trace-ai-b9cba";
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
if (!TOKEN) { console.error("Missing TOKEN env (gcloud auth print-access-token)"); process.exit(1); }

const H = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };

// ---- value decoder for Firestore REST ----
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

// ---- list a collection fully (paged), optional field mask ----
async function listAll(collection, fieldPaths) {
  const out = [];
  let pageToken = "";
  do {
    const u = new URL(`${BASE}/${collection}`);
    u.searchParams.set("pageSize", "300");
    if (pageToken) u.searchParams.set("pageToken", pageToken);
    for (const fp of fieldPaths ?? []) u.searchParams.append("mask.fieldPaths", fp);
    const r = await fetch(u, { headers: H });
    if (!r.ok) throw new Error(`${collection} list failed: ${r.status} ${await r.text()}`);
    const j = await r.json();
    for (const d of j.documents ?? []) out.push({ id: d.name.split("/").pop(), ...obj(d.fields ?? {}) });
    pageToken = j.nextPageToken ?? "";
  } while (pageToken);
  return out;
}

const pct = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : 0);

(async () => {
  // 1. Exclusions
  const exDocs = await listAll("analyticsExclusions");
  const exUserIds = new Set();
  const exEmails = new Set();
  for (const e of exDocs) {
    for (const u of e.userIds ?? []) exUserIdsAdd(u);
    if (e.email) exEmails.add(String(e.email).toLowerCase());
  }
  function exUserIdsAdd(u) { exUserIds.add(u); }

  // 2. Profiles
  const profiles = await listAll("userProfiles", [
    "userId", "email", "firstAppVersion", "createdAt", "firstPlatform", "inTrial", "onboardingComplete",
  ]);
  const isExcluded = (uid, email) =>
    (uid && exUserIds.has(uid)) || (email && exEmails.has(String(email).toLowerCase()));

  const cohort = profiles.filter(
    (p) => p.firstAppVersion === COHORT && !isExcluded(p.userId, p.email)
  );
  const cohortUids = new Set(cohort.map((p) => p.userId));
  const totalReal = profiles.filter((p) => !isExcluded(p.userId, p.email)).length;

  // 3. Events (full scan, masked)
  const events = await listAll("events", [
    "name", "userId", "timestamp", "props.session_id", "props.device_id",
  ]);
  // index cohort events by user
  const cohortEvents = events.filter((e) => e.userId && cohortUids.has(e.userId));

  // ---- platform mix ----
  const plat = { ios: 0, android: 0, web: 0, unknown: 0 };
  for (const p of cohort) {
    const k = (p.firstPlatform ?? "").toLowerCase();
    if (k === "ios") plat.ios++; else if (k === "android") plat.android++;
    else if (k === "web") plat.web++; else plat.unknown++;
  }

  // ---- onboarding / trial state (profile flags) ----
  const onboarded = cohort.filter((p) => p.onboardingComplete === true).length;
  const inTrialNow = cohort.filter((p) => p.inTrial === true).length;

  // ---- event-name counts within cohort (distinct users firing each) ----
  const usersFiring = (name) => {
    const s = new Set();
    for (const e of cohortEvents) if (e.name === name) s.add(e.userId);
    return s.size;
  };
  const totalFiring = (name) => cohortEvents.filter((e) => e.name === name).length;

  const funnel = {
    signups: cohort.length,
    onboarding_completed: usersFiring("onboarding_completed"),
    paywall_viewed: usersFiring("paywall_viewed"),
    trial_started: usersFiring("trial_started"),
    trial_started_server: usersFiring("trial_started_server"),
    trial_converted: usersFiring("trial_converted"),
    purchase_completed: usersFiring("purchase_completed"),
  };

  // ---- engagement depth (per cohort user) ----
  const perUser = (name) => {
    const m = new Map();
    for (const e of cohortEvents) if (e.name === name) m.set(e.userId, (m.get(e.userId) ?? 0) + 1);
    return m;
  };
  const depth = (name) => {
    const m = perUser(name);
    const counts = [...m.values()];
    const total = counts.reduce((a, b) => a + b, 0);
    return { total, users: m.size, avgAll: cohort.length ? +(total / cohort.length).toFixed(1) : 0,
      avgActive: m.size ? +(total / m.size).toFixed(1) : 0 };
  };
  const swipes = depth("swipe");
  const saves = depth("deal_saved");
  const views = depth("deal_expanded");
  const clicks = depth("deal_book_tapped");
  // sessions: distinct session_id per user across deal interactions
  const sessSet = new Set();
  for (const e of cohortEvents) {
    if (["swipe", "deal_saved", "deal_expanded", "deal_book_tapped"].includes(e.name)) {
      const sid = e.props?.session_id; // masked nested map field
      if (sid) sessSet.add(e.userId + "|" + sid);
    }
  }

  // ---- retention d1/d7/d30 (matured denominators only) ----
  const now = new Date();
  const eventsByUser = new Map();
  for (const e of cohortEvents) {
    if (!e.timestamp) continue;
    let a = eventsByUser.get(e.userId); if (!a) { a = []; eventsByUser.set(e.userId, a); }
    a.push(e.timestamp.getTime());
  }
  // Two definitions, because they answer different questions and the
  // "classic" one alone reads far more bleakly than reality:
  //
  //   retention(N)        — active during the exact 24h of day N. This is the
  //                         textbook DN number, and it is brutal for an app
  //                         people use episodically (a deal hunter who returns
  //                         on day 2 and day 5 scores 0 on both D1 and D7).
  //   retentionRolling(N) — active at any point on or after day N, i.e. "still
  //                         around by then". Better matches how we actually
  //                         reason about whether a cohort stuck.
  //
  // Both count ANY tracked event, not just the four engagement events — that
  // includes app_open and screen_view. (An earlier revision of
  // COHORT_LEARNINGS.md claimed only engagement events counted; that was
  // wrong, the fetch above is unmasked by name.)
  //
  // Caveat that mattered until 2026-07-31: events fired before Firebase auth
  // rehydrated were attributed to "guest", so returning users' first events
  // vanished from these numbers — 100% of cold-launch app_opens and 38% of
  // screen_views. Fixed in projects/app/src/lib/analytics.ts (auth-resolution
  // gate). Cohorts that predate that fix shipping still understate retention;
  // compare like-for-like across cohorts rather than trusting the absolute.
  function retention(dayN) {
    let denom = 0, retained = 0;
    for (const p of cohort) {
      if (!p.createdAt) continue;
      const signup = p.createdAt.getTime();
      const winStart = signup + dayN * 86400000;
      const winEnd = winStart + 86400000;
      if (winEnd > now.getTime()) continue; // window not yet elapsed → exclude from denom
      denom++;
      const ts = eventsByUser.get(p.userId) ?? [];
      if (ts.some((t) => t >= winStart && t < winEnd)) retained++;
    }
    return { denom, retained, pct: pct(retained, denom) };
  }
  function retentionRolling(dayN) {
    let denom = 0, retained = 0;
    for (const p of cohort) {
      if (!p.createdAt) continue;
      const signup = p.createdAt.getTime();
      const winStart = signup + dayN * 86400000;
      if (winStart + 86400000 > now.getTime()) continue; // same maturity bar as above
      denom++;
      const ts = eventsByUser.get(p.userId) ?? [];
      if (ts.some((t) => t >= winStart)) retained++;
    }
    return { denom, retained, pct: pct(retained, denom) };
  }
  const r1 = retention(1), r7 = retention(7), r30 = retention(30);
  const rr1 = retentionRolling(1), rr7 = retentionRolling(7), rr30 = retentionRolling(30);

  // Attribution health: if a big share of this cohort's events landed on
  // "guest" the retention numbers below are understated, so surface it
  // inline instead of leaving it to be rediscovered later.
  const guestEvents = events.filter((e) => e.userId === "guest").length;

  // signup date range
  const dates = cohort.map((p) => p.createdAt).filter(Boolean).sort((a, b) => a - b);
  const fmt = (d) => d ? d.toISOString().slice(0, 10) : "?";

  // ---- report ----
  const L = (s) => console.log(s);
  L(`\n=== v${COHORT} signup cohort — analysis @ ${now.toISOString().slice(0,16)}Z ===`);
  L(`Cohort size: ${cohort.length} users  (of ${totalReal} real users, ${pct(cohort.length, totalReal)}%)`);
  L(`Signup span: ${fmt(dates[0])} → ${fmt(dates[dates.length-1])}`);
  L(`Excluded test accounts applied: ${exUserIds.size} uids / ${exEmails.size} emails`);

  L(`\n-- Platform mix --`);
  L(`  iOS ${plat.ios}  Android ${plat.android}  Web ${plat.web}  Unknown ${plat.unknown}`);

  L(`\n-- Funnel (distinct cohort users reaching each step) --`);
  L(`  signup_completed (profile)   ${funnel.signups}`);
  L(`  onboarding_completed         ${funnel.onboarding_completed}  (${pct(funnel.onboarding_completed, funnel.signups)}% of signups)`);
  L(`    profile.onboardingComplete ${onboarded}  (${pct(onboarded, funnel.signups)}%)`);
  L(`  paywall_viewed               ${funnel.paywall_viewed}  (${pct(funnel.paywall_viewed, funnel.signups)}%)`);
  L(`  trial_started (client)       ${funnel.trial_started}`);
  L(`  trial_started_server (RC)    ${funnel.trial_started_server}  (${pct(funnel.trial_started_server, funnel.signups)}% of signups)`);
  L(`  trial_converted              ${funnel.trial_converted}`);
  L(`  purchase_completed           ${funnel.purchase_completed}  (${pct(funnel.purchase_completed, funnel.signups)}% of signups)`);

  L(`\n-- Trial / subscription state --`);
  L(`  currently in trial (flag)    ${inTrialNow}`);
  L(`  started trial (server)       ${funnel.trial_started_server}`);
  L(`  converted to paid            ${funnel.trial_converted}`);

  L(`\n-- Engagement depth (cohort) --`);
  const row = (lbl, d) => L(`  ${lbl.padEnd(20)} total ${String(d.total).padStart(5)}  active users ${String(d.users).padStart(3)}/${cohort.length}  avg/all ${d.avgAll}  avg/active ${d.avgActive}`);
  row("swipes", swipes);
  row("deal_saved", saves);
  row("deal_expanded(views)", views);
  row("deal_book_tapped(clk)", clicks);
  L(`  sessions (deal-interaction): ${sessSet.size} total`);

  L(`\n-- Retention (matured windows only; any tracked event counts) --`);
  L(`  exact day-N window (classic DN):`);
  L(`    D1:  ${r1.retained}/${r1.denom} = ${r1.pct}%`);
  L(`    D7:  ${r7.retained}/${r7.denom} = ${r7.pct}%`);
  L(`    D30: ${r30.retained}/${r30.denom} = ${r30.pct}%`);
  L(`  still active on/after day N (rolling):`);
  L(`    D1:  ${rr1.retained}/${rr1.denom} = ${rr1.pct}%`);
  L(`    D7:  ${rr7.retained}/${rr7.denom} = ${rr7.pct}%`);
  L(`    D30: ${rr30.retained}/${rr30.denom} = ${rr30.pct}%`);
  L(`  attribution: ${guestEvents}/${events.length} events collection-wide landed on "guest" ` +
    `(${pct(guestEvents, events.length)}%) — those are invisible to per-user retention.`);
  L("");
})().catch((e) => { console.error(e); process.exit(1); });
