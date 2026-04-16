import { Router } from "express";
import { getDb } from "../firebase";

export const revenuecatWebhookRoutes = Router();

/**
 * Map a RevenueCat product ID to our Firestore subscription status.
 */
function productToStatus(productId: string): "premium" | "business" | null {
  if (productId.includes("business")) return "business";
  if (productId.includes("premium")) return "premium";
  return null;
}

revenuecatWebhookRoutes.post("/revenuecat-webhook", async (req, res) => {
  try {
    // Verify Authorization header
    const authHeader = req.headers.authorization;
    const expectedAuth = process.env.REVENUECAT_WEBHOOK_SECRET;
    if (expectedAuth && authHeader !== expectedAuth) {
      console.error("[RC Webhook] Invalid authorization header");
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const event = req.body;
    const { type, app_user_id, product_id, expiration_at_ms } = event.event || {};

    console.log("[RC Webhook] Event:", type, "User:", app_user_id, "Product:", product_id);

    if (!app_user_id) {
      console.warn("[RC Webhook] No app_user_id in event");
      res.status(200).json({ ok: true });
      return;
    }

    const db = getDb();

    // Find the user's profile document by userId field
    const profileQuery = await db
      .collection("userProfiles")
      .where("userId", "==", app_user_id)
      .limit(1)
      .get();

    if (profileQuery.empty) {
      console.warn("[RC Webhook] No profile found for user:", app_user_id);
      res.status(200).json({ ok: true });
      return;
    }

    const profileDoc = profileQuery.docs[0];
    const profileRef = profileDoc.ref;

    switch (type) {
      case "INITIAL_PURCHASE":
      case "RENEWAL":
      case "UNCANCELLATION":
      case "PRODUCT_CHANGE": {
        const status = productToStatus(product_id || "");
        if (!status) {
          console.warn("[RC Webhook] Unknown product:", product_id);
          break;
        }

        const updates: Record<string, any> = {
          subscriptionStatus: status,
        };

        if (expiration_at_ms) {
          updates.trialEndDate = new Date(expiration_at_ms);
        }

        await profileRef.update(updates);
        console.log("[RC Webhook] Updated profile to:", status);
        break;
      }

      case "CANCELLATION":
      case "EXPIRATION": {
        await profileRef.update({
          subscriptionStatus: "free",
          trialEndDate: null,
        });
        console.log("[RC Webhook] Reset profile to free");
        break;
      }

      case "BILLING_ISSUE": {
        // Leave active — RC will retry and send RENEWAL or EXPIRATION later
        console.log("[RC Webhook] Billing issue for user:", app_user_id);
        break;
      }

      default: {
        console.log("[RC Webhook] Unhandled event type:", type);
      }
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error("[RC Webhook] Error processing webhook:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
