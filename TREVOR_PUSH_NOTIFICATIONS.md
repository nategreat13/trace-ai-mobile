# Push Notifications — Trevor's Guide

A friendly, non-technical walkthrough of the push notification system for Trace, written for you.

---

## What we built (the 30-second version)

You now have full control over push notifications without writing any code. Here's what exists:

1. **The app** asks each user for permission to send notifications (after they finish onboarding). If they say yes, the app remembers their device.
2. **The admin portal** (the same dashboard at `subscribe.tracetravel.co/admin` you already use) has a new **Notifications** tab. From there you can:
    - Edit the wording of any "auto-fire" notification (e.g., the welcome push, the trial-ending warning).
    - Turn each one on or off without involving Nate.
    - Send a one-off announcement to all users (or just Premium users, or just iOS users, etc.).
    - See what was sent and how many people got it.
3. **Five auto-fire notifications** are wired up and ready for you to enable:
    - **Welcome** — a day after a user signs up.
    - **Trial ending in 24 hours** — to remind people to subscribe.
    - **Billing issue** — when someone's payment fails.
    - **Inactivity 3 days** — to pull people back into the app.
    - **Inactivity 7 days** — second-chance reactivation.

All five start **disabled**. Nothing fires until you flip them on.

---

## How to think about it

Two kinds of notifications exist:

| Type | Example | How it works |
|------|---------|--------------|
| **Triggered** (auto) | "Your trial ends tomorrow" | Fires automatically when something happens (signup, trial nearly done, etc). You set the wording once and it sends itself forever. |
| **Broadcast** (one-off) | "We just launched business class deals!" | You pick the audience and write the message right now. Sends to everyone matching, immediately. |

Both kinds let you choose where the user lands when they tap the notification — Swipe deck, Dashboard, Paywall, etc.

---

## Your main tool: the Notifications tab

Open `https://subscribe.tracetravel.co/admin/notifications`. You'll see something like this (in plain English):

- A **list of triggered notifications** (welcome, trial ending, etc.) with each one's status (enabled / disabled) and last edit time.
- A **"Compose broadcast"** button (top right) — for one-off announcements.
- A **"History"** button (top right) — to see what was sent recently.

### Editing a triggered notification

1. Click any row in the list (e.g., **trial_ending_24h**).
2. Edit the **Title** and **Body**. These are what shows up on the lock screen.
3. Optionally pick a **Deep link** — where the app opens when the user taps the notification. (Most useful: the trial-ending one should deep-link to **Paywall**.)
4. Check or uncheck **Enabled** at the bottom.
5. Click **Save**.

Changes are **instant** — the next time the trigger fires, it uses your new wording. No deploy, no waiting for Nate.

### Sending a broadcast

1. Click **Compose broadcast** at the top.
2. Type a Title and Body.
3. Pick the audience:
    - **Tier checkboxes**: which subscription tiers should get this? (Default: all four checked.)
    - **Platform**: iOS only, Android only, or all.
4. Optionally pick a Deep link.
5. Click **Send broadcast**.

It goes out **immediately**. There's no scheduled-send yet — if you need that, ask Claude to add it.

### Seeing what was sent

The **History** page shows the last 200 things sent — both broadcasts and per-user sends (like the test-push button below). Each row shows:

- **Time** sent (in Mountain Time)
- **Type** (broadcast, trigger name like "welcome", or "user" for one-off tests)
- **Title and body** preview
- **Accepted count**: out of how many devices were targeted, how many Expo's push service accepted for delivery. The actual delivered-to-device count is usually slightly lower (some phones are off, in airplane mode, etc.) — Apple/Google don't tell us the final number reliably.
- **Audience** details (tiers / platform / matched user count) for broadcasts.

---

## Iterating on copy: the test-send loop

You don't have to wait for a notification to actually fire to see what it'll look like. Use the **Send test push** button on any user's detail page (including your own) to fire any wording at any device.

### To try a notification on yourself:

1. Go to **Users** tab → search for yourself by email → click into your user.
2. Scroll down to **Send test push**.
3. Type a Title and Body.
4. Optionally pick a Deep link.
5. Click **Send to this user**.

If you have notifications enabled on your phone (or Simulator — see below), it shows up within a couple seconds.

> The "Send test push" button **bypasses the user's notifications-on/off toggle** so you can test against any account. This is intentional — the toggle is for production behavior, but you need to be able to QA copy regardless.

A common iteration loop:
1. Edit a triggered notification's wording in the admin.
2. Send a test push to yourself with that wording.
3. Look at it on your phone.
4. Tweak and repeat.

---

## Testing the app on your Mac (iOS Simulator)

The Simulator is a fake iPhone running on your Mac — useful for trying the app without your phone in hand. **One important catch**: the Simulator can't receive real push notifications.

The Simulator can receive push notifications you trigger by hand on your Mac (not through the admin), but real notifications from our admin portal won't actually appear on a Simulator — that requires a physical iPhone (with the new build of Trace installed) or an Android emulator.

**For real end-to-end push testing, use your own iPhone via TestFlight (next section).**

That said, the Simulator is great for everything else: trying the app's UI, walking through onboarding, signing up, redeeming a promo code, etc.

### Build and install

Open **Terminal** (Cmd-Space → "Terminal") and run:

```bash
cd ~/trace-ai-mobile
git pull
cd projects/app
eas build --profile simulator --platform ios
```

EAS runs the build in the cloud — it usually takes 10-15 minutes the first time and 5-10 minutes on subsequent builds. When it finishes, Terminal shows a URL like `https://expo.dev/artifacts/eas/...`. Click it (or copy/paste into your browser) to download the `.tar.gz` file (probably saves to your Downloads folder).

Now boot the Simulator and install:

1. Open **Xcode**, then from its menu bar: **Xcode → Open Developer Tool → Simulator**. A window with a fake iPhone appears.
2. Wait for it to fully boot (you'll see the iOS home screen).
3. **Drag the `.tar.gz` from Finder onto the Simulator window.** The app installs and its icon appears on the home screen.
4. Tap the Trace icon to open. You're running the app.

#### A few things to know about the Simulator

- The first launch may take 30+ seconds — iOS Simulators boot the entire OS each time.
- **Notifications via APNs (real Apple push delivery) won't work** on the Simulator. That's an Apple limitation, not a Trace bug.
- You **can** simulate a notification's appearance on the Simulator with a Mac command — ask Claude for the command if you need this for screenshot/QA purposes.
- Reset everything with **Device → Erase All Content and Settings** in the Simulator menu. Useful for testing the first-time signup flow repeatedly.

---

## Testing real notifications: TestFlight on your iPhone

This is the actual production-like experience. Real APNs delivery, real lock-screen behavior, real tap-to-deeplink.

1. **Get TestFlight installed on your iPhone**. It's a free Apple app from the App Store.
2. **Ask Nate to invite your Apple ID to the Trace TestFlight build.** He runs:
    ```bash
    eas submit --profile production --platform ios
    ```
    and adds your Apple ID email to the TestFlight testers list in App Store Connect.
3. You'll get an email titled something like *"You've been invited to test Trace"*. Tap **View in TestFlight** in that email. Or, open TestFlight, tap **Redeem**, and paste the invite code.
4. Tap **Install**. The app appears on your home screen (its label is "Trace").
5. Open it, sign in, complete onboarding. **Important:** when iOS prompts for notification permission, tap **Allow**. (If you accidentally tap Don't Allow, you can re-enable later: iOS Settings → Trace → Notifications → flip Allow Notifications on.)
6. Now, go to the admin portal and use **Send test push** on your own user. Within a few seconds, your phone shows the notification.

When Nate ships a new build (which happens any time we change anything in the native part of the app — like adding a new SDK), you'll see a TestFlight update prompt; tap to install the new version.

---

## Common workflows

### "I want to write the welcome notification copy"

1. Admin → Notifications.
2. Click **welcome**.
3. Edit Title and Body. The body has a `{{dealCount}}` and `{{homeAirport}}` variable — leave those in `{{ }}` braces and they'll get filled in with each user's actual data when the push goes out.
4. Set Deep link (try **Swipe deck** so they land on the deal feed).
5. Check **Enabled**.
6. Save.
7. Test by sending yourself a test push from your user detail page (you can copy the same wording into the form, or — easier — sign up as a new test user and the welcome will fire automatically tomorrow).

### "I want to announce a new feature"

1. Admin → Notifications → **Compose broadcast**.
2. Title: `New: business class deals 🛫`
3. Body: `Tap to see lie-flat seats from your home airport, up to 65% off.`
4. Audience: leave all four tiers checked, leave platform on **All platforms**.
5. Deep link: **Explore** (so they land on the deal feed).
6. **Send broadcast**.
7. Watch the History page — within a few minutes you'll see attempted/ok counts.

### "Did anyone get my last broadcast?"

Admin → Notifications → **History** (top right of the Notifications tab).

The most recent entry is your broadcast. The "Accepted" column tells you how many devices Expo took. Numbers can be lower than total user count because:
- Some users haven't enabled notifications.
- Some users have devices that haven't connected to APNs/FCM yet.
- Some have the app uninstalled (we automatically clean those up over time).

### "I changed my mind about a triggered notification — how do I turn it off?"

1. Admin → Notifications.
2. Click the trigger.
3. Uncheck **Enabled**. Save.

It's off. The cron still runs daily, but no push goes out until you re-enable.

### "I want a brand new triggered notification"

This requires writing some code (the actual logic of "when does this fire?"). **Ask Claude** — describe the trigger condition in plain English ("send when a user has saved 3+ deals in a single day", say) and Claude will wire it up. Usually <1 hour of back-and-forth. Once wired and deployed, the new template appears in your Notifications tab automatically and you take it from there.

If Claude says it needs Nate (because the change touches credentials, App Store / Play Store config, or something only Nate has access to), it'll tell you exactly what to ask Nate for.

---

## Notifications we haven't built yet — for your review

The 5 triggers wired up today (welcome, trial-ending, billing-issue, inactivity-3d, inactivity-7d) are the foundation, but they're nowhere close to a complete push strategy for a deal-finder app. Below is a menu of additional notifications worth considering. **Read through, pick the ones you want, and work with Claude to wire them up.** Each one needs a small chunk of code; once wired, you control copy and on/off the same way as today.

Effort labels mean roughly:
- **Easy** = ~30 min of code, just a cron that scans userProfiles for some condition.
- **Medium** = ~1-2 hr; needs to integrate with the deal data feed or compute something non-trivial.
- **Hard** = a few hours; new infrastructure (price-tracking history, real-time deal stream, etc.) before the trigger can even fire.

### Deal-driven (the biggest gap right now — premium value prop)

**hot_deal_alert** — Premium only — *medium*
- *When:* A new deal appears at the user's home airport with ≥60% off.
- *Suggested title:* "🔥 65% off to Paris from {{homeAirport}}"
- *Suggested body:* "${{price}} round-trip, normally ${{normalPrice}}. Tap to see it."
- *Deep link:* Explore (or specific deal once we add per-deal deep links)
- *Why:* This is THE differentiator for Premium. People upgrade to find out about hot deals fast.

**saved_alert_match** — Premium only — *medium-hard*
- *When:* A new deal matches an alert the user manually set up (specific destination + month).
- *Suggested title:* "Your {{destination}} alert just matched"
- *Suggested body:* "${{price}} round-trip in {{month}}, ${{discount}}% off."
- *Deep link:* Dashboard → Alerts tab
- *Why:* Highest-leverage Premium use-case. Users explicitly told us they want this, so the open rate is going to be huge.

**daily_deal_digest** — Premium only, opt-in — *medium*
- *When:* Once a day around 8 AM in the user's timezone (or 8 AM ET as a v1 if timezone is hard).
- *Suggested title:* "{{dealCount}} new deals from {{homeAirport}}"
- *Suggested body:* "Including {{topDeal}} — tap to see today's best."
- *Deep link:* Swipe deck
- *Why:* Daily habit-formation. Frequent enough to keep Premium feeling worth it, infrequent enough not to be annoying.

**business_class_drop** — Business tier only — *medium*
- *When:* A new business-class deal appears at the user's home airport.
- *Suggested title:* "Business class to {{destination}} for ${{price}}"
- *Suggested body:* "Lie-flat seat, normally ${{normalPrice}}. {{discountPct}}% off."
- *Deep link:* Explore (with business filter applied)
- *Why:* Business tier is paying a premium specifically for these. Without notifications, they have to keep checking the app.

**deal_expiring_soon** — All paid tiers — *medium*
- *When:* A deal the user *saved* is approaching its sale-end date.
- *Suggested title:* "Your {{destination}} deal expires today"
- *Suggested body:* "Last chance to book at ${{price}}."
- *Deep link:* Dashboard → Saved tab
- *Why:* Recovers high-intent users who saved but didn't book. Trade-off: only valuable if we have reliable expiration data on deals.

### Habit & gamification

**streak_in_danger** — All tiers — *easy*
- *When:* Daily check around 8 PM local; user has a streak of 3+ days and hasn't swiped today.
- *Suggested title:* "Don't break your {{streakDays}}-day streak"
- *Suggested body:* "A few quick swipes will keep it going."
- *Deep link:* Swipe deck
- *Why:* Obvious gamification lever. Only fires for users who already have a streak, so it never feels random.

**daily_swipes_refreshed** — Free tier only — *easy*
- *When:* Daily reset (1 AM ET); user maxed out their swipes yesterday.
- *Suggested title:* "Your daily swipes are back"
- *Suggested body:* "{{swipesRemaining}} fresh deals waiting."
- *Deep link:* Swipe deck
- *Why:* Pulls free users back the moment they have value to consume. Don't fire if they didn't max out — that'd just be noise.

**badge_unlocked** — All tiers — *easy*
- *When:* Right after the user unlocks a badge (existing in-app celebration also).
- *Suggested title:* "🏆 You earned the {{badgeName}} badge"
- *Suggested body:* "Tap to see your collection."
- *Deep link:* Dashboard → Profile → Badges
- *Why:* Reinforces the gamification loop, especially for users who close the app right after unlocking.

**level_up** — All tiers — *easy*
- *When:* Right after Deal Hunter level increases.
- *Suggested title:* "Welcome to level {{newLevel}}"
- *Suggested body:* "{{newPerk}} unlocked." (e.g. "More deals per day")
- *Deep link:* Profile
- *Why:* Same as badge — celebrate then bring them back.

### Subscription milestones

**welcome_to_premium** — Premium subs only — *easy*
- *When:* Immediately after a successful first paid charge (post-trial conversion or fresh sub).
- *Suggested title:* "Welcome to Premium ✈️"
- *Suggested body:* "Unlimited swipes, all deals, priority alerts. You're set."
- *Deep link:* Swipe deck
- *Why:* Reinforces buyer's remorse at the worst moment (right after charge). Open rate is high; great place to highlight what they unlocked.

**welcome_to_business** — Business subs only — *easy*
- *When:* Immediately after upgrading to Business.
- *Suggested title:* "Welcome to Business 🥂"
- *Suggested body:* "Lie-flat deals, 48-hour early access, and everything in Premium."
- *Deep link:* Explore (with business filter)
- *Why:* Same as above, tier-specific.

**trial_ending_3d** — Trial users — *easy* (clone of existing 24h)
- *When:* 3 days before trial ends (earlier reminder before the 24h one).
- *Suggested title:* "{{daysLeft}} days left in your trial"
- *Suggested body:* "Subscribe now to keep unlimited swipes."
- *Deep link:* Paywall
- *Why:* Two-stage trial-end reminders convert better than one. Catches people before "ending tomorrow" feels rushed.

**annual_upgrade_nudge** — Monthly subscribers, 60+ days in — *easy*
- *When:* User has been on monthly for 60+ days, hasn't yet switched to annual.
- *Suggested title:* "Save ${{annualSavings}} a year"
- *Suggested body:* "Switch to Annual and pay 2 months less."
- *Deep link:* Paywall
- *Why:* Annual users churn way less. Free LTV bump.

**winback_30d** — Recently expired users — *medium*
- *When:* 30 days after subscription expired.
- *Suggested title:* "We've added {{newFeature}} since you left"
- *Suggested body:* "Try it free for 7 days when you come back."
- *Deep link:* Paywall (with promo code pre-applied if we wire that)
- *Why:* Cheapest acquisition channel — they already trusted us once.

**subscription_canceled_acknowledgment** — Just-canceled users — *easy*
- *When:* Within an hour of `CANCELLATION` webhook (auto-renew turned off, but access continues).
- *Suggested title:* "We'll miss you"
- *Suggested body:* "Your access continues until {{expirationDate}}. Change your mind? Reactivate anytime."
- *Deep link:* Profile
- *Why:* Surprisingly effective at uncanceling — users sometimes turn off renew by accident or in a moment of frustration.

### Educational / first-time experience

**first_save_celebration** — All tiers, first-time only — *easy*
- *When:* Right after the user saves their first deal.
- *Suggested title:* "Your first save 🎯"
- *Suggested body:* "Find it anytime in the Dashboard tab."
- *Deep link:* Dashboard → Saved
- *Why:* Teaches a behavior they'll repeat. Big retention signal.

**setup_first_alert** — Free tier, T+5 days no alerts — *easy*
- *When:* User has been around 5+ days, hasn't created any alerts yet (Premium-only feature).
- *Suggested title:* "Want a deal alert for somewhere specific?"
- *Suggested body:* "Premium gets you instant alerts when prices drop."
- *Deep link:* Dashboard → Alerts (which prompts the paywall for non-Premium)
- *Why:* Drives Premium upgrade and product depth.

### Operational (you don't need code for these — just use the broadcast feature)

You can already do these today via Compose Broadcast:

- **Feature announcement** — "We just launched X"
- **Maintenance notice** — "Quick maintenance tonight from 2-3 AM ET"
- **Promo code drop** — "Use code TRACE25 for 25% off — this week only"
- **Seasonal** — "Black Friday: 50% off your first year"
- **Newsletter-style "this week's best"** — manually curated weekly summary

### How to use this list

1. Scan through and mentally check which 3-5 you most want next.
2. For each, decide priority: must-have soon vs. nice-to-have eventually.
3. Hand the list to Claude — paste each entry verbatim and ask it to wire them up. Claude will write the trigger code, deploy it, and tell you when each appears in your Notifications tab.
4. The "Operational" section at the bottom — you can do those right now without anyone's help. Just use Compose Broadcast.

A reasonable v2 push strategy might look like: hot_deal_alert + saved_alert_match + daily_deal_digest + welcome_to_premium + streak_in_danger. That covers premium value prop, post-conversion delight, and habit formation. Everything else is incremental.

---

## Glossary

| Term | What it means |
|------|---------------|
| **Push notification** | The message that pops up on a phone's lock screen / banner. |
| **Trigger** | The event that causes a notification to fire (e.g. "user just signed up"). Each trigger has one template. |
| **Template** | The wording (title, body, deep link) that gets used when a trigger fires. You edit templates from the admin. |
| **Broadcast** | A one-off notification you send manually to many users at once. |
| **Audience** | Who a broadcast goes to. You pick by tier (free/trial/premium/business) and/or platform (iOS/Android). |
| **Deep link** | The screen the app opens to when the user taps the notification. Without one, tapping just opens the app to wherever it was last. |
| **Variable** | A placeholder like `{{homeAirport}}` in a template that gets filled with the user's actual data at send time. |
| **TestFlight** | Apple's way to install pre-release versions of apps for testing. Used to install Trace on your iPhone before it's in the public App Store. |
| **Simulator** | A fake iPhone running on your Mac. Lets you try the app without a real phone, but can't receive real push notifications. |
| **Token** | A device's unique identifier with Apple/Google for receiving notifications. The app registers one when you grant permission; you don't see this directly. |
| **APNs / FCM** | Apple's and Google's push notification services. We send through Expo, which talks to these on our behalf. |

---

## Who to ask: Just-do-it / Claude / Nate

Three buckets. Most things you handle yourself or with Claude. Nate is reserved for credentials, dashboards, and platform stuff only he can access.

| Situation | Who? |
|-----------|------|
| Editing copy on an existing trigger | **Just do it** — admin → Notifications → click trigger → save. |
| Toggling a trigger on / off | **Just do it** — same place, checkbox at the bottom. |
| Sending a broadcast | **Just do it** — admin → Notifications → Compose broadcast. |
| Sending a test push to yourself or another user | **Just do it** — admin → user's detail page → Send test push. |
| Generating a promo code | **Just do it** — admin → Promo codes. |
| **Adding a new trigger** ("send a push when a user saves their 5th deal") | **Claude** — describe the condition in plain English. ~30 min of back-and-forth. |
| **Scheduling a broadcast** for a future time | **Claude** — not built yet, but ~1 hour to add. |
| **A/B testing** different copy on the same trigger | **Claude** — needs new infrastructure but doable. |
| **Audience filter beyond tier/platform** ("only SLC users", "only users with 5+ saves") | **Claude** — query change, ~15 min. |
| **A new deal-driven notification** (hot deal alert, alert match, daily digest) | **Claude** — see the full menu in the section above. |
| **Notification copy isn't appearing on devices when it should** | **Claude first** — ask it to read the recent send logs and diagnose. If Claude says it's a credentials/permissions issue, then it'll tell you what to ask Nate for. |
| **Scrubbing notification history** | **Claude** — can delete entries from the Firestore log. |
| **TestFlight invitation for a new tester** (Apple ID is yours or someone else's) | **Nate** — needs Apple Developer account access to add testers. |
| **App Store Connect / Play Console / Apple Developer dashboard tasks** | **Nate** — only he has the logins. |
| **Firebase Secret Manager values** (e.g., rotating ADMIN_API_TOKEN) | **Nate** — needs Firebase admin access. |
| **Vercel env vars** (admin password, API keys) | **Nate** — needs Vercel admin access. |
| **Apple/Google review or policy questions** during App Store submission | **Nate** — handles the developer relationship. |
| **A new build to TestFlight** (after native code changes) | **Nate** — runs `eas build` + `eas submit`, deals with provisioning. |
| **Anything that touches money / billing / refunds** | **Nate** — defer to him. |

### How to "ask Claude" effectively

When you want Claude to add a new trigger or fix something, give it:
1. **What you want** in plain English — "send a push 24h after a user saves their first deal, telling them about deal alerts."
2. **The audience** — "to free users only" / "to anyone who saved a deal yesterday."
3. **Where it should deep-link** — "open the Dashboard alerts tab."
4. **An example title and body** — even rough. Claude will tighten the wording.

Claude has full read access to this codebase, so it can figure out the rest. If anything's ambiguous, it'll ask before writing code.

### When something's broken

If a notification isn't going out and you don't know why, ask Claude:

> "I just turned on the [trigger_name] template and a test push to myself isn't arriving. Can you check the recent logs and tell me what's happening?"

Claude will look at the Cloud Function logs, the notificationLog collection, and the user's profile state, and either fix it or tell you what only Nate can fix.

---

## Tips that aren't in the admin

- **Keep titles under 30-40 characters.** Both iOS and Android truncate longer titles, especially on locked screens. The body has a bit more room (~120 chars is safe).
- **Lead with the value, not the brand.** "Your trial ends tomorrow" beats "Trace: trial ending soon" — every push opens the app, so people already know it's Trace.
- **One emoji is plenty.** Two is the cap. Three feels desperate.
- **Send broadcasts during the day for the user**, not for you. Most users on the app's home airport are in US time zones — 10 AM-5 PM ET is the safest window.
- **Always send yourself a test before broadcasting** to thousands. Typos in production can't be retracted.
- **Watch the History page** for a few minutes after a broadcast — if "errors" is non-zero on a row, click into it; usually means some tokens were stale.

---

## Anything else?

If you're stuck or something's confusing, **ask Claude first** — it can explain anything in this doc, look at the actual code, run diagnostic queries, and walk you through fixes. Save Nate for the things only he can do (the right column of the table above).

The admin portal is designed to fail safe (worst case: a notification doesn't go out), so don't worry about breaking anything by experimenting in there.
