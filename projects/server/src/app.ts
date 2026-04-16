import express from "express";
import cors from "cors";
import { dealRoutes } from "./routes/deals";
import { aiRoutes } from "./routes/ai";
import { revenuecatWebhookRoutes } from "./routes/revenuecat-webhook";

export const app = express();

app.use(cors({ origin: true }));
app.use(express.json());

app.use(dealRoutes);
app.use(aiRoutes);
app.use(revenuecatWebhookRoutes);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});
