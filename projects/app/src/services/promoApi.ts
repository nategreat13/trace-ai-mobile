import { auth } from "./firebase";
import { API_BASE_URL } from "../lib/constants";

/**
 * Calls the server's /redeem-promo endpoint with the user's Firebase ID
 * token. The server validates the code, grants a RevenueCat promotional
 * entitlement, and returns the granted tier + duration. The webhook will
 * sync userProfile.subscriptionStatus shortly after.
 *
 * Throws an Error with a user-facing message on failure (the server
 * returns these intentionally; we surface them as-is).
 */
export interface RedeemPromoResult {
  tier: "premium" | "business";
  durationDays: number;
  grantExpiresAt: string;
}

export async function redeemPromoCode(code: string): Promise<RedeemPromoResult> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("You need to be signed in to redeem a code.");
  }
  const token = await user.getIdToken();

  const res = await fetch(`${API_BASE_URL}/redeem-promo`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ code }),
  });

  if (!res.ok) {
    let message = "Could not redeem this code.";
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      // ignore — fall back to generic message
    }
    throw new Error(message);
  }

  return (await res.json()) as RedeemPromoResult;
}
