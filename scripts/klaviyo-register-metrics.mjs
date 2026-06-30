#!/usr/bin/env node
/**
 * klaviyo-register-metrics.mjs — fire one harmless test event per lifecycle
 * metric so they REGISTER in Klaviyo and become selectable as Flow triggers,
 * without waiting for the server deploy or the daily cron.
 *
 * Safe: no Flows are live yet, so firing these sends NO email. It just makes
 * the metric names appear under Flows → trigger → "Your metrics" → API.
 * Uses a single test profile (TEST_EMAIL) — delete it from Klaviyo afterward
 * if you don't want it lingering.
 *
 * Usage:
 *   KLAVIYO_PRIVATE_API_KEY=pk_xxx TEST_EMAIL=you@example.com \
 *     node scripts/klaviyo-register-metrics.mjs
 */
const key = process.env.KLAVIYO_PRIVATE_API_KEY;
const email = process.env.TEST_EMAIL;
if (!key || !email) {
  console.error("Set KLAVIYO_PRIVATE_API_KEY and TEST_EMAIL env vars.");
  process.exit(1);
}

// Every lifecycle metric the server fires — one per email, all five used as
// Flow triggers.
const METRICS = [
  "Signed Up",
  "Inactive 2 Days",
  "Inactive 7 Days",
  "Started Trial",
  "Hit Swipe Limit",
];

for (const metric of METRICS) {
  const body = {
    data: {
      type: "event",
      attributes: {
        properties: { test: true, registered_by: "klaviyo-register-metrics.mjs" },
        time: new Date().toISOString(),
        metric: { data: { type: "metric", attributes: { name: metric } } },
        profile: {
          data: {
            type: "profile",
            attributes: {
              email,
              external_id: "test-metric-registration",
              first_name: "Test",
              properties: { home_airport: "SLC" },
            },
          },
        },
      },
    },
  };
  const res = await fetch("https://a.klaviyo.com/api/events", {
    method: "POST",
    headers: {
      Authorization: `Klaviyo-API-Key ${key}`,
      revision: "2026-04-15",
      "Content-Type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  console.log(`${metric}: ${res.status}${res.ok ? " ✓" : " — " + (await res.text()).slice(0, 200)}`);
}
console.log("\nDone. The metrics should appear in Klaviyo within ~1 minute under Flows → trigger → Your metrics → API.");
