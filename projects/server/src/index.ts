import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { app } from "./app";
import { runWithEnv } from "./env";

// Declared so the value is injected into process.env at runtime. The
// RevenueCat webhook handler reads process.env.REVENUECAT_WEBHOOK_SECRET
// and rejects requests whose Authorization header doesn't match.
const revenuecatWebhookSecret = defineSecret("REVENUECAT_WEBHOOK_SECRET");

// Server-side RevenueCat REST API key. Used by /redeem-promo to grant
// promotional entitlements via the RC API. Set with:
//   firebase functions:secrets:set REVENUECAT_REST_API_KEY
const revenuecatRestApiKey = defineSecret("REVENUECAT_REST_API_KEY");

// Shared admin token: gates the /admin/* push endpoints. The Vercel
// admin web project sends this in the Authorization header when
// invoking server actions like "Send broadcast" or "Send test push".
// Set with:
//   firebase functions:secrets:set ADMIN_API_TOKEN
const adminApiToken = defineSecret("ADMIN_API_TOKEN");

// Anthropic Claude API key. Read by routes/ai.ts (deal-discovery
// helpers) and routes/destination-info.ts (AI-generated destination
// guides on the deal-detail destination tab). Without this binding,
// the routes return HTTP 500 and the mobile client silently falls
// back to placeholder content. Set with:
//   firebase functions:secrets:set ANTHROPIC_API_KEY
const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY");

// Slack incoming webhook for the #support channel. Read by
// routes/support.ts when a user submits the in-app Contact Support
// form. Without this binding the route 500s and the user's message
// is dropped silently.
//   firebase functions:secrets:set SLACK_SUPPORT_WEBHOOK_URL
const slackSupportWebhookUrl = defineSecret("SLACK_SUPPORT_WEBHOOK_URL");

// Meta Conversions API access token. Read by lib/ad-conversions.ts to
// fire server-side purchase / signup events to Meta for ad attribution.
// Set with:
//   firebase functions:secrets:set META_CAPI_ACCESS_TOKEN
const metaCapiAccessToken = defineSecret("META_CAPI_ACCESS_TOKEN");

// Slack incoming webhook for the revenue channel. Read by
// routes/revenuecat-webhook.ts to post a rich (name + email + tier +
// pricing) notification on each RevenueCat event. This runs ALONGSIDE
// RevenueCat's own native Slack integration — both can be on at once.
// Without this binding the route just skips the post (logged WARNING).
// Set with:
//   firebase functions:secrets:set SLACK_REVENUE_WEBHOOK_URL
const slackRevenueWebhookUrl = defineSecret("SLACK_REVENUE_WEBHOOK_URL");

// Klaviyo email platform. Read by lib/klaviyo.ts to push lifecycle events +
// profiles (so Klaviyo Flows can target users). The RC webhook (this function)
// fires trial/purchase events; the signup trigger fires "Signed Up". Without
// KLAVIYO_PRIVATE_API_KEY the calls no-op. KLAVIYO_LIST_ID is the marketing
// list new users are subscribed to (single opt-in). Set with:
//   firebase functions:secrets:set KLAVIYO_PRIVATE_API_KEY
//   firebase functions:secrets:set KLAVIYO_LIST_ID
const klaviyoPrivateApiKey = defineSecret("KLAVIYO_PRIVATE_API_KEY");
const klaviyoListId = defineSecret("KLAVIYO_LIST_ID");

/**
 * Prod API. Wraps the Express app in `runWithEnv("prod", …)` so every
 * Firestore read/write inside the request handler resolves to the
 * unprefixed (prod) collection names via `colRef`.
 */
export const api = onRequest(
  {
    invoker: "public",
    secrets: [revenuecatWebhookSecret, revenuecatRestApiKey, adminApiToken, anthropicApiKey, slackSupportWebhookUrl, metaCapiAccessToken, slackRevenueWebhookUrl, klaviyoPrivateApiKey, klaviyoListId],
    // Default is 60s — too short for /destination-info, which calls
    // Anthropic to generate ~4000 tokens of structured JSON and
    // routinely takes 60-90s. The route's own AbortController caps
    // at 280s so we always log + return cleanly under this limit
    // rather than letting Cloud Run kill mid-request.
    timeoutSeconds: 300,
  },
  (req, res) => runWithEnv("prod", () => app(req, res))
);

/**
 * Staging API. Same code, same secrets, but runs every request in
 * `runWithEnv("staging", …)` — so Firestore writes land in
 * `staging_*` collections. Cloud Run exposes this at a distinct URL
 * (something like `https://apistaging-<hash>-uc.a.run.app`); the mobile
 * client picks it up via the env-aware API_BASE_URL in `lib/constants.ts`.
 *
 * Staging shares all prod secrets so RC promo grants and admin push
 * still work end-to-end. Per decision 2, RC is effectively unused in
 * staging for v1 (the mobile client stubs IAP when env=staging), but
 * if a webhook ever did fire against staging it'd land here and be
 * processed correctly.
 */
export const apiStaging = onRequest(
  {
    invoker: "public",
    secrets: [revenuecatWebhookSecret, revenuecatRestApiKey, adminApiToken, anthropicApiKey, slackSupportWebhookUrl, metaCapiAccessToken, slackRevenueWebhookUrl, klaviyoPrivateApiKey, klaviyoListId],
    // Default is 60s — too short for /destination-info, which calls
    // Anthropic to generate ~4000 tokens of structured JSON and
    // routinely takes 60-90s. The route's own AbortController caps
    // at 280s so we always log + return cleanly under this limit
    // rather than letting Cloud Run kill mid-request.
    timeoutSeconds: 300,
  },
  (req, res) => runWithEnv("staging", () => app(req, res))
);

// Firestore trigger: posts a Slack notification on each new signup.
// Staging counterpart fires on `staging_userProfiles/{id}` and
// intentionally skips Slack (decision 5).
export {
  onUserProfileCreated,
  onStagingUserProfileCreated,
} from "./triggers/user-signup";

// Firestore trigger: forwards `app_open` analytics events to Klaviyo as
// an "App Opened" event, so Day 2 / Day 7 re-engagement Flows have a
// "time since last activity" signal to key off of.
export { onAppOpened, onStagingAppOpened } from "./triggers/app-opened";

// Cron: fires welcome / trial-ending / inactivity push notifications
// once per day. Each trigger is gated on its template being enabled,
// so Trevor can switch any of them on/off without a deploy.
//
// The staging variant (`dailyStagingNotificationTriggers`) is gated on
// `ENABLE_STAGING_CRON=1` and exports as `null` otherwise — kept this
// way so toggling staging cron is a single env-var flip, no code change.
export {
  dailyNotificationTriggers,
  dailyStagingNotificationTriggers,
} from "./triggers/notification-cron";
