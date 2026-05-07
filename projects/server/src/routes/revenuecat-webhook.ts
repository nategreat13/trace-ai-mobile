import { Router } from "express";
import * as admin from "firebase-admin";
import { getDb } from "../firebase";
import { fanOutConversion } from "../lib/ad-conversions";

export const revenuecatWebhookRoutes = Router();

type Tier = "premium" | "business";

/**
 * Mirror of the client-side `logEvent` helper. Writes to the same `events`
 * collection so the analytics dashboard can query lifecycle events
 * (renewals, cancellations, expirations, billing issues) alongside the
 * client-side funnel events. Fire-and-forget — never throw.
 */
async function logAnalyticsEvent(
  name: string,
  userId: string,
  props: Record<string, unknown>
): Promise<void> {
  // Strip undefined so Firestore doesn't reject the doc
  const cleanProps: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) {
    if (v !== undefined) cleanProps[k] = v;
  }
  try {
    await getDb().collection("events").add({
      name,
      userId,
      props: cleanProps,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      source: "revenuecat_webhook",
    });
  } catch (err) {
    console.warn("[RC Webhook] Failed to log analytics event:", name, err);
  }
}

/**
 * Derive the user's effective tier from an RC event's `entitlement_ids` array.
 * Business wins over Premium if both are present.
 * Returns null if no known entitlements are active.
 */
function tierFromEntitlements(entitlementIds: unknown): Tier | null {
  if (!Array.isArray(entitlementIds)) return null;
  if (entitlementIds.includes("business")) return "business";
  if (entitlementIds.includes("premium")) return "premium";
  return null;
}

/**
 * Fallback: derive tier from a product ID string using naming convention.
 * Used only when `entitlement_ids` is missing.
 */
function tierFromProductId(productId: unknown): Tier | null {
  if (typeof productId !== "string") return null;
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

    const payload = req.body;
    const ev = payload.event || {};
    const {
      type,
      app_user_id,
      product_id,
      new_product_id,
      entitlement_ids,
      expiration_at_ms,
      price_in_purchased_currency,
      currency,
      period_type,
    } = ev;

    console.log(
      "[RC Webhook] Event:",
      type,
      "User:",
      app_user_id,
      "Product:",
      product_id,
      "New product:",
      new_product_id,
      "Entitlements:",
      entitlement_ids
    );

    if (!app_user_id) {
      console.warn("[RC Webhook] No app_user_id in event");
      res.status(200).json({ ok: true });
      return;
    }

    const db = getDb();

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

    // Common props for every analytics event we emit from this webhook
    const baseEventProps = {
      tier: tierFromEntitlements(entitlement_ids) ?? tierFromProductId(product_id),
      product_id: product_id ?? null,
      price: typeof price_in_purchased_currency === "number" ? price_in_purchased_currency : null,
      currency: currency ?? null,
      expiration_at_ms: expiration_at_ms ?? null,
      period_type: period_type ?? null,
    };

    switch (type) {
      case "INITIAL_PURCHASE":
      case "RENEWAL":
      case "UNCANCELLATION": {
        // Source of truth: entitlement_ids from RC. Fall back to product_id
        // naming convention only if entitlement_ids is missing.
        const tier =
          tierFromEntitlements(entitlement_ids) ??
          tierFromProductId(product_id);
        if (!tier) {
          console.warn(
            "[RC Webhook] Could not resolve tier for event",
            type,
            { entitlement_ids, product_id }
          );
          break;
        }

        const updates: Record<string, any> = {
          subscriptionStatus: tier,
          // Real purchase / renewal / uncancellation = store-sourced.
          // The /redeem-promo endpoint sets "promo" when a promo grant
          // is the winning tier; this overwrites it correctly when a
          // real purchase later supersedes a promo.
          subscriptionSource: "store",
        };
        if (expiration_at_ms) {
          updates.trialEndDate = new Date(expiration_at_ms);
        }

        // Mirror revenue + purchase timestamps to the userProfile so per-user
        // dashboards can compute LTV / time-to-paid without scanning RC.
        const now = new Date();
        const priceCents =
          typeof price_in_purchased_currency === "number"
            ? Math.round(price_in_purchased_currency * 100)
            : 0;
        const profileData = profileDoc.data() as {
          firstPurchaseAt?: any;
          lifetimeRevenueCents?: number;
          everUsedFreeTrial?: boolean;
        };
        if (type === "INITIAL_PURCHASE" && !profileData.firstPurchaseAt) {
          updates.firstPurchaseAt = now;
        }
        if (type === "INITIAL_PURCHASE" || type === "RENEWAL") {
          updates.lastPurchaseAt = now;
          if (priceCents > 0) {
            // Use FieldValue.increment so concurrent renewals don't clobber
            // each other (rare but possible).
            updates.lifetimeRevenueCents =
              admin.firestore.FieldValue.increment(priceCents);
          }
        }
        if (period_type === "TRIAL" && !profileData.everUsedFreeTrial) {
          updates.everUsedFreeTrial = true;
        }

        await profileRef.update(updates);
        console.log("[RC Webhook] Updated profile to:", tier);

        // Fire ad platform conversions for INITIAL_PURCHASE (new sub).
        // RENEWAL is excluded — those are not acquisition events.
        if (type === "INITIAL_PURCHASE") {
          const isTrial = period_type === "TRIAL";
          const email = (profileDoc.data() as { email?: string }).email ?? null;
          void fanOutConversion({
            kind: isTrial ? "start_trial" : "purchase",
            userId: app_user_id,
            email,
            amountUsd:
              typeof price_in_purchased_currency === "number"
                ? price_in_purchased_currency
                : undefined,
            currency: currency ?? "USD",
            productId: product_id ?? undefined,
          });
        }

        // Analytics
        if (type === "INITIAL_PURCHASE") {
          const isTrial = period_type === "TRIAL";
          await logAnalyticsEvent(
            isTrial ? "trial_started_server" : "subscription_started",
            app_user_id,
            { ...baseEventProps, tier }
          );
        } else if (type === "RENEWAL") {
          await logAnalyticsEvent("subscription_renewed", app_user_id, {
            ...baseEventProps,
            tier,
          });
        } else {
          await logAnalyticsEvent("subscription_uncanceled", app_user_id, {
            ...baseEventProps,
            tier,
          });
        }
        break;
      }

      case "NON_RENEWING_PURCHASE": {
        // RC fires this for promotional entitlements granted via the API
        // (e.g. our /redeem-promo endpoint). Same effect on subscription
        // status as INITIAL_PURCHASE — but we skip ad conversion fanout
        // (these aren't real acquisitions) and log a separate analytics
        // event so promos are distinguishable from real purchases.
        const tier =
          tierFromEntitlements(entitlement_ids) ??
          tierFromProductId(product_id);
        if (!tier) {
          console.warn(
            "[RC Webhook] Could not resolve tier for NON_RENEWING_PURCHASE",
            { entitlement_ids, product_id }
          );
          break;
        }
        const updates: Record<string, any> = {
          subscriptionStatus: tier,
          subscriptionSource: "promo",
        };
        if (expiration_at_ms) {
          updates.trialEndDate = new Date(expiration_at_ms);
        }
        await profileRef.update(updates);
        console.log("[RC Webhook] NON_RENEWING_PURCHASE applied:", tier);

        await logAnalyticsEvent("subscription_started_promo", app_user_id, {
          ...baseEventProps,
          tier,
        });
        break;
      }

      case "PRODUCT_CHANGE": {
        // For tier upgrades (e.g. Premium → Business), the change takes
        // effect immediately and entitlement_ids reflects the new tier.
        // For tier downgrades or billing-period changes that Apple queues
        // until period end, the user still has their existing entitlement.
        // In both cases, entitlement_ids is the correct source of truth.
        // Fall back to new_product_id (the product being switched TO) if
        // entitlements are missing, NOT product_id (the old product).
        const tier =
          tierFromEntitlements(entitlement_ids) ??
          tierFromProductId(new_product_id) ??
          tierFromProductId(product_id);
        if (!tier) {
          console.warn(
            "[RC Webhook] Could not resolve tier for PRODUCT_CHANGE",
            { entitlement_ids, product_id, new_product_id }
          );
          break;
        }

        const updates: Record<string, any> = {
          subscriptionStatus: tier,
          subscriptionSource: "store",
        };
        if (expiration_at_ms) {
          updates.trialEndDate = new Date(expiration_at_ms);
        }
        await profileRef.update(updates);
        console.log("[RC Webhook] PRODUCT_CHANGE applied:", tier);

        await logAnalyticsEvent("subscription_changed", app_user_id, {
          ...baseEventProps,
          tier,
          from_product: product_id ?? null,
          to_product: new_product_id ?? null,
        });
        break;
      }

      case "CANCELLATION": {
        // User turned off auto-renew but access continues until expiration.
        // Do NOT flip to free yet — just log for observability.
        console.log(
          "[RC Webhook] User cancelled (access continues until expiration):",
          app_user_id
        );
        await logAnalyticsEvent("subscription_canceled", app_user_id, baseEventProps);
        break;
      }

      case "EXPIRATION": {
        await profileRef.update({
          subscriptionStatus: "free",
          subscriptionSource: null,
          trialEndDate: null,
        });
        console.log("[RC Webhook] Subscription expired, reset to free");
        await logAnalyticsEvent("subscription_expired", app_user_id, baseEventProps);
        break;
      }

      case "BILLING_ISSUE": {
        // Leave active — RC will retry and send RENEWAL or EXPIRATION later
        console.log("[RC Webhook] Billing issue for user:", app_user_id);
        await logAnalyticsEvent("billing_issue", app_user_id, baseEventProps);
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
