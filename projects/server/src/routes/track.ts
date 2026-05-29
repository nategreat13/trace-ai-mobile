import { Router, Response } from "express";
import { fanOutConversion } from "../lib/ad-conversions";
import { authenticate, AuthenticatedRequest } from "../middleware/authenticate";

export const trackRoutes = Router();

/**
 * POST /track-signup
 *
 * Fired by the mobile app immediately after Firebase Auth completes
 * (sign-in OR sign-up — see notes below). The server takes that signal
 * and forwards a `CompleteRegistration` event to Meta CAPI with the
 * user's hashed identifiers AND the request's plain client IP +
 * user-agent — which is the highest-leverage matching signal we have
 * without the Meta Mobile SDK installed.
 *
 * Why fire from a CLIENT call instead of a Firebase Auth trigger:
 *   - We get the real client IP from `req.ip` — trigger-driven events
 *     run on Cloud Run with no request context, so IP is unavailable
 *     there. IP alone typically lifts Meta's match rate by 10-15%.
 *   - The mobile client knows whether this is a sign-up (new user) vs
 *     sign-in (returning user), so we can fire on signup only.
 *   - The v2 Cloud Functions SDK only exposes Auth triggers via
 *     `beforeUserCreated`, which requires Firebase Identity Platform
 *     (paid tier). This avoids that dependency entirely.
 *
 * Auth: Bearer token (the Firebase ID token from the just-created user).
 * The client should pass the same token it just got from
 * `getIdToken()`. We verify it matches the userId in the body — any
 * mismatch is rejected. Prevents random third parties from poisoning
 * Meta CAPI with fake signup events.
 *
 * Body:
 *   { userId: string,                  // required, must match token
 *     email?: string | null,           // best-effort; usually present
 *     firstName?: string | null,
 *     lastName?: string | null,
 *     country?: string | null }        // ISO 3166 alpha-2, e.g. "US"
 *
 * Response: { ok: true } on success. fanOutConversion swallows ad-platform
 * errors internally so this endpoint never fails for that reason.
 */
trackRoutes.post(
  "/track-signup",
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    const { userId, email, firstName, lastName, country } = req.body ?? {};

    if (!userId || typeof userId !== "string") {
      res.status(400).json({ error: "userId required" });
      return;
    }
    // Token-userId mismatch protection — see comment above.
    if (req.user?.uid !== userId) {
      res.status(403).json({ error: "userId does not match token" });
      return;
    }

    // Extract client IP. `req.ip` respects Express's `trust proxy` setting;
    // on Cloud Run that's normally true so we get the original client IP
    // from x-forwarded-for, not the proxy's. Fallback to the raw header.
    const clientIp =
      req.ip ||
      (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
      null;
    const clientUserAgent =
      (req.headers["user-agent"] as string | undefined) || null;

    // Awaited — not void'd. The handler must wait for the fetch to Meta to
    // resolve, otherwise Cloud Run throttles CPU once the response is sent
    // and the fetch hangs mid-flight. fanOutConversion swallows all errors,
    // so awaiting is safe.
    await fanOutConversion({
      kind: "sign_up",
      userId,
      email: typeof email === "string" ? email : null,
      firstName: typeof firstName === "string" ? firstName : null,
      lastName: typeof lastName === "string" ? lastName : null,
      country: typeof country === "string" ? country : null,
      clientIp,
      clientUserAgent,
    });

    res.json({ ok: true });
  }
);
