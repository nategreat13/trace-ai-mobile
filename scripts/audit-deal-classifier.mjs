#!/usr/bin/env node
/**
 * audit-deal-classifier.mjs
 *
 * Fetches live deals from the prod API for a broad set of airports, then
 * checks every destination name against the keyword lists in dealClassifier.ts.
 * Any destination that matches NOTHING gets printed in a report.
 *
 * Unmatched destinations land at the BACK of every user's deck when deal-type
 * preferences are set — run this periodically and add new ones to
 * projects/app/src/lib/dealClassifier.ts.
 *
 * Usage (from repo root):
 *   node scripts/audit-deal-classifier.mjs
 *
 * Optional: hit staging instead of prod
 *   BASE_URL=https://apistaging-7l7vojyykq-uc.a.run.app node scripts/audit-deal-classifier.mjs
 *
 * Requires Node 18+ (built-in fetch).
 *
 * NOTE: Keyword lists are parsed directly from dealClassifier.ts so this
 * script never goes stale — update the TS file and re-run, no edits here needed.
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.env.BASE_URL ?? "https://api-7l7vojyykq-uc.a.run.app";

// Airports to sample — broad spread of US hubs to catch the full deal inventory
const AIRPORTS = ["LAX", "JFK", "ORD", "MIA", "DFW", "ATL", "SEA", "DEN", "BOS", "SFO"];

// ── Parse keyword lists directly from dealClassifier.ts ───────────────────────
// Reads each `const XXXXX_KEYWORDS = [ ... ];` block and extracts all quoted
// strings, so the script is always in sync with the source of truth.
function loadKeywordsFromSource() {
  const tsPath = resolve(__dirname, "../projects/app/src/lib/dealClassifier.ts");
  const src = readFileSync(tsPath, "utf8");

  const categories = {};
  // Match each keyword array block: "const FOO_KEYWORDS = [ ... ];"
  const blockRe = /const\s+(\w+)_KEYWORDS\s*=\s*\[([\s\S]*?)\];/g;
  let blockMatch;
  while ((blockMatch = blockRe.exec(src)) !== null) {
    const name = blockMatch[1].toLowerCase(); // e.g. "luxury"
    const body = blockMatch[2];
    // Extract every double-quoted string from the block
    const keywords = [];
    const strRe = /"([^"]+)"/g;
    let strMatch;
    while ((strMatch = strRe.exec(body)) !== null) {
      keywords.push(strMatch[1]);
    }
    categories[name] = keywords;
  }

  if (Object.keys(categories).length === 0) {
    throw new Error("Could not parse any keyword lists from dealClassifier.ts — check the file path or format.");
  }
  return categories;
}

function classifyDestination(destination, categories) {
  const dest = destination.toLowerCase();
  const matched = [];
  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some((k) => dest.includes(k))) matched.push(category);
  }
  return matched;
}

// ── Fetch helpers ─────────────────────────────────────────────────────────────
async function fetchDealsForAirport(airport) {
  try {
    const res = await fetch(`${BASE_URL}/deals/${airport}?limit=500`, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const raw = Array.isArray(json) ? json : (json.deals ?? []);
    return raw.map((d) => ({
      destination: d.destination || d.city || d.destinationCity || "",
      price: parseFloat(d.dealPriceUSD || d.price || 0),
      discount_pct: parseFloat(d.discountPercent || d.discount_pct || 0),
    }));
  } catch (err) {
    console.error(`  ✗ ${airport}: ${err.message}`);
    return [];
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  // Load keyword lists from the real source file
  let categories;
  try {
    categories = loadKeywordsFromSource();
  } catch (err) {
    console.error(`\n❌  Failed to load keyword lists: ${err.message}\n`);
    process.exit(1);
  }

  const totalKeywords = Object.values(categories).reduce((s, arr) => s + arr.length, 0);
  const categoryNames = Object.keys(categories).join(", ");

  console.log(`\n🔍  Deal Classifier Audit`);
  console.log(`   API      : ${BASE_URL}`);
  console.log(`   Airports : ${AIRPORTS.join(", ")}`);
  console.log(`   Loaded ${totalKeywords} keywords across: ${categoryNames}\n`);

  // Fetch all airports in parallel
  const results = await Promise.all(AIRPORTS.map(async (ap) => {
    process.stdout.write(`  Fetching ${ap}... `);
    const deals = await fetchDealsForAirport(ap);
    console.log(`${deals.length} deals`);
    return { airport: ap, deals };
  }));

  // Collect every unique destination and the airports that have it
  const destMap = new Map(); // destination → { airports: Set, price: number, discount: number }
  for (const { airport, deals } of results) {
    for (const deal of deals) {
      const dest = deal.destination?.trim();
      if (!dest) continue;
      if (!destMap.has(dest)) destMap.set(dest, { airports: new Set(), price: deal.price, discount: deal.discount_pct });
      destMap.get(dest).airports.add(airport);
    }
  }

  const totalDestinations = destMap.size;
  const unmatched = [];
  const matchedCount = [];

  for (const [dest, info] of destMap) {
    const matched = classifyDestination(dest, categories);
    if (matched.length === 0) {
      unmatched.push({ dest, ...info });
    } else {
      matchedCount.push(dest);
    }
  }

  unmatched.sort((a, b) => b.airports.size - a.airports.size || a.dest.localeCompare(b.dest));

  // ── Report ────────────────────────────────────────────────────────────────
  console.log(`\n${"─".repeat(70)}`);
  console.log(`  SUMMARY`);
  console.log(`${"─".repeat(70)}`);
  console.log(`  Total unique destinations : ${totalDestinations}`);
  console.log(`  Matched (classified)      : ${matchedCount.length} (${pct(matchedCount.length, totalDestinations)}%)`);
  console.log(`  Unmatched (need adding)   : ${unmatched.length} (${pct(unmatched.length, totalDestinations)}%)`);

  if (unmatched.length === 0) {
    console.log(`\n  ✅  All destinations are classified. Nothing to add!\n`);
    return;
  }

  console.log(`\n${"─".repeat(70)}`);
  console.log(`  UNMATCHED DESTINATIONS  (sorted by how many airports carry them)`);
  console.log(`  These appear at the BACK of the deck for users with preferences.`);
  console.log(`  Add them to projects/app/src/lib/dealClassifier.ts`);
  console.log(`${"─".repeat(70)}`);
  console.log(`  ${"Destination".padEnd(32)} Airports`);
  console.log(`  ${"─".repeat(55)}`);

  for (const { dest, airports } of unmatched) {
    const airportList = [...airports].sort().join(",");
    console.log(`  ${dest.padEnd(32)} ${airportList}`);
  }

  // Print a ready-to-copy list for easy pasting into dealClassifier.ts
  console.log(`\n${"─".repeat(70)}`);
  console.log(`  QUICK-COPY LIST (paste into the right keyword array)`);
  console.log(`${"─".repeat(70)}`);
  const destStrings = unmatched.map(({ dest }) => `"${dest.toLowerCase()}"`).join(", ");
  console.log(`  ${destStrings}`);
  console.log();
}

function pct(n, total) { return total ? Math.round((n / total) * 100) : 0; }

main().catch((err) => { console.error(err); process.exit(1); });
