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

export const api = onRequest(
  {
    invoker: "public",
    secrets: [revenuecatWebhookSecret, revenuecatRestApiKey],
  },
  app
);

// Firestore trigger: posts a Slack notification on each new signup.
export { onUserProfileCreated } from "./triggers/user-signup";
