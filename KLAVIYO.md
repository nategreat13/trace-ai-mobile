# Klaviyo Email Integration — status & guide

_For a Claude session helping **Trevor** build out Trace's lifecycle email. Read this first, then `CLAUDE.md` (deploy policy) and `STAGING.md` (env model). Last updated: 2026-06-29._

This doc explains what's already built, how the pieces fit, and the work that remains — so you can guide Trevor through it.

---

## TL;DR — where things stand

- ✅ **Config + client lib are live.** The Cloud Functions hold the Klaviyo secrets, and `projects/server/src/lib/klaviyo.ts` is deployed and ready to call.
- ✅ **Staging safety (whitelist) is built** — in staging, email only sends to whitelisted test addresses.
- ⬜ **No events are wired yet — nothing sends.** This is the main remaining work: decide *what to send and when*, then call the lib from the right server hooks.
- ⬜ **No Klaviyo Flows/copy yet** — Trevor builds these in the Klaviyo UI once events flow.
- ⬜ **Sending domain not verified** (assumed) — required before any real email can deliver.

Relevant commits: `4599ca8` (config + lib), `46bc98a` (staging whitelist).

---

## The one Klaviyo fact that shapes everything

**Klaviyo has no generic "send this email to this address" API.** All sends are **Flow- or Campaign-driven**. The model is:

> fire an **event** (e.g. "Signed Up") → a **Flow** Trevor built in Klaviyo (triggered by that event) → the email sends to that profile (if subscribed).

So "send an email" always means "fire an event + have a Flow set up + the profile is subscribed." There is no shortcut. Keep this in mind whenever Trevor says "send X email."

---

## How it's wired (architecture)

- **Server-side only.** The mobile app does NOT talk to Klaviyo. Every send originates from a Cloud Function calling `lib/klaviyo.ts`. (This keeps the API key off devices and out of the web app.)
- **The client lib** — `projects/server/src/lib/klaviyo.ts`, two functions:
  - `trackKlaviyoEvent(metric, profile, properties?, value?)` — records a metric event **and upserts the profile** from the inline `profile` block (`{ externalId, email, firstName, lastName }`). `metric` is the human name Flows trigger on (e.g. `"Started Trial"`). `externalId` = the Firebase `userId`.
  - `subscribeKlaviyoProfile(email, externalId)` — single opt-in to the **Email List**. Required for Flows to actually *send* — tracking an event alone leaves the profile unsubscribed.
  - Both are **fire-and-forget** (never throw, never block the caller) and **no-op without the secrets**.
- **The prod/staging gate** (inside the lib):
  - **prod →** send to anyone.
  - **staging →** send only if the recipient email is on the `sandboxEmailWhitelist` collection. No email, or not whitelisted → skipped (logged).
  - This is why you can safely test in staging: real users never get email there.

---

## The work that remains

### 1. Wire events (the core dev task — you can do this with Trevor)

Pick a lifecycle moment, import the lib, call it. The hook points already exist in the codebase:

| Moment | File | What's available there |
|---|---|---|
| **Signup** (finished onboarding) | `projects/server/src/triggers/user-signup.ts` → `handleUserSignup` | `email`, `userId`, `firstName`, `lastName`, `country`, `homeAirport` |
| **Trial / purchase / cancel / expire** | `projects/server/src/routes/revenuecat-webhook.ts` | `app_user_id` (= userId), profile `email`, event `type`, `period_type` (TRIAL vs paid), `tier` |
| **App engagement** (first swipe, etc.) | client writes to the `events` Firestore collection | would need a new filtered Firestore trigger if a Flow needs these |

Example — wiring the signup event (illustrative; confirm the exact insertion with the current file):

```ts
import { trackKlaviyoEvent, subscribeKlaviyoProfile } from "../lib/klaviyo";

// inside handleUserSignup, after the existing fanOutConversion(...) call:
await subscribeKlaviyoProfile(email, userId);
await trackKlaviyoEvent(
  "Signed Up",
  { externalId: userId, email, firstName, lastName },
  { home_airport: homeAirport, country }
);
```

⚠️ **Secrets-per-function gotcha:** the Klaviyo secrets are currently bound to the `api` + `apiStaging` functions only (in `index.ts`). The **signup trigger is a separate function** with its own `secrets:` array (in `user-signup.ts`). If you wire events from the signup trigger, add `KLAVIYO_PRIVATE_API_KEY` + `KLAVIYO_LIST_ID` to that array too, or the lib will no-op there. Events fired from the RC webhook (which runs inside `api`/`apiStaging`) already have the secrets.

After wiring → **server deploy required** (`firebase deploy --only functions:api,functions:apiStaging`) — **ask Nate** (see deploy policy below).

### 2. Build the email in Klaviyo (Trevor's side, in the Klaviyo UI)

1. **Verify a sending domain** (Settings → Domains: SPF/DKIM DNS records). Nothing delivers until this is done. DNS may need Nate.
2. Create a **Flow** triggered by the metric you wired (e.g. `Signed Up` → Welcome series).
3. Write the copy.
4. Make sure the Flow's audience includes subscribed Email List members.

### 3. Test it (staging, safely)

1. Admin portal → **Email whitelist** tab, with the env toggle set to **Staging** → add your own email.
2. Trigger the event in staging (e.g. complete a signup against the staging server). Local option: `yarn dev1` defaults to staging; needs `KLAVIYO_PRIVATE_API_KEY` + `KLAVIYO_LIST_ID` in `projects/server/.env.local` (get values from Nate).
3. Confirm in Klaviyo's **activity feed** + your inbox. Check Cloud Function logs for `[Klaviyo] event accepted` (success) or a `401`/`404` (bad key/list).

### 4. (Optional, deferred) "Send test email" admin button

Discussed but **not built**. Because Klaviyo has no one-call send, a "test email" = fire a chosen event for a target address (triggers the Flow). If Trevor wants this, it'd be a new admin endpoint + UI: prod → any address, staging → whitelist only (reuse the same gate). Flag it to Nate as a small follow-up feature.

---

## Staging vs prod safety (the whitelist)

- **Admin → "Email whitelist" tab.** Manage it with the env toggle on **Staging** (the only place it does anything).
- In **staging**, only whitelisted addresses can receive email. In **prod**, the whitelist is ignored (everyone). Adding to the prod whitelist is intentionally blocked.
- Backed by the `sandboxEmailWhitelist` Firestore collection (server-only).

---

## Who does what (important — Trevor is non-technical on infra)

| Task | Who |
|---|---|
| Write event-wiring code, build Klaviyo Flows + copy, manage the whitelist | **Trevor + Claude** |
| `firebase functions:secrets:set …`, `firebase deploy …`, `vercel --prod`, DNS for the sending domain | **Nate** (infra owner) |

**Deploy policy (from `CLAUDE.md`): never run a production deploy without Nate's explicit approval *in that session*.** This includes any `firebase deploy`, `vercel --prod`, secret changes, or App Store/OTA actions. Write the code, then ask Nate to deploy — don't chain code + deploy.

---

## File reference

| File | What it is |
|---|---|
| `projects/server/src/lib/klaviyo.ts` | the client (`trackKlaviyoEvent`, `subscribeKlaviyoProfile`) + the prod/staging gate |
| `projects/server/src/index.ts` | declares `KLAVIYO_PRIVATE_API_KEY` + `KLAVIYO_LIST_ID`, bound to `api`/`apiStaging` |
| `projects/server/src/triggers/user-signup.ts` | signup hook (a separate function — needs its own secrets entry if you wire here) |
| `projects/server/src/routes/revenuecat-webhook.ts` | subscription lifecycle hook |
| `projects/web/src/app/(authed)/email-whitelist/page.tsx` + `lib/sandbox-whitelist.ts` | the whitelist admin UI |
| `firestore.rules` | deny-all rules for `sandboxEmailWhitelist` (+ `staging_`) |
| `projects/shared/src/collections.ts` | registers the `sandboxEmailWhitelist` collection name |

---

## Gotchas checklist

- **Nothing sends until an event is wired AND a Flow exists AND the profile is subscribed AND the sending domain is verified.** Four conditions.
- **Klaviyo API:** host `https://a.klaviyo.com/api`, `Authorization: Klaviyo-API-Key pk_…`, pinned `revision: 2026-04-15`. Events return `202`. (All handled inside the lib.)
- **Secrets must exist in Secret Manager before *any* functions deploy** (they do). If you bind them to a new function, the secret must exist or the deploy fails.
- **Consent:** US-centric base → single opt-in is fine (CAN-SPAM is opt-out); Klaviyo auto-adds unsubscribe. If meaningful EU/Canada volume shows up, segment them out or get explicit consent.
- **The list is the Klaviyo "Email List."** Segments (Engaged 30/60/90, New Subscribers) auto-populate from behavior — you subscribe people to the *list*, not a segment.
