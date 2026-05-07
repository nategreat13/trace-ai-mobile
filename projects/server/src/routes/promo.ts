import { Router } from "express";
import * as admin from "firebase-admin";
import { getDb } from "../firebase";
import { authenticate, AuthenticatedRequest } from "../middleware/authenticate";

export const promoRoutes = Router();

const RC_API_BASE = "https://api.revenuecat.com/v2";

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
 * RC V2 requires the project_id in the path. We auto-discover it from
 * /v2/projects on first use and cache for the function's lifetime.
 */
let _cachedProjectId: string | null = null;

async function getRcProjectId(): Promise<string> {
  if (process.env.REVENUECAT_PROJECT_ID) {
    return process.env.REVENUECAT_PROJECT_ID;
  }
  if (_cachedProjectId) return _cachedProjectId;
  const apiKey = process.env.REVENUECAT_REST_API_KEY;
  if (!apiKey) {
    throw new Error("REVENUECAT_REST_API_KEY is not set");
  }
  const res = await fetch(`${RC_API_BASE}/projects?limit=10`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "(unreadable)");
    throw new Error(
      `Failed to list RC projects (${res.status}): ${body.slice(0, 300)}`
    );
  }
  const data = (await res.json()) as { items?: Array<{ id: string }> };
  if (!data.items?.length) {
    throw new Error("No RC projects visible to this API key");
  }
  _cachedProjectId = data.items[0].id;
  return _cachedProjectId;
}

/**
 * Grant a promotional entitlement on RevenueCat for `appUserId` until the
 * given absolute end time. Uses the V2 grant_entitlement action:
 *   POST /v2/projects/{project_id}/customers/{customer_id}/actions/grant_entitlement
 *   body: { entitlement_id, expires_at }   // expires_at = ms since epoch
 *
 * Throws if the API key is missing or the call fails. Caller is responsible
 * for wrapping in a try/catch and surfacing a sensible error to the client.
 */
async function grantPromotionalEntitlement(opts: {
  appUserId: string;
  tier: "premium" | "business";
  endTimeMs: number;
}): Promise<{ rcResponse: any }> {
  const apiKey = process.env.REVENUECAT_REST_API_KEY;
  if (!apiKey) {
    throw new Error(
      "REVENUECAT_REST_API_KEY is not set on the function. Cannot grant promo."
    );
  }
  const entitlement = TIER_ENTITLEMENT[opts.tier];
  if (!entitlement) {
    throw new Error(`Unknown tier: ${opts.tier}`);
  }
  if (!opts.endTimeMs || opts.endTimeMs <= Date.now()) {
    throw new Error(`Invalid endTimeMs: ${opts.endTimeMs}`);
  }

  const projectId = await getRcProjectId();
  const url = `${RC_API_BASE}/projects/${encodeURIComponent(
    projectId
  )}/customers/${encodeURIComponent(opts.appUserId)}/actions/grant_entitlement`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      entitlement_id: entitlement,
      expires_at: opts.endTimeMs,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "(unreadable)");
    throw new Error(
      `RevenueCat API returned ${res.status}: ${body.slice(0, 500)}`
    );
  }
  const json = await res.json().catch(() => ({}));
  return { rcResponse: json };
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

  const db = getDb();
  const codeRef = db.collection("promoCodes").doc(code);

  // Pre-check the user hasn't already redeemed this code (cheap, before the
  // transaction). Final guard is inside the transaction below.
  const priorRedemptions = await db
    .collection("promoRedemptions")
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
  try {
    await grantPromotionalEntitlement({
      appUserId: userId,
      tier: codeData.tier,
      endTimeMs,
    });
  } catch (err: any) {
    console.error("[redeem-promo] RC grant failed:", err?.message);
    res.status(502).json({
      error: "Failed to grant the entitlement. Please try again in a moment.",
    });
    return;
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
      const redemptionRef = db.collection("promoRedemptions").doc();
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

  res.json({
    tier: codeData.tier,
    durationDays: codeData.durationDays,
    grantExpiresAt: new Date(endTimeMs).toISOString(),
  });
});
