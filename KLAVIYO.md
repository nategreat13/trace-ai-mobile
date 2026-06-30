# Klaviyo Email Integration — status & guide

_For a Claude session helping **Trevor** build out Trace's lifecycle email. Read this first, then `CLAUDE.md` (deploy policy) and `STAGING.md` (env model). Last updated: 2026-06-30._

## TL;DR — where things stand

- ✅ **All 5 lifecycle events are wired in server code** (signup, 2 re-engagement, trial start, swipe-limit). Each fires a Klaviyo metric.
- ✅ **The 5 metrics are registered in Klaviyo** (via a one-off test fire), so they're selectable as Flow triggers **right now** — Trevor can build the flows today.
- ⬜ **Functions not deployed yet** — the events won't fire for *real* users until Nate deploys (`firebase deploy --only functions:api,functions:apiStaging`). Building the flows doesn't need the deploy; live firing does.
- ⬜ **Trevor builds 5 Flows** (NOT Campaigns — see below) triggered by the 5 metrics.
- ⬜ **Sending domain** (SPF/DKIM in Klaviyo) must be verified before anything delivers.

## The one Klaviyo fact that shapes everything

**Klaviyo has no generic "send this email to this address" API.** All sends are **Flow- or Campaign-driven**:
> our server fires an **event** → a **Flow** Trevor built (triggered by that event's metric) → the email sends (if the profile is subscribed + the sending domain is verified).

Firing the event via the API *is* the entire server-side hookup — no webhook to register. Klaviyo auto-creates a metric the first time it receives an event with that name.

## ⚠️ Flows, NOT Campaigns

These are the two different Klaviyo objects, and it matters:
- **Campaign** = a one-time manual blast to a list. **Does not react to events.**
- **Flow** = an automated sequence **triggered by a metric/event**. ← all five of ours must be Flows.

If these were built as Campaigns, our events won't trigger them and nothing automates. The email *content* is reusable — copy it into a Flow's email step.

## The 5 emails → events

| Email (`projects/emails/*.html`, reference only) | Trigger metric | Fires when | Source |
|---|---|---|---|
| welcome | **`Signed Up`** | user finishes onboarding | signup trigger |
| day2-reengagement | **`Inactive 2 Days`** | ~2 days since last app activity | daily cron (`lastSeenAt`) |
| day7-reengagement | **`Inactive 7 Days`** | ~7 days since last app activity | daily cron (`lastSeenAt`) |
| trial-started | **`Started Trial`** | free trial begins | RevenueCat webhook |
| swipe-limit | **`Hit Swipe Limit`** | user hits the daily swipe cap | client-events trigger (`daily_limit_hit`) |

We set `first_name` and `home_airport` as **profile properties** so the templates' `{{ first_name }}` / `{{ person.home_airport }}` render.

> Note: `projects/emails/*.html` are **reference drafts only — not wired to anything.** The live email is whatever's built in Klaviyo. Klaviyo is the source of truth for copy.

## How to build a Flow on a metric

1. **Flows → Create Flow → Create from scratch.**
2. Trigger type = **Metric** → **Your metrics → API** → pick the metric (e.g. `Inactive 2 Days`). *(The metric must already exist in Klaviyo to appear here — ours are registered, so they will.)*
3. Drag in an **Email** action, build/paste the content.
4. Set **Live**.

**No time delay needed.** Our cron is the timer — `Inactive 2 Days` only fires when someone is *actually* 2 days inactive, so the flow should send **immediately** on trigger. Don't add a 2-day delay inside the flow or you'd double the wait. Same for the others — the server fires each event at the right moment.

## Re-entry & the cooldown filter (important for the re-engagement emails)

Two layers govern how often a person gets a re-engagement email:

- **Our side:** each `Inactive N Days` event fires **once per inactivity episode** — once when they cross the 2-day mark, again only if they come back and lapse again later. It does **not** repeat daily while they stay gone.
- **Klaviyo side (Trevor's setting):** by default a profile **re-enters** a metric-triggered flow each time the metric fires. For re-engagement that's usually desirable (win them back each time they lapse) — but add a **cooldown flow filter** so a frequently-in-and-out user isn't pestered, e.g.:
  > Flow filter: **"Has not received [this email] in the last 14 days"** (or 2–4 weeks).

  For `Signed Up` / `Started Trial`, re-entry is moot — those moments happen once per person — but a "skip if already premium" filter on the trial email is reasonable.

## Prerequisites for anything to actually deliver
- **Subscription/consent** — the profile must be on the **Email List**. The server subscribes users (single opt-in) on signup. *(This subscribe path hasn't been verified end-to-end yet — confirm on the first real signup post-deploy.)*
- **Sending domain verified** (Klaviyo → Settings → Domains: SPF/DKIM). Nothing delivers until this is done.

## Who does what
| Task | Who |
|---|---|
| Build the 5 Flows + copy, set re-entry/cooldown, verify sending domain | **Trevor (+ Claude)** |
| `firebase deploy` (live event firing), secrets, DNS | **Nate** (infra owner) |

**Deploy policy (`CLAUDE.md`): never run a production deploy without Nate's explicit approval in-session.** Write code/build flows; ask Nate to deploy.

## Dev notes / gotchas (for a coding session)
- **Klaviyo Events API payload:** `metric` and `profile` are JSON:API relationships — each must be `{ "data": { "type": ..., "attributes": ... } }`. A flat object 400s with *"'data' key missing in relationship."* (`lib/klaviyo.ts` is correct; don't regress it.) Host `https://a.klaviyo.com/api`, `Authorization: Klaviyo-API-Key pk_…`, `revision: 2026-04-15`.
- **Re-engagement uses `lastSeenAt`, not `app_open`.** The old `app_open → "App Opened"` forwarding was removed — `app_open` was too sparse (~4% of users). Re-engagement runs off the reliable `lastSeenAt` cron in `notification-cron.ts`.
- **Secrets are per-function.** `KLAVIYO_PRIVATE_API_KEY` + `KLAVIYO_LIST_ID` are bound to every function that fires events (api/apiStaging, signup triggers, the cron, the client-events trigger). A new firing site needs them in its own `secrets:` array.
- **Staging is whitelist-gated.** In staging, events only fire for emails on the `sandboxEmailWhitelist` (admin "Email whitelist" tab, env = Staging). Prod sends to everyone.

## File reference
| File | What |
|---|---|
| `projects/server/src/lib/klaviyo.ts` | client (`trackKlaviyoEvent`, `subscribeKlaviyoProfile`) + prod/staging gate |
| `projects/server/src/triggers/user-signup.ts` | `Signed Up` + subscribe |
| `projects/server/src/triggers/notification-cron.ts` | `Inactive 2 Days` / `Inactive 7 Days` (lastSeenAt) |
| `projects/server/src/routes/revenuecat-webhook.ts` | `Started Trial` |
| `projects/server/src/triggers/client-events.ts` | `Hit Swipe Limit` (from `daily_limit_hit`) |
| `scripts/klaviyo-register-metrics.mjs` | one-off: registers the 5 metrics in Klaviyo so flows can be built pre-deploy |
| `projects/emails/*.html` | reference drafts only (not wired) |
