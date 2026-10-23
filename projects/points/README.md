# Trace Points

A mobile-first web app that turns credit card points and airline miles into trips people can book from their home airport. It is a standalone product: it shares Trace's look and a few helpers with the mobile app, but none of its data, users or subscriptions.

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
5. Bump `DATA_AS_OF` (it drives the "Live · Prices updated 2 days ago" label on the results page, so the refresh job should set it), then run `yarn workspace @trace/points test`. The tests pin the three cases from the brief, so a data change that breaks them is worth a second look.

Marriott Bonvoy transfers at 3:1 (United 3:1.1); the 5,000-point bonus on 60,000-point transfers is left out to stay conservative. Still to verify: the inland price adjustments, Virgin's ANA pricing (last confirmed 2024), and Bilt's current card bonus.

## Payments (Stripe)

Checkout lives at `/checkout`. With no Stripe keys it runs in **test mode**: the trial starts on the device and the page says so. Add keys and it switches to Stripe Checkout with no code changes:

1. In Stripe (test mode first), create a product "Trace Points" with two recurring prices: **$99/year** and **$12/month**.
2. Copy `.env.example` to `.env.local` in this folder and fill in `STRIPE_SECRET_KEY` and the two price IDs. Never commit it or paste keys in chat.
3. Add a webhook endpoint pointing at `https://<site>/api/stripe/webhook` for `customer.subscription.created`, `.updated`, `.deleted`, `.trial_will_end` and `invoice.payment_failed`, and put its signing secret in `STRIPE_WEBHOOK_SECRET`. Locally: `stripe listen --forward-to localhost:3003/api/stripe/webhook`.
4. Turn on the customer portal in Stripe settings (cancel and switch plans).

The trial is 7 days with the card collected up front; Stripe bills at the end unless the user cancels. Every trial start, test or real, goes through `onTrialStarted` in `src/lib/payments.ts` (analytics and Meta StartTrial today; welcome email later). The webhook marks where server-side work goes once there's a database: saving the member, the trial-ending reminder (Stripe sends `trial_will_end` 3 days out; send ours 2 days out), and cancellations.

## Not built yet
- **Accounts and a database.** No sign-in; everything is per-browser. Magic-link auth, saved trips, watches and the verification queue need a backend.
- **Real seat dates.** "Find my seats" records the request locally. Phase 1 is a manual verification queue in an admin page.
- **Email and SMS** (abandoned-paywall sequence, trial reminder, alerts). Email is now optional during the funnel (an inline "email me this list" card) and required at checkout.
- **Admin tables** for editing the seed data without a deploy.
- **Analytics sink, Meta Pixel and CAPI.** `track()` already fires every funnel event.
- **"New today" badges** on Discover, which need the nightly refresh.
- **Licensed logos.** `public/logos/` holds the programs' own site icons and Wikimedia Commons marks, for development only. Replace them with affiliate-network and press-kit assets before launch; `ProgramBadge` falls back to a letter code if a file is missing.
- **Affiliate links.** Card offers link to each issuer's public card page (`applyUrl`). Swap in affiliate links once approved.

## Photo credits

Maui, Los Cabos and Bali aren't in Trace's deals feed, so they use openly licensed Wikimedia Commons photos. Credits show on the landing page and trip pages:

- Maui: dronepicr, CC BY 2.0
- Los Cabos: Diego Delso, CC BY-SA 4.0
- Bali: Vyacheslav Argenberg, CC BY 4.0
