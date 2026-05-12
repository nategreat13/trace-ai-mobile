import express from "express";
import cors from "cors";
import { dealRoutes } from "./routes/deals";
import { aiRoutes } from "./routes/ai";
import { destinationInfoRoutes } from "./routes/destination-info";
import { revenuecatWebhookRoutes } from "./routes/revenuecat-webhook";
import { promoRoutes } from "./routes/promo";
import { adminPushRoutes } from "./routes/admin-push";
import { deleteAccountRoutes } from "./routes/delete-account";
import { shareRoutes } from "./routes/share";

export const app = express();

// Local-dev request logger. Gated on K_SERVICE because Cloud Run /
// Firebase Functions Gen 2 always set that env var, and it's never
// set locally — so this prints on `yarn dev1` but stays silent in
// production. Useful for verifying that `yarn dev2:local` is
// actually hitting your local server vs. production.
if (!process.env.K_SERVICE) {
  app.use((req, _res, next) => {
    console.log(`[dev-req] ${req.method} ${req.path}`);
    next();
  });
}

app.use(cors({ origin: true }));
app.use(express.json());

app.use(dealRoutes);
app.use(aiRoutes);
app.use(destinationInfoRoutes);
app.use(revenuecatWebhookRoutes);
app.use(promoRoutes);
app.use(adminPushRoutes);
app.use(deleteAccountRoutes);
app.use(shareRoutes);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});
