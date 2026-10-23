# Launching Trace Points

Everything in code is done. What's left is accounts and keys in other services, then one deploy. **Owner** says who can do each step. Never paste a key or secret into chat; put it straight into Vercel or `.env.local`.

Going live means three steps in order: test-mode keys on a preview deploy, run the smoke test, then switch to live keys on `points.tracetravel.co`.

## 1. Stripe (Trevor)

Use test mode first. Repeat in live mode when the smoke test passes.

1. **Products:** create "Trace Points" with three recurring prices: **$99.00 / year**, **$12.00 / month**, and the exit gift, **$59.99 / year**. Copy all three price ids (`price_…`).
2. **Developers → API keys:** copy the secret key (`sk_test_…`, later `sk_live_…`) and the publishable key (`pk_test_…` / `pk_live_…`). Real payments switch on only when both are set.
   **Settings → Payment methods → Payment method domains:** add `points.tracetravel.co` (and the preview domain while testing). Apple Pay doesn't show without it.
3. **Developers → Webhooks → Add endpoint:** `https://points.tracetravel.co/api/stripe/webhook` (use the preview URL while testing). Events:
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `customer.subscription.trial_will_end`

   Copy the signing secret (`whsec_…`).
4. **Leave account-wide billing settings alone.** The Trace Travel Stripe account has other products, so Points doesn't change the shared customer portal or "Trial ending events": the app creates its own portal configuration through the API, and the reminder uses Stripe's default 3-day timing. Leave Stripe's own trial reminder email off.
5. **Customer portal:** nothing to do. The app creates a Points-only portal configuration (cancel at period end, update card, switch between $99 yearly and $12 monthly) the first time someone opens Manage billing.
6. **Settings → Public details:** business name and a statement descriptor like `TRACE POINTS`, so the charge is recognizable (fewer chargebacks).
7. **Settings → Emails:** turn on successful-payment receipts and failed-payment emails.

## 2. Firebase (Nate, or anyone with console access to trace-ai-b9cba)

1. **Authentication → Sign-in method → Email/Password:** enable **Email link (passwordless sign-in)**.
2. **Authentication → Settings → Authorized domains:** add `points.tracetravel.co` (and the Vercel preview domain while testing).
3. **Authentication → Templates:** check the sign-in email's sender name and the project's public-facing name read "Trace", not a project number.
4. **Service account:** reuse the admin web's `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` (in the `trace-travel-ai` Vercel project), copied into the new project's env.

No Firestore rules or index deploy is needed: the new collections are server-only, and the existing catch-all rule already denies clients. The explicit blocks added to `firestore.rules` are documentation and can go out with the next rules deploy.

## 3. Slack (Trevor)

Create a channel such as `#points-inbox`, add an **Incoming Webhook** to it, and copy the URL. Everything the team needs to act on lands there:
- new trials
- contact messages
- seat checks, trip requests and watches (reply by email within 24 hours)
- trial reminders to send by hand until email is set up

## 4. Email (optional on day one; Nate for DNS)

Trial reminders send through Resend once these are set; until then Slack asks the team to send them.

1. Create a Resend account and add the sending domain (for example `mail.tracetravel.co`). Nate adds the DNS records it shows.
2. Set `RESEND_API_KEY` and `POINTS_EMAIL_FROM` (for example `Trace Points <points@mail.tracetravel.co>`).

## 5. Meta (Trevor)

1. **Events Manager:** create or pick the pixel; copy the **Pixel ID**. Under Settings, generate a **Conversions API access token**.
2. **Business settings → Brand safety → Domains:** verify `tracetravel.co` (a DNS TXT record; Nate adds it). Needed for iOS event measurement.
3. Events the site sends:
   - `PageView`
   - `ViewContent` (results)
   - `CompleteRegistration` (email given)
   - `InitiateCheckout` (paywall)
   - `StartTrial` (browser plus server, deduplicated)
   - `Contact`

   Optimize ads for **StartTrial**.

## 6. Vercel project and domain (needs explicit approval in a Claude session)

A new project, `trace-points`, in the **Trace Travel** team. It's separate from `trace-travel-ai` (subscribe.tracetravel.co), which must not be touched. Every command uses `--global-config ~/.vercel-trace`, run from `projects/points` (never the repo root, which is linked to the subscribe site).

1. Done Oct 23, 2026: `trace-points` exists in Trace Travel and a test-mode preview is deployed.
2. Production env vars (Vercel → trace-points → Settings → Environment Variables):
   - `TRACE_ENV=prod` (production only; previews stay on staging data)
   - `NEXT_PUBLIC_SITE_URL=https://points.tracetravel.co`
   - `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_PRICE_ANNUAL`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_ANNUAL_GIFT`, `STRIPE_WEBHOOK_SECRET`
   - `FIREBASE_PROJECT_ID=trace-ai-b9cba`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
   - `POINTS_SESSION_SECRET`: a long random string (`openssl rand -base64 32`)
   - `POINTS_SLACK_WEBHOOK_URL`
   - `NEXT_PUBLIC_META_PIXEL_ID`, `META_CAPI_TOKEN`
   - `RESEND_API_KEY`, `POINTS_EMAIL_FROM` (when step 4 is done)
3. Deploy. The project already exists (`trace-points`, id `prj_jqhk9TeYreWrpulaPE1BnVWzMsDD`, linked in `projects/points/.vercel`). Build locally, then upload from a folder outside the repo, because the repo root's `.vercelignore` (subscribe site) excludes `projects/points`:
   ```bash
   cd projects/points
   vercel pull --yes --environment=production --global-config ~/.vercel-trace
   vercel build --prod --global-config ~/.vercel-trace
   cd ../.. && mkdir -p .vercel && mv projects/points/.vercel/output .vercel/output
   node projects/points/scripts/stage-prebuilt.mjs . /tmp/points-deploy && rm -rf .vercel
   cd /tmp/points-deploy && VERCEL_ORG_ID=team_CNky3bLoj7BjnytDeqrOvz9u VERCEL_PROJECT_ID=prj_jqhk9TeYreWrpulaPE1BnVWzMsDD \
     vercel deploy --prebuilt --prod --global-config ~/.vercel-trace
   ```
   Drop `--prod` (and use `--environment=preview` on pull) for a preview. Don't connect the GitHub repo: `vercel link` tries to on its own and failed only because no GitHub login is connected; keep it that way (paid-seat risk, same as the subscribe site).
4. **Domain:** add `points.tracetravel.co` to `trace-points`. `tracetravel.co` lives on Nate's personal Vercel account, so Nate adds the CNAME (`points` → `cname.vercel-dns.com`) and any verification TXT record Vercel shows. Change nothing else in DNS.

## 7. Smoke test (with Stripe test keys, on the preview)

1. Fresh phone browser: landing → funnel → results → paywall → checkout with card `4242 4242 4242 4242`. Also try Apple Pay on an iPhone, and back out of checkout once: the $59.99 gift should appear, and claiming it should show $59.99 at checkout and in Stripe.
2. Lands in the app as a member. Slack shows "New Trace Points trial". In Firestore, `pointsUsers` (prod, or `staging_pointsUsers` on a preview) has the member.
3. Second browser: `/signin` → email link → same trips and membership.
4. Tap Find my seats, request a trip, add a dated watch, send a contact message: all four reach Slack.
5. Account → Cancel free trial → Stripe portal → cancel. Reload: access ends at the right time.
6. Stripe → the subscription → "Advance time" (test clock), or wait for `trial_will_end`: the reminder email (or the Slack fallback) arrives.
7. Meta Events Manager → Test events: PageView and StartTrial show, StartTrial once.

Then switch Stripe to live keys and prices, redeploy, and run steps 1–2 once with a real card (refund it from Stripe).

## 8. Before spending on ads

- **Logos:** `public/logos/` are development placeholders. Swap in licensed marks or remove them, especially for anything shown in ads.
- **Data:** `src/engine/data.ts` is dated 2026-10-21, and the Amex → Flying Blue bonus ends Oct 31. Someone owns the weekly refresh (README, "Refreshing the data").
- **Money-back guarantee:** the Terms say a full refund if someone asks within 14 days of a charge. Confirm that's the policy you want.
- **Legal review:** `/privacy` and `/terms` are a solid plain-English start, not lawyer-reviewed.
- **Team coverage:** someone watches `#points-inbox` daily; the app promises replies within 24 hours.
