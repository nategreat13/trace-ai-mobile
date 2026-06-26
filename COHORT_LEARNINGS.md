# Trace — Cohort Learnings

_Last updated: June 26, 2026. Maintained by Nate's Claude sessions._

## What this doc is (read me first)

This is a running summary of what we've learned from **signup-version cohort analysis** — grouping users by the app version they first onboarded on, and comparing how each release performs on funnel, engagement, and retention.

It exists so that anyone (or their Claude) can pull the latest `main`, read this file, and understand the current state of our learnings **without re-deriving it**. If you're Trevor's Claude reading this to prep a "what's next" chat: everything you need is below, including the open questions and the current recommendations.

**Two things to keep in mind as you read:**
1. The newest cohort (1.3.6) is only ~3–4 days old as of this writing — its conversion numbers are promising but based on tiny samples. Don't over-index.
2. Our **retention metric is almost certainly undercounting** (see "Known measurement problems"). Treat retention as relative-across-cohorts, not as a true return rate.

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

**Retention is event-based and almost certainly undercounts.**
The cohort script measures retention as: "did this user fire a tracked event (swipe / deal_saved / deal_expanded / deal_book_tapped) inside the D1/D7/D30 window?" A user who reopens the app and just _browses_ without one of those interactions is counted as churned. That likely makes true retention much higher than the 3% we see.

**Implication:** we currently cannot make retention-based decisions with confidence. The fix is to instrument an app-open / `session_start` event and recompute. Until then, retention is only useful as a _relative_ comparison between cohorts, and even that is shaky.

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
