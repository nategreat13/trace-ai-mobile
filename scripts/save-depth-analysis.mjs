#!/usr/bin/env node
/**
 * save-depth-analysis.mjs — how deep do users actually go on saves? (read-only)
 *
 * Answers the question "where should a save-triggered alert upsell fire?"
 * without guessing:
 *   1. Distribution of deal_saved counts per user (how many ever reach 2/3/5/8)
 *   2. How many users save 2+ deals to the SAME destination (highest-intent signal)
 *   3. How the existing fifth_save paywall entry point actually performs
 *
 * Mirrors the Firestore REST + test-account exclusion approach used by
 * cohort-analysis.mjs. Reads only; writes nothing.
 *
 * Usage:  TOKEN=$(gcloud auth print-access-token) node scripts/save-depth-analysis.mjs
 */
const TOKEN = process.env.TOKEN;
const PROJECT = "trace-ai-b9cba";
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
if (!TOKEN) {
  console.error("Missing TOKEN env (TOKEN=$(gcloud auth print-access-token))");
  process.exit(1);
}
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
function obj(fields) {
  const o = {};
  for (const k in fields) o[k] = val(fields[k]);
  return o;
}

async function listAll(collection, fieldPaths) {
  const out = [];
  let pageToken = "";
  do {
    const params = new URLSearchParams({ pageSize: "300" });
    if (pageToken) params.set("pageToken", pageToken);
    for (const f of fieldPaths ?? []) params.append("mask.fieldPaths", f);
    const res = await fetch(`${BASE}/${collection}?${params}`, { headers: H });
    if (!res.ok) throw new Error(`${collection}: ${res.status} ${await res.text()}`);
    const body = await res.json();
    for (const d of body.documents ?? []) {
      out.push({ _id: d.name.split("/").pop(), ...obj(d.fields ?? {}) });
    }
    pageToken = body.nextPageToken ?? "";
  } while (pageToken);
  return out;
}

const pct = (n, d) => (d === 0 ? "—" : `${((n / d) * 100).toFixed(1)}%`);

(async () => {
  console.log("Loading events + exclusions…");
  const [events, exclusions] = await Promise.all([
    listAll("events", ["name", "userId", "props", "timestamp"]),
    listAll("analyticsExclusions", []).catch(() => []),
  ]);
  const excluded = new Set(exclusions.map((e) => e._id));
  const live = events.filter((e) => e.userId && e.userId !== "guest" && !excluded.has(e.userId));

  console.log(
    `${events.length} events total, ${live.length} after excluding guests + ${excluded.size} test accounts\n`
  );

  // ---- 1. saves per user ----
  const saves = live.filter((e) => e.name === "deal_saved");
  const byUser = new Map();
  for (const s of saves) {
    if (!byUser.has(s.userId)) byUser.set(s.userId, []);
    byUser.get(s.userId).push(s.props?.destination ?? "(unknown)");
  }
  const savers = [...byUser.values()];
  const counts = savers.map((d) => d.length).sort((a, b) => a - b);
  const anyUser = new Set(live.map((e) => e.userId));

  console.log("=== SAVE DEPTH ===");
  console.log(`Users with any tracked activity: ${anyUser.size}`);
  console.log(`Users who saved >=1 deal:        ${savers.length} (${pct(savers.length, anyUser.size)})`);
  if (counts.length) {
    const median = counts[Math.floor(counts.length / 2)];
    const mean = (counts.reduce((a, b) => a + b, 0) / counts.length).toFixed(1);
    console.log(`Median saves per saver: ${median}   Mean: ${mean}   Max: ${counts[counts.length - 1]}`);
  }
  console.log("\nReach by threshold (of all active users / of savers):");
  for (const t of [1, 2, 3, 4, 5, 6, 8, 10]) {
    const n = counts.filter((c) => c >= t).length;
    console.log(
      `  >=${String(t).padStart(2)} saves: ${String(n).padStart(4)} users   ${pct(n, anyUser.size).padStart(6)} of active   ${pct(n, savers.length).padStart(6)} of savers`
    );
  }

  // ---- 2. repeat destination ----
  let repeatUsers = 0;
  const repeatAt = [];
  for (const dests of byUser.values()) {
    const seen = new Map();
    let hit = null;
    dests.forEach((d, i) => {
      if (d === "(unknown)") return;
      seen.set(d, (seen.get(d) ?? 0) + 1);
      if (hit === null && seen.get(d) >= 2) hit = i + 1; // save # at which repeat occurred
    });
    if (hit !== null) {
      repeatUsers += 1;
      repeatAt.push(hit);
    }
  }
  console.log("\n=== REPEAT-DESTINATION SIGNAL ===");
  console.log(
    `Savers who saved 2+ to the same destination: ${repeatUsers} (${pct(repeatUsers, savers.length)} of savers)`
  );
  if (repeatAt.length) {
    const sorted = [...repeatAt].sort((a, b) => a - b);
    console.log(`Median save # where the repeat happens: ${sorted[Math.floor(sorted.length / 2)]}`);
  }

  // ---- 3. existing fifth_save nudge ----
  const pw = live.filter((e) => e.name === "paywall_viewed");
  const byEntry = new Map();
  for (const e of pw) {
    const k = e.props?.entry_point ?? "(none)";
    byEntry.set(k, (byEntry.get(k) ?? 0) + 1);
  }
  const ctas = live.filter((e) => e.name === "paywall_cta_tapped");
  const ctaByEntry = new Map();
  for (const e of ctas) {
    const k = e.props?.entry_point ?? "(none)";
    ctaByEntry.set(k, (ctaByEntry.get(k) ?? 0) + 1);
  }
  console.log("\n=== PAYWALL BY ENTRY POINT (views → CTA taps) ===");
  const entries = [...new Set([...byEntry.keys(), ...ctaByEntry.keys()])].sort(
    (a, b) => (byEntry.get(b) ?? 0) - (byEntry.get(a) ?? 0)
  );
  for (const k of entries) {
    const v = byEntry.get(k) ?? 0;
    const c = ctaByEntry.get(k) ?? 0;
    console.log(`  ${k.padEnd(22)} ${String(v).padStart(5)} views  ${String(c).padStart(4)} taps  ${pct(c, v)}`);
  }

  // ---- 4. upsell cards (shipped? firing?) ----
  const upsellShown = live.filter((e) => e.name === "upsell_card_shown");
  console.log("\n=== IN-DECK UPSELL CARDS ===");
  if (upsellShown.length === 0) {
    console.log("  No upsell_card_shown events — the v1 rework has not reached users yet.");
  } else {
    const tapped = live.filter((e) => e.name === "upsell_card_tapped").length;
    console.log(`  shown: ${upsellShown.length}  tapped: ${tapped}  (${pct(tapped, upsellShown.length)})`);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
