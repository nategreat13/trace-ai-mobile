import { Router } from "express";
import * as admin from "firebase-admin";
import { colRef, getDb } from "../firebase";
import { getEnv } from "../env";
import { authenticate, AuthenticatedRequest } from "../middleware/authenticate";
import { grantPromotionalEntitlement } from "../lib/revenuecat-rest";
import { fanOutConversion } from "../lib/ad-conversions";

export const promoRoutes = Router();

/**
 * Tier → RevenueCat entitlement identifier. These are the public entitlement
 * names configured in the RC dashboard and should match the values used by
 * the iOS/Android products.
 */
const TIER_ENTITLEMENT: Record<string, string> = {
  premium: "premium",
  business: "business",
};

interface PromoCodeDoc {
  tier: "premium" | "business";
  durationDays: number;
  maxRedemptions: number | null;
  redemptionCount: number;
  expiresAt?: admin.firestore.Timestamp | null;
  active: boolean;
  note?: string | null;
}

/**
 * POST /redeem-promo
 * Body: { code: string }
 * Auth: Firebase ID token in Authorization header
 *
 * Validates a promo code, calls RC to grant the promotional entitlement,
 * and records the redemption. The RC webhook will update userProfile
 * subscription status shortly after the grant takes effect.
 */
promoRoutes.post("/redeem-promo", authenticate, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.uid;
  const email = req.user?.email ?? null;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const rawCode = (req.body?.code as string | undefined)?.trim();
  if (!rawCode) {
    res.status(400).json({ error: "Code is required" });
    return;
  }
  // Codes are stored uppercase; normalize on input.
  const code = rawCode.toUpperCase();

  // db is still needed for runTransaction below — transactions can't be
  // started off a CollectionReference, only off the Firestore instance.
  const db = getDb();
  const codeRef = colRef("promoCodes").doc(code);

  // Pre-check the user hasn't already redeemed this code (cheap, before the
  // transaction). Final guard is inside the transaction below.
  const priorRedemptions = await colRef("promoRedemptions")
    .where("code", "==", code)
    .where("userId", "==", userId)
    .limit(1)
    .get();
  if (!priorRedemptions.empty) {
    res.status(409).json({ error: "You've already redeemed this code." });
    return;
  }

  // Read code (outside transaction first, to get tier/durationDays for the
  // RC call). The atomic-counter increment happens in the transaction below.
  const codeSnap = await codeRef.get();
  if (!codeSnap.exists) {
    res.status(404).json({ error: "That code isn't valid." });
    return;
  }
  const codeData = codeSnap.data() as PromoCodeDoc;
  if (!codeData.active) {
    res.status(403).json({ error: "That code is no longer active." });
    return;
  }
  if (
    codeData.expiresAt &&
    codeData.expiresAt.toDate().getTime() < Date.now()
  ) {
    res.status(403).json({ error: "That code has expired." });
    return;
  }
  if (
    typeof codeData.maxRedemptions === "number" &&
    codeData.redemptionCount >= codeData.maxRedemptions
  ) {
    res.status(403).json({ error: "That code has been fully redeemed." });
    return;
  }
  if (!codeData.tier || !codeData.durationDays) {
    res.status(500).json({ error: "Code is misconfigured. Contact support." });
    return;
  }

  const endTimeMs = Date.now() + codeData.durationDays * 24 * 60 * 60 * 1000;

  // Grant the entitlement on RC FIRST, before incrementing the counter.
  // If RC fails, we don't burn a redemption slot. If the redemption write
  // fails after RC succeeds, the user has the entitlement and we'll
  // reconcile on the next webhook event (or via a manual cleanup).
  const entitlementId = TIER_ENTITLEMENT[codeData.tier];
  if (!entitlementId) {
    res.status(500).json({ error: "Unknown tier on code." });
    return;
  }

  // In staging we skip the live RC grant — RC is not exercised in staging
  // (IAP is stubbed on the client), and the only goal of a staging promo
  // redemption is to test the Firestore write + welcome-screen UI flow.
  // The direct userProfile write below is sufficient for that.
  if (getEnv() !== "staging") {
    try {
      await grantPromotionalEntitlement({
        appUserId: userId,
        entitlementId,
        endTimeMs,
      });
    } catch (err: any) {
      console.error("[redeem-promo] RC grant failed:", err?.message);
      res.status(502).json({
        error: "Failed to grant the entitlement. Please try again in a moment.",
      });
      return;
    }
  } else {
    console.log(
      `[redeem-promo] staging: skipping RC grant for ${userId}, entitlement=${entitlementId}`
    );
  }

  // Mirror the granted tier to the user's userProfile directly. RC's
  // webhook also handles this for "new" grants (NON_RENEWING_PURCHASE),
  // but RC stays silent when the user already has the entitlement
  // active (e.g. extending an existing promo or granting a tier they
  // already hold) — in that case the webhook never fires and the
  // profile would be stuck on whatever it was before. Writing directly
  // here makes the redemption self-contained and idempotent.
  //
  // We pick the *higher* tier between current and granted so a Premium
  // user redeeming a Business code goes to Business, but a Business
  // user redeeming a Premium code keeps Business (don't downgrade).
  try {
    const profileQuery = await colRef("userProfiles")
      .where("userId", "==", userId)
      .limit(1)
      .get();
    if (!profileQuery.empty) {
      const profileDoc = profileQuery.docs[0];
      const cur = profileDoc.data() as { subscriptionStatus?: string };
      const TIER_RANK: Record<string, number> = {
        free: 0,
        trial: 1,
        premium: 2,
        business: 3,
      };
      const curRank = TIER_RANK[cur.subscriptionStatus ?? "free"] ?? 0;
      const newRank = TIER_RANK[codeData.tier] ?? 0;
      const winningTier = newRank >= curRank ? codeData.tier : cur.subscriptionStatus;
      // Source flag: only mark as "promo" if the granted tier actually
      // wins — otherwise the user has a higher real subscription and we
      // shouldn't relabel them as a promo user.
      const updates: Record<string, any> = {
        subscriptionStatus: winningTier,
        trialEndDate: new Date(endTimeMs),
      };
      if (winningTier === codeData.tier) {
        updates.subscriptionSource = "promo";
      }
      await profileDoc.ref.update(updates);
    }
  } catch (err) {
    console.warn(
      `[redeem-promo] Profile mirror failed for ${userId} (RC grant succeeded). ` +
        `Webhook will reconcile if it fires:`,
      err
    );
  }

  // Now write the redemption record + bump the counter atomically. If the
  // counter check fails inside the transaction (because we hit the cap
  // between our pre-check and now), we still have an RC grant out there —
  // log it so it can be reconciled later. Edge case in practice.
  try {
    await db.runTransaction(async (tx) => {
      const fresh = await tx.get(codeRef);
      const cur = fresh.data() as PromoCodeDoc | undefined;
      if (
        cur &&
        typeof cur.maxRedemptions === "number" &&
        cur.redemptionCount >= cur.maxRedemptions
      ) {
        throw new Error("max_redemptions_hit");
      }
      tx.update(codeRef, {
        redemptionCount: admin.firestore.FieldValue.increment(1),
      });
      const redemptionRef = colRef("promoRedemptions").doc();
      tx.set(redemptionRef, {
        code,
        userId,
        email,
        tier: codeData.tier,
        durationDays: codeData.durationDays,
        redeemedAt: admin.firestore.FieldValue.serverTimestamp(),
        grantExpiresAt: new Date(endTimeMs),
      });
    });
  } catch (err: any) {
    if (err?.message === "max_redemptions_hit") {
      console.warn(
        `[redeem-promo] Race: code ${code} hit cap after RC grant for ${userId}. ` +
          `User has the entitlement; counter not incremented.`
      );
      // The user has the entitlement, so don't penalize them.
    } else {
      console.error("[redeem-promo] Transaction failed:", err);
      // Likewise, the RC grant succeeded; don't fail the user-visible
      // redemption. Logged so we can reconcile.
    }
  }

  // Fire ad platform conversion — $0 value since it's a promo, but Meta
  // still counts it as a conversion event for campaign optimization.
  // Awaited (not void'd) and placed before res.json: once the response
  // is sent, Cloud Run throttles CPU and an un-awaited fetch to Meta
  // stalls / never completes. fanOutConversion never throws.
  await fanOutConversion({
    kind: "purchase",
    userId,
    email,
    amountUsd: 0,
    currency: "USD",
    productId: `promo_${codeData.tier}`,
  });

  res.json({
    tier: codeData.tier,
    durationDays: codeData.durationDays,
    grantExpiresAt: new Date(endTimeMs).toISOString(),
  });
});
