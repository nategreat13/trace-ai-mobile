import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { app } from "./app";

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

export const api = onRequest(
  {
    invoker: "public",
    secrets: [revenuecatWebhookSecret, revenuecatRestApiKey, adminApiToken, anthropicApiKey],
  },
  app
);

// Firestore trigger: posts a Slack notification on each new signup.
export { onUserProfileCreated } from "./triggers/user-signup";

// Cron: fires welcome / trial-ending / inactivity push notifications
// once per day. Each trigger is gated on its template being enabled,
// so Trevor can switch any of them on/off without a deploy.
export { dailyNotificationTriggers } from "./triggers/notification-cron";
