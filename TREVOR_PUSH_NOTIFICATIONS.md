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

It goes out **immediately**. There's no scheduled-send yet — if you need that, ping Nate and we'll add it.

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

### Two ways to get the app onto your Simulator

**Option A — Easy: Nate sends you a build file** (recommended)

When the app is updated, Nate runs a build and gives you the resulting `.tar.gz` file (probably in Slack or Drive). To install:

1. Open **Xcode** (free from the Mac App Store if you don't have it). Just opening it is enough — you don't need to know how to use it.
2. From Xcode's menu bar: **Xcode → Open Developer Tool → Simulator**. A window with a fake iPhone appears.
3. Pick a device model: **File → New Simulator** if you want to choose, or it'll boot the default.
4. Wait for the Simulator to fully boot (you'll see the iOS home screen).
5. **Drag the `.tar.gz` file from Finder onto the Simulator window.** The app installs and you'll see its icon appear on the home screen.
6. Tap to open. You're running Trace.

**Option B — Self-sufficient: Build it yourself**

Only do this if you want to be independent. Setup is ~30 minutes the first time, but builds after that are one command.

#### One-time setup

1. **Install Node.js** (the runtime our build tools need):
    - Go to https://nodejs.org and download the LTS version (the green button).
    - Open the `.pkg` file, click through the installer.
2. **Install Xcode** from the Mac App Store. Open it once and accept the license. You don't need to use it directly — we just need it installed for the Simulator and command-line tools.
3. **Get the Trace repo**. You'll need access from Nate first — ask him to add your GitHub username as a collaborator.
    - Once added, accept the invitation email from GitHub.
    - On your Mac, open **Terminal** (Cmd-Space → "Terminal").
    - Run:
      ```bash
      cd ~
      git clone https://github.com/nategreat13/trace-ai-mobile.git
      cd trace-ai-mobile/projects/app
      ```
4. **Install the project's dependencies**:
    ```bash
    npm install -g yarn
    cd ~/trace-ai-mobile/projects/app
    yarn install
    ```
5. **Install the Expo build CLI**:
    ```bash
    npm install -g eas-cli
    ```
6. **Log in to Expo**. Ask Nate for the Trace Expo account credentials, or have him add you as a collaborator on the project. Then:
    ```bash
    eas login
    ```

#### Building the simulator app

Whenever you want a fresh Simulator build (typically: after Nate updates the app, or you want to try the latest code):

```bash
cd ~/trace-ai-mobile
git pull
cd projects/app
eas build --profile simulator --platform ios
```

EAS does the build in the cloud (takes about 10-15 minutes the first time, faster on subsequent builds because it caches stuff). When it finishes, the Terminal will show a download URL like `https://expo.dev/artifacts/...`. Click it (or copy/paste into your browser) to download the `.tar.gz`.

Then drag the `.tar.gz` onto a running Simulator (same as Option A step 5).

#### A few things to know about the Simulator

- The first launch may take 30+ seconds — iOS Simulators boot the entire OS each time.
- **Notifications via APNs (real Apple push delivery) won't work** on the Simulator. That's an Apple limitation, not a Trace bug.
- You **can** simulate a notification's appearance on the Simulator with a Mac command — ask Nate if you need this for screenshot/QA purposes.
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

This requires Nate to write some code (the actual logic of "when does this fire?"). Ping him with what you want and he'll wire it up — usually <1 hour. Once wired, it appears in your Notifications tab automatically and you take it from there.

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

## When to ask Nate

| Situation | Ask Nate? |
|-----------|-----------|
| Editing copy on an existing trigger | No — just do it. |
| Toggling a trigger on/off | No. |
| Sending a broadcast | No. |
| Sending a test push to yourself or another user | No. |
| **Adding a new trigger** (e.g., "send a push when a user saves their 5th deal") | Yes — needs ~30 min of code. |
| **Scheduling a broadcast** for a future time | Yes — not built yet. |
| **A/B testing** different copy on the same trigger | Yes — needs new infrastructure. |
| Notification copy isn't appearing on devices when it should | Yes — could be a delivery issue, an opted-out account, or something Nate broke. |
| You want to filter the audience by something other than tier/platform (e.g., "only users from SLC") | Yes — needs a new audience filter. |
| You need to delete a broadcast you sent by accident | Sort of — once it's sent, it's sent (Apple/Google deliver them). But Nate can scrub the history log if needed. |

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

If you're stuck or something's confusing, ping Nate. The system is designed to fail safe (worst case: a notification doesn't go out), so don't worry about breaking anything by experimenting in the admin.
