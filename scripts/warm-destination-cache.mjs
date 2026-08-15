#!/usr/bin/env node
/**
 * warm-destination-cache.mjs — pre-generate destination-info cache entries.
 *
 * WHY THIS EXISTS
 * The destination-info cache key carries a schema version suffix (currently
 * `_v2`, set in projects/server/src/routes/destination-info.ts). Bumping it
 * invalidates every cached guide at once, so the next user to open each
 * destination pays a 30–90s Haiku generation. With hundreds of live
 * destination/month combinations that is hundreds of separate people each
 * eating a long spinner, and any who back out before it finishes may abort
 * the request before the cache is written — meaning the next visitor waits
 * too. This warms them all once, up front, from one machine.
 *
 * WHAT IT DOES
 * Derives the exact set of cache keys real users will request — by reading
 * the live deals feed for each home airport and applying the *same*
 * destination-key / month derivation the app uses
 * (projects/app/src/services/destinationApi.ts) — then requests any that
 * aren't already warm.
 *
 * SAFETY
 *  - Read-only from this script's perspective: it only issues GETs to our own
 *    API. The cache write is the server's normal behavior on a cache miss.
 *  - Dry-run by default. Requires --execute to send anything.
 *  - Skips keys already at the current schema version, so re-running after an
 *    interruption resumes rather than repeating (and costs nothing for work
 *    already done).
 *  - Bounded concurrency, so it can't stampede Cloud Run or the Anthropic
 *    rate limit.
 *  - Ctrl-C is safe at any point: completed keys stay cached, and a re-run
 *    picks up where it stopped.
 *
 * COST
 * Each miss is one claude-haiku-4-5 call: ~1.0k input + ~2.5k output tokens,
 * about $0.014 at $1/$5 per MTok. The script prints a projected total before
 * doing anything and a running total as it goes.
 *
 * USAGE
 *   TOKEN=$(gcloud auth print-access-token) node scripts/warm-destination-cache.mjs
 *   TOKEN=$(gcloud auth print-access-token) node scripts/warm-destination-cache.mjs --execute
 *
 * FLAGS
 *   --execute            actually send requests (default: dry run)
 *   --airports=A,B,C     home airports to source deals from
 *   --concurrency=N      parallel requests (default 4)
 *   --limit=N            cap the number of keys warmed this run
 *   --env=prod|staging   which API + collection to target (default prod)
 */

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (name, dflt) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : dflt;
};

const EXECUTE = has("--execute");
const ENV = val("env", "prod");
const CONCURRENCY = Math.max(1, Math.min(8, Number(val("concurrency", "4"))));
const LIMIT = Number(val("limit", "0")) || Infinity;
const AIRPORTS = val("airports", "SLC,LAX,DFW,BOS,JFK,EWR,MCO,IAH,SFO,ATL")
  .split(",")
  .map((s) => s.trim().toUpperCase())
  .filter(Boolean);

const API =
  ENV === "staging"
    ? "https://apistaging-7l7vojyykq-uc.a.run.app"
    : "https://api-7l7vojyykq-uc.a.run.app";
const COLLECTION = ENV === "staging" ? "staging_destinationContent" : "destinationContent";

// Must match the suffix in projects/server/src/routes/destination-info.ts.
// If that file's cacheKey changes, change this too or the script will think
// everything is cold and re-warm the entire set.
const SCHEMA_SUFFIX = "_v2";

// Measured 2026-08-14 with the count_tokens API against the live prompt and a
// generated guide. Used only for the projected/running cost display.
const COST_PER_MISS_USD = 0.014;

// The server allows itself up to 280s for the Anthropic call; give it room
// plus overhead rather than cutting off a generation that would have landed.
const REQUEST_TIMEOUT_MS = 300_000;

const TOKEN = process.env.TOKEN;
if (!TOKEN) {
  console.error("Missing TOKEN env (gcloud auth print-access-token)");
  process.exit(1);
}
const FIRESTORE = `https://firestore.googleapis.com/v1/projects/trace-ai-b9cba/databases/(default)/documents`;

const MONTHS = new Set([
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
]);

/** Mirrors extractMonth() in projects/app/src/services/destinationApi.ts. */
function extractMonth(travelWindow) {
  if (!travelWindow) return "any";
  const first = travelWindow.toLowerCase().trim().split(/[\s\-/]/)[0].replace(/\./g, "").trim();
  return MONTHS.has(first) ? first : "any";
}

/** Mirrors destinationKey() in projects/app/src/services/destinationApi.ts. */
function destinationKey(deal) {
  if (deal.destination_code) return deal.destination_code;
  const slug = (deal.destination ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "unknown";
}

/**
 * Mirrors the subset of mapRawDeal() in projects/app/src/lib/dealMapper.ts
 * that feeds the destination-info request. This step is not optional: the
 * deals feed is camelCase (`domesticOrInternational`, `destinationCode`) and
 * the app's Deal type is snake_case, so reading the raw payload with Deal
 * field names silently yields undefined for every one of them. Getting
 * `domesticOrInternational` wrong is the expensive case — the server picks a
 * different prompt for domestic vs international travel (the domestic branch
 * deliberately omits currency, language, timezone and power-plug advice), so
 * a wrong flag caches a guide written for the wrong kind of trip under a key
 * the app will never look up with the other flag.
 */
function toDeal(raw) {
  return {
    destination: raw.destination || raw.city || raw.destinationCity,
    destination_code:
      raw.destinationCode || raw.destination_code || raw.airportCode || raw.toAirport,
    travel_window: raw.dateString,
    dateString: raw.dateString,
    domestic_or_international: raw.domesticOrInternational,
  };
}

async function fetchJSON(url, opts = {}, timeoutMs = 60_000) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const r = await fetch(url, { ...opts, signal: ac.signal });
    const text = await r.text();
    let body = null;
    try { body = JSON.parse(text); } catch { /* non-JSON error page */ }
    return { ok: r.ok, status: r.status, body, text };
  } finally {
    clearTimeout(timer);
  }
}

/** Every cache key already at the current schema version. */
async function loadWarmKeys() {
  const warm = new Set();
  let pageToken = "";
  do {
    const u = new URL(`${FIRESTORE}/${COLLECTION}`);
    u.searchParams.set("pageSize", "300");
    // Names only — we never need the documents' contents here.
    u.searchParams.append("mask.fieldPaths", "_none_");
    if (pageToken) u.searchParams.set("pageToken", pageToken);
    const res = await fetchJSON(u.toString(), {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    if (!res.ok) throw new Error(`Firestore list failed: ${res.status} ${res.text.slice(0, 200)}`);
    for (const d of res.body.documents ?? []) {
      const key = d.name.split("/").pop();
      if (key.endsWith(SCHEMA_SUFFIX)) warm.add(key);
    }
    pageToken = res.body.nextPageToken ?? "";
  } while (pageToken);
  return warm;
}

/** The set of keys real users will request, derived exactly as the app does. */
async function buildWarmSet() {
  const wanted = new Map();
  for (const airport of AIRPORTS) {
    const res = await fetchJSON(`${API}/deals/${airport}?limit=200`, {}, 90_000);
    if (!res.ok) {
      console.warn(`  ! ${airport}: deals fetch failed (${res.status}) — skipping this airport`);
      continue;
    }
    const raw = Array.isArray(res.body) ? res.body : (res.body?.deals ?? res.body?.data ?? []);
    const items = raw.map(toDeal);
    const before = wanted.size;
    for (const deal of items) {
      const code = destinationKey(deal);
      const isDomestic = (deal.domestic_or_international ?? "").toLowerCase() === "domestic";
      const month = extractMonth(deal.travel_window || deal.dateString);
      const cacheKey = `${code.toUpperCase()}_${isDomestic ? "domestic" : "international"}_${month}${SCHEMA_SUFFIX}`;
      if (!wanted.has(cacheKey)) {
        wanted.set(cacheKey, { code, destination: deal.destination, isDomestic, month });
      }
    }
    console.log(`  ${airport}: ${items.length} deals -> ${wanted.size} keys (+${wanted.size - before})`);
  }
  return wanted;
}

async function warmOne(entry) {
  const params = new URLSearchParams({
    destination: entry.destination,
    domestic: String(entry.isDomestic),
    month: entry.month,
  });
  const url = `${API}/destination-info/${encodeURIComponent(entry.code)}?${params}`;
  const t0 = Date.now();
  try {
    const res = await fetchJSON(url, {}, REQUEST_TIMEOUT_MS);
    const ms = Date.now() - t0;
    if (!res.ok) return { ok: false, ms, reason: `http ${res.status}` };
    // A guide with no coordinates means the generation came back without the
    // fields the deal-page map needs — surface it rather than counting a win.
    const n = res.body?.neighborhoods ?? [];
    const t = res.body?.thingsToDo ?? [];
    const withCoords = [...n, ...t].filter(
      (x) => typeof x?.lat === "number" && typeof x?.lng === "number"
    ).length;
    if (withCoords === 0) return { ok: false, ms, reason: "no coordinates in response" };
    return { ok: true, ms, coords: withCoords };
  } catch (err) {
    return { ok: false, ms: Date.now() - t0, reason: err?.name === "AbortError" ? "timeout" : String(err?.message ?? err) };
  }
}

(async () => {
  console.log(`\n=== destination-info cache warm (${ENV}) ===`);
  console.log(`  api         : ${API}`);
  console.log(`  collection  : ${COLLECTION}`);
  console.log(`  schema      : ${SCHEMA_SUFFIX}`);
  console.log(`  airports    : ${AIRPORTS.join(", ")}`);
  console.log(`  concurrency : ${CONCURRENCY}`);
  console.log(`  mode        : ${EXECUTE ? "EXECUTE" : "DRY RUN (pass --execute to send)"}\n`);

  console.log("Building the set of keys users will request:");
  const wanted = await buildWarmSet();
  if (wanted.size === 0) {
    console.error("\nNo keys derived — deals feed returned nothing. Aborting.");
    process.exit(1);
  }

  console.log("\nChecking which are already warm...");
  const warm = await loadWarmKeys();
  const todo = [...wanted.entries()].filter(([k]) => !warm.has(k));

  console.log(`  already warm : ${wanted.size - todo.length}`);
  console.log(`  to warm      : ${todo.length}`);

  const slice = todo.slice(0, LIMIT === Infinity ? todo.length : LIMIT);
  const projected = (slice.length * COST_PER_MISS_USD).toFixed(2);
  const minutes = Math.ceil((slice.length / CONCURRENCY) * 45 / 60);
  console.log(`  this run     : ${slice.length}`);
  console.log(`  est. cost    : ~$${projected} (Haiku 4.5 @ ~$0.014/generation)`);
  console.log(`  est. time    : ~${minutes} min at concurrency ${CONCURRENCY}\n`);

  if (!EXECUTE) {
    console.log("Dry run — nothing sent. Sample of what would be warmed:");
    for (const [k, e] of slice.slice(0, 10)) console.log(`  ${k}  (${e.destination}, ${e.month})`);
    if (slice.length > 10) console.log(`  ... and ${slice.length - 10} more`);
    console.log("\nRe-run with --execute to warm.\n");
    return;
  }

  if (slice.length === 0) {
    console.log("Nothing to do — every key is already warm.\n");
    return;
  }

  let done = 0, ok = 0, failed = 0;
  const failures = [];
  const started = Date.now();
  let stopping = false;
  process.on("SIGINT", () => {
    stopping = true;
    console.log("\n\nStopping after in-flight requests finish — completed keys stay cached; re-run to resume.\n");
  });

  const queue = [...slice];
  async function worker() {
    while (queue.length && !stopping) {
      const [key, entry] = queue.shift();
      const r = await warmOne(entry);
      done++;
      if (r.ok) { ok++; } else { failed++; failures.push({ key, reason: r.reason }); }
      const spentUsd = (ok * COST_PER_MISS_USD).toFixed(2);
      const elapsedMin = ((Date.now() - started) / 60000).toFixed(1);
      const status = r.ok ? `ok  ${r.coords} pins` : `FAIL ${r.reason}`;
      console.log(
        `  [${String(done).padStart(3)}/${slice.length}] ${key.padEnd(46)} ${String(r.ms).padStart(6)}ms  ${status}` +
        `   (~$${spentUsd}, ${elapsedMin}m)`
      );
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  console.log(`\n=== done ===`);
  console.log(`  warmed  : ${ok}`);
  console.log(`  failed  : ${failed}`);
  console.log(`  cost    : ~$${(ok * COST_PER_MISS_USD).toFixed(2)}`);
  console.log(`  elapsed : ${((Date.now() - started) / 60000).toFixed(1)} min`);
  if (failures.length) {
    console.log(`\n  failures (re-run to retry — successes are skipped):`);
    for (const f of failures.slice(0, 20)) console.log(`    ${f.key}: ${f.reason}`);
    if (failures.length > 20) console.log(`    ... and ${failures.length - 20} more`);
  }
  console.log("");
})();
