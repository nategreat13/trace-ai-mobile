# Trace — Cohort Learnings

_Last updated: June 26, 2026. Maintained by Nate's Claude sessions._

## What this doc is (read me first)

This is a running summary of what we've learned from **signup-version cohort analysis** — grouping users by the app version they first onboarded on, and comparing how each release performs on funnel, engagement, and retention.

It exists so that anyone (or their Claude) can pull the latest `main`, read this file, and understand the current state of our learnings **without re-deriving it**. If you're Trevor's Claude reading this to prep a "what's next" chat: everything you need is below, including the open questions and the current recommendations.

**Two things to keep in mind as you read:**
1. The data table below is the **June 26** snapshot, when 1.3.6 was ~3–4 days old. It has since matured to n=278 and **the exciting conversion signal did not survive** — see "Corrections after maturity" directly beneath it. Read that before quoting any 1.3.6 number.
2. Our **retention metric undercounts** because ~33% of events were mis-attributed to `"guest"` (root cause found and fixed July 31, 2026 — see "Known measurement problems"). Cohorts predating the fix still understate; treat retention as relative-across-cohorts.

---

## TL;DR — what we currently believe

1. **Raising the swipe cap (5 → 8) works as a behavior lever.** 1.3.6 users swipe more (7.6 vs 5.8 per active user). Confident.
2. **The trial-led paywall redesign (1.3.6) looks like it converts better.** Fewer people see the paywall, but those who do buy at ~9% vs ~3% historically, and net purchase rate roughly doubled (6.1% vs 2.3%). **Promising but unproven — only 3 purchases.**
3. **Retention looks catastrophic (~3% D1) across _every_ cohort — but the metric is probably broken.** This is the single biggest open question. We can't currently tell if we have a retention crisis or a measurement bug.
4. **The free trial is barely being used (~4% start, 0 conversions).** We've built trial-led paywalls and all the trial infrastructure, but the trial offer appears underutilized — likely the biggest unpulled growth lever.

---

## The data (as of June 26, 2026)

Same methodology for every row; test accounts excluded; "matured windows only" for retention.

| Metric | **1.3.6** (Trevor's batch) | 1.3.5 | 1.3.4 | 1.3.3 |
|---|---|---|---|---|
| Cohort size | 49 | 133 | 33 | 20 |
| Signup span | Jun 23–26 | Jun 12–23 | Jun 11–13 | Jun 10–11 |
| Maturity | ~3–4 days (young) | matured | matured | matured |
| Swipe cap in this version | **8** | 5 | 5 | 5 |
| Platform | 98% iOS | 99% iOS | 97% iOS | 100% iOS |
| Onboarding completed | 100% | 100% | 100% | 100% |
| Paywall viewed | **67.3%** | 78.9% | 84.8% | 100% |
| Trial started (server/RC) | 4.1% (2) | 2.3% (3) | 3.0% (1) | 0% |
| **Purchase (% of signups)** | **6.1% (3)** | 2.3% (3) | 3.0% (1) | 0% |
| **Purchase / paywall-viewer** | **9.1%** | 2.9% | 3.6% | 0% |
| Swipes — avg per active user | **7.6** | 5.8 | 7.1 | 5.0 |
| Saved ≥1 deal (% of cohort) | 24% | 39% | 42% | 0% |
| D1 retention | 3.7% (1/27) | 3.0% (4/133) | 6.1% (2/33) | 0% |
| D7 retention | n/a (none matured) | 2.3% (2/87) | 3.0% (1/33) | 0% |

> Note: "Onboarding completed = 100%" everywhere because a user's profile is created _at_ the moment onboarding completes — so by definition everyone in a cohort onboarded. It is not a signal of funnel health.

---

## Corrections after maturity (July 31, 2026)

1.3.6 has now matured from 49 users to **278**. Re-running the same analysis changes one headline materially, so the June 26 table above should be read as a historical snapshot, not current truth.

| Metric | 1.3.6 @ 3 days (n=49) | **1.3.6 matured (n=278)** | 1.3.5 matured (n=133) |
|---|---|---|---|
| Purchase (% of signups) | 6.1% (3) | **2.5% (7)** | 2.3% (3) |
| Purchase / paywall-viewer | 9.1% | **4.6%** | 2.8% |
| Trial started (server) | 4.1% (2) | 2.2% (6) | 2.3% (3) |
| Trial → paid conversions | 0 | 1 | 0 |
| Swipes per active user | 7.6 | **11.4** | 7.8 |
| Saves per active user | — | **5.7** | 4.6 |
| D1 / D7 retention (exact) | 3.7% / n/a | **6.3% / 4.1%** | 3.0% / 3.8% |
| D1 / D7 retention (rolling) | — | **24.6% / 20.7%** | — |

**❌ Retracted: "the trial-led paywall converts ~2× better."** That rested on 3 purchases in a 3-day-old cohort. At full size the purchase rate landed at 2.5% vs 1.3.5's 2.3% — **flat**. It was small-sample noise, and it is a good cautionary example: a 3-purchase delta is not a result. Don't re-derive this conclusion from the June 26 table.

**✅ Confirmed and strengthened: the engagement work is real.** Swipes per active user went _up_ with maturity (7.6 → 11.4 vs 1.3.5's 7.8), saves per active user beat 1.3.5, and deal detail views (2.6×) and "Book on Google" taps (6×) both clear 1.3.5 decisively. Removing the swipe cap worked.

**✅ Retention improved across every window** vs 1.3.5, though absolute levels stay low and are still understated for cohorts predating the attribution fix.

**🔴 New: the monetization leak is at the bottom of the funnel, not the top.** Only ~9% of paywall viewers tap the CTA, and **of those who tap buy, only half complete the store transaction** (7 of 14 on 1.3.6; 3 of 8 on 1.3.5). Two releases have now improved engagement without moving revenue. That 50% purchase-initiated drop-off is the most concrete unexplained loss we have.

---

## What we've learned (with confidence levels)

**✅ Higher swipe cap → more swiping (high confidence).**
Bumping the daily cap from 5 to 8 in 1.3.6 lifted average swipes among active users from 5.8 to 7.6. People use the extra room. This is the cleanest effect in the batch.

**🟡 Trial-led paywall may convert better (promising, low confidence — n=3).**
1.3.6 intentionally shows the paywall _less_ (67% vs 79%) because a higher swipe cap means the cap-triggered paywall fires later, and the Business paywall was pulled from the main flow. Despite that, the people who hit the paywall convert at ~9% vs ~3% historically, so net purchase rate roughly doubled. This is the most exciting signal — but it rests on 3 purchases over 3 days. **Needs the cohort to mature before we trust it.**

**🟡 Save engagement looks down (24% vs ~40%) — but probably a maturation artifact.**
Saves accumulate over a user's lifetime; the 1.3.6 cohort is only 3 days old. Don't act on this until the cohort matures. Flagged so we remember to re-check.

**🔴 Retention is low across ALL cohorts and is NOT a 1.3.6 regression.**
D1 is 3–6% and D7 is 2–3% for every release. 1.3.6 is in line with the others, so the batch didn't break anything — but the absolute numbers are implausibly low, which points at a measurement problem (below) rather than reality.

---

## Known measurement problems (important)

**Retention undercounts — but not for the reason we thought. Root cause found and fixed July 31, 2026.**

An earlier revision of this file claimed retention only counted the four engagement events (swipe / deal_saved / deal_expanded / deal_book_tapped) and that instrumenting an app-open event was the fix. **Both halves were wrong.** The cohort script's event fetch is unmasked by name, so retention has always counted _any_ tracked event including `screen_view` and `app_open` — and `app_open` had already been instrumented (it fires on cold launch and on foreground resume after 30 min, in `AnalyticsLifecycle.tsx`).

The actual bug was **attribution, not instrumentation**. Firebase restores the signed-in user from storage asynchronously, so for the first beat of a cold launch `auth.currentUser` is `null` even for a long-logged-in user. Every event fired in that window was stamped `userId: "guest"` and became invisible to per-user queries. Measured on prod before the fix:

| Event | Attributed to `"guest"` |
|---|---|
| `app_open`, `source: cold_launch` | **1,283 of 1,283 — 100%** (zero real uids) |
| `app_open`, `source: foreground_resume` | 84.3% |
| `screen_view` | 38.2% |
| `swipe` | 0% (happens long after auth resolves) |
| **whole `events` collection** | **~33%** |

So a returning user's first events landed under "guest" and they were scored as churned. `swipe` was clean precisely because swiping happens late in a session — which is why engagement metrics always looked sane while retention looked impossible.

**Fixed** in `projects/app/src/lib/analytics.ts`: `logEvent` now buffers events in memory until Firebase resolves auth state once, then flushes them with the userId that is actually known. Genuine logged-out users still flush as `"guest"`, which is correct for them.

**Implication:** every cohort that predates this fix _shipping to devices_ still understates retention, and the fix is client-side so it only takes effect for users on the new bundle. Keep comparing cohorts relative to one another until a cohort exists that was fully instrumented from signup. `scripts/cohort-analysis.mjs` now prints the collection-wide guest-attribution share on every run so this can't silently regress, and `scripts/retention-diagnostic.mjs` breaks retention down by event set and definition.

**Retention now reports two definitions.** Classic "exact day-N window" DN is brutal for an episodic deal-hunting app (someone who returns on day 2 and day 5 scores zero on both D1 and D7), so the script also prints rolling "still active on/after day N". For the 1.3.6 cohort the two read very differently — D1 6.3% exact vs 24.6% rolling — and the rolling number is the more honest description of whether a cohort stuck.

**Cohort tagging tracks the JS bundle version, not the native binary.**
`firstAppVersion` is set from `Constants.expoConfig.version` (the OTA-controlled bundle version), not the installed binary. So a "1.3.6 cohort" = everyone who onboarded while running a 1.3.6-stamped JS bundle, regardless of which store binary they installed. Practical consequence: **whenever we ship a new batch, bump the version stamp** (e.g. 1.3.7) so the next cohort separates cleanly. If we reuse a version stamp, two different releases blend into one cohort bucket.

**1.3.3 is an outlier — don't use it as a baseline.**
Only 3 of 20 users swiped at all (vs ~90%+ in other cohorts). Likely a very short or partially-broken window. Treat 1.3.4 and 1.3.5 as the reliable matured baselines.

---

## What shipped in each version (context for the numbers)

- **1.3.6** (Trevor's batch — live via OTA since ~Jun 23): paywall refresh (trial-led, personalized hero per entry point, Business paywall moved to Upgrade tab only); swipe cap 5→8; rolling 24h swipe reset (was midnight); shuffled "lead with top domestic" deck; Explore expanded to 120+ destinations + search; badge changes (added First 5 Swipes); swipe snap-back bug fix; **server-side notification $0/0% price fix** (deals API field names → `dealPriceUSD`/`percentOff`).
- **1.3.5**: retention/conversion batch — trial-led paywall groundwork, cap return hook, freshness signal.
- **1.3.4**: App Store build (no major product change).
- **1.3.3**: cohort exposure fixes — forced trial paywall, cap-hit trial-first, push prompt after first save.
- **1.3.1**: 7-day free trial support **(dormant until the store offer is live)**, swipe cap 10→5, live RevenueCat reconciliation, trial analytics, `firstAppVersion` tagging from bundle version.

---

## What we're considering next (prioritized recommendation)

These are recommendations from Nate's session, not yet decided. Ordered by leverage.

**1. Fix the retention measurement first.** Add a `session_start` / app-open event and recompute retention. It's cheap, OTA-able, and foundational — until it's fixed we don't know whether to play a retention game or a conversion game. Highest priority.

**2. Pull the trial lever.** Confirm the 7-day free trial offer is actually live and prominent in App Store Connect / RevenueCat. We have trial-led paywalls but only ~4% of users start a trial and none have converted — a big mismatch. Likely our highest-ROI conversion move, and it's mostly configuration, not code.

**3. Let 1.3.6 mature before changing the paywall again.** The conversion signal is promising but n=3 over 3 days. Re-run this analysis in ~5–7 days (when D7 matures and the sample grows) before iterating on the paywall — otherwise we burn the read. Resist the urge to keep A/B-ing.

**Explicitly NOT recommended right now:** reacting to the save-rate dip (confounded by cohort age) or shipping another paywall variant (no clean read yet).

---

## How to re-run this analysis

Read-only script, pulls prod Firestore via a gcloud token. Safe to run.

```bash
# from repo root
TOKEN=$(gcloud auth print-access-token) COHORT=1.3.6 node scripts/cohort-analysis.mjs
```

Change `COHORT` to any version string. The script reproduces the admin dashboard's per-cohort metrics (size, platform mix, funnel, trial state, engagement depth, matured D1/D7/D30 retention) and applies the same `analyticsExclusions` test-account filtering.

**When you re-run, please update the table and findings above and bump the "Last updated" date** so this doc stays the single source of truth.
