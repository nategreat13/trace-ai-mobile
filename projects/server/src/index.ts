import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { app } from "./app";

// Declared so the value is injected into process.env at runtime. The
// RevenueCat webhook handler reads process.env.REVENUECAT_WEBHOOK_SECRET
// and rejects requests whose Authorization header doesn't match.
const revenuecatWebhookSecret = defineSecret("REVENUECAT_WEBHOOK_SECRET");

export const api = onRequest(
  { invoker: "public", secrets: [revenuecatWebhookSecret] },
  app
);
