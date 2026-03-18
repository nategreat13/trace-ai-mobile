import { Router } from "express";
import { authenticate, AuthenticatedRequest } from "../middleware/authenticate";
import { db } from "../firebase";

export const subscriptionRoutes = Router();

async function getProfileByEmail(email: string) {
  const snapshot = await db
    .collection("userProfiles")
    .where("email", "==", email)
    .limit(1)
    .get();
  return snapshot.empty ? null : snapshot.docs[0];
}

subscriptionRoutes.post(
  "/subscription/upgrade-premium",
  authenticate,
  async (req: AuthenticatedRequest, res) => {
    try {
      const email = req.user!.email;
      if (!email) {
        res.status(400).json({ error: "User email not found" });
        return;
      }

      const profileDoc = await getProfileByEmail(email);
      if (!profileDoc) {
        res.status(404).json({ error: "User profile not found" });
        return;
      }

      await profileDoc.ref.update({ subscriptionStatus: "premium" });
      res.json({ success: true, subscriptionStatus: "premium" });
    } catch (error) {
      console.error("Error upgrading to premium:", error);
      res.status(500).json({ error: "Failed to upgrade" });
    }
  },
);

subscriptionRoutes.post(
  "/subscription/grant-premium",
  authenticate,
  async (req: AuthenticatedRequest, res) => {
    try {
      const email = req.user!.email;
      if (!email) {
        res.status(400).json({ error: "User email not found" });
        return;
      }

      const profileDoc = await getProfileByEmail(email);
      if (!profileDoc) {
        res.status(404).json({ error: "User profile not found" });
        return;
      }

      // Grant 1-year premium
      const premiumEnd = new Date();
      premiumEnd.setFullYear(premiumEnd.getFullYear() + 1);

      await profileDoc.ref.update({
        subscriptionStatus: "premium",
        trialEndDate: premiumEnd,
      });

      res.json({ success: true, subscriptionStatus: "premium", premiumEnd });
    } catch (error) {
      console.error("Error granting premium:", error);
      res.status(500).json({ error: "Failed to grant premium" });
    }
  },
);

subscriptionRoutes.post(
  "/subscription/upgrade-trial",
  authenticate,
  async (req: AuthenticatedRequest, res) => {
    try {
      const email = req.user!.email;
      if (!email) {
        res.status(400).json({ error: "User email not found" });
        return;
      }

      const profileDoc = await getProfileByEmail(email);
      if (!profileDoc) {
        res.status(404).json({ error: "User profile not found" });
        return;
      }

      // 30-day trial
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 30);

      await profileDoc.ref.update({
        subscriptionStatus: "trial",
        trialEndDate: trialEnd,
      });

      res.json({ success: true, subscriptionStatus: "trial", trialEnd });
    } catch (error) {
      console.error("Error upgrading to trial:", error);
      res.status(500).json({ error: "Failed to start trial" });
    }
  },
);
