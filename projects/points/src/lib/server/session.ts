import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { normalizeEmail } from "./firebase";

/**
 * Points sign-in session: an HMAC-signed, httpOnly cookie holding the
 * member's email. Set after a verified Stripe checkout (new accounts only) or
 * after an email-link sign-in. Signed with POINTS_SESSION_SECRET.
 */
const COOKIE = "tp_session";
const MAX_AGE = 60 * 60 * 24 * 180;

function secret(): string {
  const s = process.env.POINTS_SESSION_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new Error("POINTS_SESSION_SECRET is not set");
  return "dev-only-points-session-secret";
}

const sign = (body: string) => createHmac("sha256", secret()).update(body).digest("base64url");

export async function setSession(email: string) {
  const body = Buffer.from(JSON.stringify({ e: normalizeEmail(email), x: Date.now() + MAX_AGE * 1000 })).toString("base64url");
  (await cookies()).set(COOKIE, `${body}.${sign(body)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSession() {
  (await cookies()).delete(COOKIE);
}

/** The signed-in email, or null. */
export async function sessionEmail(): Promise<string | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [body, mac] = raw.split(".");
  if (!body || !mac) return null;
  const want = Buffer.from(sign(body));
  const got = Buffer.from(mac);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const { e, x } = JSON.parse(Buffer.from(body, "base64url").toString()) as { e: string; x: number };
    return x > Date.now() ? e : null;
  } catch {
    return null;
  }
}
