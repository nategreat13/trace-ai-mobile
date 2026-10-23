# Trace Points

A mobile-first web app that turns credit card points and airline miles into trips people can book from their home airport. It is a standalone product: it shares Trace's look, a few helpers and the Firebase project with the mobile app, but keeps its own collections (`pointsUsers`, `pointsRequests`), sign-in and subscriptions (Stripe, not RevenueCat). Going live: see [LAUNCH.md](LAUNCH.md).

```bash
yarn workspace @trace/points dev     # http://localhost:3003
yarn workspace @trace/points test    # math engine + airport search
yarn workspace @trace/points build
NEXT_DIST_DIR=.next-build yarn workspace @trace/points build   # while dev is running
```

## What's here

| Path | What it is |
|---|---|
| `src/engine/` | The points math. Pure functions, no I/O, fully tested. |
| `src/engine/data.ts` | **All seed data**: programs, transfer partners, bonuses, card offers, trips. |
| `src/lib/airports.ts` | Launch airports and the search (codes, cities, states, nicknames, zip codes). |
| `src/lib/zip3.ts` | Western ZIP prefix centroids, generated from the mobile app's Census table. |
| `src/lib/images.ts` | Destination photos (Trace's deals feed, plus credited Commons photos) and hero list. |
| `src/lib/destinations.ts` | Groups trips by city so economy and business show in one card. |
| `public/logos/` | Program logos, **development placeholders** (see below). |
| `src/lib/worldAirports.ts` | 3,244 airports with scheduled service, from OurAirports (public domain). Generated; loaded on demand by Plan a trip. |
| `src/lib/worldSearch.ts` | Searches that list, plus famous places with no airport (Kyoto → KIX/ITM). |
| `src/lib/payments.ts`, `src/app/api/` | Checkout, trial start, billing portal and the Stripe webhook. |
| `src/app/api/cash-deals/`, `src/lib/cashDeals.ts` | Cash fares for trips they're short on, from the Trace prod deals feed (`/deals/{airport}`). Smaller airports use a nearby hub's feed. Cached for an hour. |
| `src/app/contact/`, `src/app/api/contact/` | Contact us form (menu, Account, and the free results sheet). Email is prefilled; messages go to Slack via `POINTS_SLACK_WEBHOOK_URL`, or to the server log without it. |
| `src/lib/account.tsx`, `src/app/signin/`, `src/app/api/me`, `src/app/api/session` | Accounts: sign-in by emailed link, state sync across devices, membership from Stripe. |
| `src/lib/server/` | Server-only helpers: Firebase Admin (env-aware `colRef`), the session cookie, members, Stripe, Slack, email, Meta CAPI. |
| `src/app/api/requests/` | Seat checks, trip requests and dated watches, to Slack and `pointsRequests` for the team to answer. |
| `src/app/privacy/`, `src/app/terms/` | Privacy policy and terms. |
| `src/lib/value.ts` | Cents per point for a trip (cash fare minus taxes, over points). |
| `src/lib/store.tsx` | App state, saved in the browser (`localStorage`) until there's a backend. |
| `src/lib/analytics.ts` | `track()`; logs funnel events and maps them to Meta events. No sink yet. |
| `src/components/funnel/` | The pre-signup funnel, landing through paywall. |
| `src/components/results/` | List and swipe views, filters, locked rows. Shared by results and Discover. |
| `src/app/(app)/` | Member pages: Discover, Plan a trip, My trips, Alerts, My points, Account, trip detail. |

## Refreshing the data (weekly)

Everything lives in `src/engine/data.ts`. Each value is labeled in the UI as typical or estimated, so keep it honest:

1. **Transfer bonuses** (`BONUSES`): add or remove entries. `endsOn` is inclusive; the engine stops applying a bonus the day after, so expired ones can sit there harmlessly until the next cleanup.
2. **Card offers** (`CARD_OFFERS`): update bonus, spend, fee and tag, then bump `CARD_OFFERS_AS_OF`. The date shows next to every offer.
3. **Transfer partners** (`PARTNERS`): add a source or change a ratio. Ratios are before bonuses.
4. **Trips** (`tripDefs`): per-person typical saver prices. The first 16 come from the Oct 21 research (`source: "brief"`). The other 36 are Trace estimates from published award charts (`source: "estimate"`), labeled that way in the app; verify them and flip `source` when they're checked. Use `byOrigin` for inland or Northwest pricing, `until` for promos that end, and `notFrom` for routes a program doesn't serve. Mark anything shaky with a `note`; it shows in the fine print.
5. Bump `DATA_AS_OF`, then run `yarn workspace @trace/points test`. The tests pin the three cases from the brief, so a data change that breaks them is worth a second look.

Marriott Bonvoy transfers at 3:1 (United 3:1.1); the 5,000-point bonus on 60,000-point transfers is left out to stay conservative. The results page's "Live" label describes the real-time recalculation, not the prices. Set `REFRESH_SCHEDULE = "daily"` in `data.ts` once a daily refresh job is live and it adds "Prices refresh every day".

Still to verify: the inland price adjustments, Virgin's ANA pricing (last confirmed 2024), and Bilt's current card bonus.

## Accounts

Sign-in is passwordless. Firebase Auth (project `trace-ai-b9cba`) only emails the link and proves the person owns the address; Points then sets its own signed, httpOnly cookie (`POINTS_SESSION_SECRET`). That keeps a Points sign-in from ever becoming a session for the mobile app account with the same email.

- **After checkout:** `/api/checkout/verify` records the membership and signs the buyer in on that device, but only for a new account (or one already signed in there). An existing account with saved data gets an emailed link instead, so paying with someone else's email never opens their trips.
- **Other devices:** `/signin` emails a link to `/signin/finish`, which trades the Firebase ID token for the cookie.
- **Sync:** `AccountProvider` loads the account on start (the account wins over the device) and saves changes back a moment later. Only the fields in `SYNC_KEYS` (`src/lib/sync.ts`) sync; membership is never taken from the client.
- **Data:** `pointsUsers/{sha256(email)}` and `pointsRequests`, through the env-aware `colRef`. Local dev and previews use the `staging_` collections; production sets `TRACE_ENV=prod`. Both are server-only (Admin SDK); `firestore.rules` denies clients.

## Payments (Stripe)

Checkout lives at `/checkout`. With no Stripe keys it runs in **test mode**: the trial starts on the device only. With keys it uses Stripe Checkout (7-day trial, card up front). Setup steps are in [LAUNCH.md](LAUNCH.md).

The webhook (`/api/stripe/webhook`) keeps `pointsUsers` in step with Stripe:

- `checkout.session.completed`: records the member (covers buyers who close the tab), sends Meta CAPI `StartTrial` with the session id as the event id (the browser sends the same id), and posts the new trial to Slack.
- `customer.subscription.trial_will_end`: emails the trial reminder (set Stripe's "Trial ending events" to 2 days so it matches checkout). Without email set up, it asks the team in Slack to send it.
- `customer.subscription.updated` / `.deleted`: turns access on or off. `trialing`, `active` and `past_due` keep access.

The billing portal opens for the signed-in account's own Stripe customer only.

## Not built yet
- **Real seat dates.** "Find my seats", trip requests and dated watches go to Slack; the team answers by email. An admin queue would replace Slack later.
- **Email beyond trial reminders** (welcome, abandoned-paywall sequence, alerts) and SMS.
- **Admin tables** for editing the seed data without a deploy.
- **"New today" badges** on Discover, which need the nightly refresh.
- **Licensed logos.** `public/logos/` holds the programs' own site icons and Wikimedia Commons marks, for development only. Replace them with affiliate-network and press-kit assets before launch; `ProgramBadge` falls back to a letter code if a file is missing.
- **Affiliate links.** Card offers link to each issuer's public card page (`applyUrl`). Swap in affiliate links once approved.

## Photo credits

Maui, Los Cabos and Bali aren't in Trace's deals feed, so they use openly licensed Wikimedia Commons photos. Credits show on the landing page and trip pages:

- Maui: dronepicr, CC BY 2.0
- Los Cabos: Diego Delso, CC BY-SA 4.0
- Bali: Vyacheslav Argenberg, CC BY 4.0
