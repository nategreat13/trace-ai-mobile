# Meta Ads Attribution — Hand-off for Trevor

Nate and I worked through this on **2026-05-28** while clearing analytics and prepping for $50/day Meta spend. This doc summarizes everything so you can read up at your end and continue the conversation with Claude on your machine. The conversation context Claude needs to pick this up is at the bottom.

---

## TL;DR

- **Server-side Meta CAPI is wired and working** (`projects/server/src/lib/ad-conversions.ts`). We fixed three bugs in it this week. It's the only Meta integration in our code.
- **It's adequate to validate $50/day Meta spend.** Expect Meta-reported conversions to be ~50-70% lower than reality. That's normal for server-side-only setups, not a bug.
- **ATT prompt is mostly a paper tiger in 2026** — don't bother adding it. Most users either have the system-wide "Allow Tracking" toggle off (no prompt appears) or dismiss it reflexively.
- **Meta Mobile SDK is genuinely useful** and should be added when we scale past ~$150-200/day or when "is Meta working?" turns into "which creative is winning?" Match rate roughly doubles (35% → 65%) once it's in.
- **Adding the SDK requires a new native build** — App Store review, `runtimeVersion` bump, 3-4 hours engineering. Not a trivial OTA. Wait until `1.2.1` (currently in review) is live before submitting.

---

## What's set up vs. what isn't

| Layer | Status | Where |
|---|---|---|
| Meta Business Manager / ad account / campaign | ✅ You did this | meta.com |
| Meta CAPI dataset receiving events | ✅ Dataset `1001080219009504` | Meta Events Manager |
| Server-side CAPI fan-out (CompleteRegistration, StartTrial, Purchase) | ✅ Wired | `projects/server/src/lib/ad-conversions.ts` |
| TikTok Events API | ⚠️ Wired but **off** unless secrets set | Same file |
| GA4 Measurement Protocol | ⚠️ Wired but **off** unless secrets set | Same file |
| Meta Mobile SDK (`react-native-fbsdk-next`) | ❌ Not installed | — |
| ATT prompt + `NSUserTrackingUsageDescription` | ❌ Not present | — |
| Install-attribution SDK (Branch / Adjust / AppsFlyer) | ❌ Not present | — |
| Web Pixel | ❌ Not present (no marketing website to put it on) | — |

---

## What server-side CAPI alone gets you

- ✅ Meta sees confirmed signup, trial-start, and purchase events.
- ✅ The algorithm gets enough signal to optimize **broad** campaigns (Advantage+ App Campaigns work fine).
- ⚠️ Match rate: **~30-50%**. Meta tries to match our hashed email to a user they served the ad to. Works ~half the time.
- ⚠️ **Apple-relay sign-ins (`xxx@privaterelay.appleid.com`) match at 0%.** If a lot of users pick "Sign in with Apple → hide email," they're invisible to Meta no matter what.
- ⚠️ **Per-creative attribution is unreliable** — Meta can't tell which creative drove which install at low spend. A/B testing creatives is mostly guessing.

---

## Why ATT is a paper tiger in 2026

Nate asked "I don't feel like any apps I use ever gave me an ATT prompt" and he's right. A few reasons compounded:

1. **System-wide kill switch most users don't know they flipped.** Settings → Privacy & Security → Tracking has a master "Allow Apps to Request to Track" toggle. If it's OFF — which is the default state for anyone who ever tapped "Ask App Not to Track" — apps can call the prompt API and **nothing appears.** Just silently returns "denied." Best estimates put this at 60%+ of users.
2. **Industry opt-in collapsed.** ~25% in 2021 → ~12-18% in 2025-2026. Users learned to dismiss the popup reflexively.
3. **Most apps stopped bothering.** Engineering cost vs. shrinking benefit no longer pencils for indie apps.
4. **Apps that do prompt mostly hide it in pre-prompts** (their own custom screens explaining why) so users don't even remember seeing it.

**Bottom line: adding ATT to Trace would lift match rate by ~5-10% at best, on a steadily shrinking pool. Not worth the engineering or the popup friction.**

---

## Why Meta Mobile SDK is still genuinely useful

This is where most of the actual attribution lift comes from. **It works without user consent for tracking** — does not require the ATT prompt. Two mechanisms:

### 1. `_fbp` (the "Facebook Browser Pixel" for apps)

Meta-owned ID generated and stored locally inside our app. It's a first-party identifier — not "tracking across other companies' apps" — so it doesn't need ATT permission. Lets Meta match "the device that saw the ad" to "the device that converted." This is the single biggest contributor to match rate lift (~25-30%).

### 2. SKAdNetwork registration

Apple's privacy-safe install-attribution mechanism. Apple itself sends Meta an anonymized postback saying "an install from campaign 12 happened" — no user identifier, but deterministic. **Only flows if the Meta SDK is in our app and registers as a valid ad network.** Without the SDK, we leave these on the floor for the ~75% of users who say no to ATT.

**Combined effect: iOS match rate goes from ~35% to ~65%.** That's a real lift, mostly from `_fbp`, none of it requiring the ATT prompt.

---

## Cost to add Meta SDK when we decide to

| Item | Cost |
|---|---|
| Engineering | ~3-4 hours (install `react-native-fbsdk-next`, add Expo config plugin, populate `app.json` with Meta App ID + Client Token + Display Name + SKAdNetwork IDs) |
| Apple Review | 24-48 hours typical |
| Google Review | A few hours to a day |
| App size | ~2 MB increase |
| `runtimeVersion` bump | **Required.** Splits user base into `1.2.x` and `1.3.0` OTA branches for ~2-3 weeks until users naturally update. We'd need to maintain two parallel OTA pipelines during the transition for any JS-only fix. |
| Privacy nutrition labels | Need updating in App Store Connect to mention Meta data collection |

Not "set it and forget it" — it's a coordinated release that requires a clean window in App Review.

---

## Recommendation by spend level

| Daily spend | Action | Why |
|---|---|---|
| **$50/day** *(now)* | Skip everything. Server CAPI is fine. | Validate Meta works at all first. Engineering investment doesn't pay back yet. |
| **$100-150/day** | Still skip SDK. Watch creative performance. | If you can already identify a winning creative from the admin dashboard signup counts, no need yet. |
| **$200/day** or "**I need per-creative attribution to scale**" | Add Meta SDK. Skip ATT. | This is the trigger. SDK pays back in ~1 week at this spend. |
| **$500+/day** | Add AppsFlyer (cross-channel) too. ATT still optional. | At this scale, cross-network attribution matters more than the marginal ATT lift. |

---

## Timing: wait for `1.2.1` to clear Apple Review

Don't submit a Meta SDK build until the **current `1.2.1` submission is approved and live.** Apple gets cranky about back-to-back builds in review.

Clean sequence:
1. `1.2.1` approved → confirm it's live with no fallout (we re-introduced the required name step that Apple's 5.1.1(v) flagged before)
2. Wait ~3-5 days for stability
3. Submit `1.3.0` build with Meta SDK
4. Once `1.3.0` is on most users, future OTAs target `runtimeVersion: 1.3.0`

---

## What to monitor every morning at $50/day (5 min)

1. **Slack #signups channel** — count messages from the last 24h. No messages with $50 spent = ads broken.
2. **Meta CAPI acceptance logs:**
   ```bash
   gcloud run services logs read api --region us-central1 --project trace-ai-b9cba --limit 500 \
     | grep -E "Meta accepted|Meta rejected|Meta skipped"
   ```
   No "Meta accepted" lines in 24h = plumbing broken.
3. **Meta Ads Manager → your campaign → Results column** — compare to dashboard signup count delta. The ratio = our match rate. 30-50% is normal.
4. **Admin dashboard at `subscribe.tracetravel.co/analytics`** — trial-start → subscription-started ratio. Below 5% across 50+ trials means the funnel is broken (not the ads).

---

## Recommended Meta campaign settings (server-side CAPI only)

- **Campaign type:** Advantage+ App Campaign **or** App Promotion with broad targeting (no narrow interests / lookalikes — they need signal we don't have)
- **Targeting:** Country + age range only. Skip detailed interests.
- **Optimize for:** Start with **CompleteRegistration**, step up to **StartTrial** once you have ~50 trials/week, then to **Purchase** once you have ~50 purchases/week.
- **Bid strategy:** Cost cap. Start at **$25-30 per Purchase** (~30-50% of expected ~$80 LTV).
- **Attribution window:** 7-day click + 1-day view.
- **Daily budget cap:** $50 hard daily cap, **NOT** a lifetime budget. Auto-bidding without a cap can burn the day's budget by 2 PM.
- **Schedule:** Consider 9 AM-10 PM delivery to avoid late-night low-quality click burn.

---

## Useful context Claude needs to pick this up on your machine

1. **Analytics were cleared on 2026-05-28** — `events` collection wiped on both prod and staging (2,714 + 703 events backed up to `/tmp/events-backup-2026-05-28.json` and `/tmp/staging_events-backup-2026-05-28.json` on Nate's machine). Don't be surprised by empty dashboards.
2. **All 29 prod userProfiles + all 14 staging userProfiles** were marked as `analyticsExclusions` with the note `"Pre-ads-launch baseline (auto-added 2026-05-28)"`. So future ad cohorts have a clean baseline. Visible in admin at `subscribe.tracetravel.co/exclusions`.
3. **Server-side Meta CAPI is the only Meta integration in code.** Lives in `projects/server/src/lib/ad-conversions.ts`. Fixed three bugs this week (`action_source: "app"` → `"website"`; un-awaited fetch frozen by Cloud Run CPU throttle; `getApp()` race condition). Last verified Meta returned `events_received: 1`.
4. **Dataset ID** `1001080219009504`. Token in Firebase Secret Manager as `META_CAPI_ACCESS_TOKEN`.
5. **Live OTA** (group `a7f071dd-d6e0-4d1f-aa98-ffd13f45442e`) on `runtimeVersion: 1.2.0`. App version `1.2.1` is in Apple review (re-introduces a required first/last name step in onboarding — 5.1.1(v) rejection risk accepted).
6. **Codebase is on `main` branch going forward** (was `staging-env`). Both branches are at the same SHA as of `23fd53e`.
7. **Repo root:** `/Users/nate/src/trace-ai-mobile`. See `CLAUDE.md` for codebase ground rules — deployment policy is "ask before every prod action."

---

## Good prompts to continue the conversation with Claude

- *"Read TREVOR_META_ADS.md, then help me decide if it's time to add the Meta SDK based on these numbers."* (then paste a week of spend/signup data)
- *"Walk me through the actual Meta SDK integration step-by-step — write the code changes to `app.json` and any new files. Don't deploy anything; just prepare the diff."*
- *"Set up a daily Meta ads health report I can run from the terminal — should pull CAPI acceptance count, signup count, trial-start count, and spend in one command."*
- *"Help me draft the App Store privacy nutrition label updates that'd be needed if we add the Meta SDK."*
- *"My match rate has been ~25% for three weeks. Walk me through what could improve that without adding the SDK."*

---

*Doc generated by Claude during a session with Nate on 2026-05-28. Live as of that date. Numbers around ATT opt-in rates and match rates are industry-estimate ballparks, not hard data — directional only.*
