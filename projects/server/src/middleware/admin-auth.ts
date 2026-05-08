import { Request, Response, NextFunction } from "express";

/**
 * Admin-only auth: checks `Authorization: Bearer <ADMIN_API_TOKEN>`.
 *
 * The token is a shared secret stored in Firebase Secret Manager and
 * also in Vercel env (the admin web project uses it when calling these
 * endpoints from server-side actions). Different from
 * REVENUECAT_WEBHOOK_SECRET (which is RC-specific) and from the
 * dashboard cookie (which is end-user-facing).
 *
 * Fails closed if the secret isn't configured.
 */
export function adminAuth(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.ADMIN_API_TOKEN;
  if (!expected) {
    res.status(503).json({ error: "Admin API not configured" });
    return;
  }
  const auth = req.headers.authorization ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  if (token !== expected) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}
