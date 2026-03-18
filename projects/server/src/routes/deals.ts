import { Router } from "express";
import { authenticate, AuthenticatedRequest } from "../middleware/authenticate";

const DEALS_API_BASE =
  "https://us-central1-embarckstravel.cloudfunctions.net/api";
const DEALS_API_KEY = process.env.DEALS_API_KEY || "web-api-key";

export const dealRoutes = Router();

dealRoutes.get(
  "/deals/:airportCode",
  authenticate,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { airportCode } = req.params;
      const limit = req.query.limit || "500";
      const response = await fetch(
        `${DEALS_API_BASE}/deals/${airportCode}?limit=${limit}`,
        { headers: { "x-api-key": DEALS_API_KEY } },
      );
      if (!response.ok) {
        res.status(response.status).json({ error: "Failed to fetch deals" });
        return;
      }
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Error fetching deals:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

dealRoutes.get(
  "/premium-deals/:airportCode",
  authenticate,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { airportCode } = req.params;
      const response = await fetch(
        `${DEALS_API_BASE}/premium-deals/${airportCode}`,
        { headers: { "x-api-key": DEALS_API_KEY } },
      );
      if (!response.ok) {
        res
          .status(response.status)
          .json({ error: "Failed to fetch premium deals" });
        return;
      }
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Error fetching premium deals:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

dealRoutes.get(
  "/deal/:dealId",
  authenticate,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { dealId } = req.params;
      const response = await fetch(`${DEALS_API_BASE}/deal2/${dealId}`, {
        headers: { "x-api-key": DEALS_API_KEY },
      });
      if (!response.ok) {
        res
          .status(response.status)
          .json({ error: "Failed to fetch deal details" });
        return;
      }
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Error fetching deal:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);
