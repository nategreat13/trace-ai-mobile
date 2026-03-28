import express from "express";
import cors from "cors";
import { dealRoutes } from "./routes/deals";
import { aiRoutes } from "./routes/ai";
// TODO: uncomment when Stripe keys are configured
// import { stripeRoutes } from "./routes/stripe";
// import { stripeWebhookRoutes } from "./routes/stripe-webhook";
// import { subscriptionRoutes } from "./routes/subscription";

export const app = express();

// TODO: uncomment when Stripe keys are configured
// app.use("/stripe/webhook", stripeWebhookRoutes);

app.use(cors({ origin: true }));
app.use(express.json());

app.use(dealRoutes);
app.use(aiRoutes);
// TODO: uncomment when Stripe keys are configured
// app.use(stripeRoutes);
// app.use(subscriptionRoutes);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});
