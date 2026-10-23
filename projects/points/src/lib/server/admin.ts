import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * The /admin analytics login: one shared password (POINTS_ADMIN_PASSWORD),
 * then an HMAC-signed, httpOnly cookie for 30 days. Changing the password
 * signs everyone out. Locally the password is "dev"; in production the page
 * stays locked until the variable is set.
 */
const COOKIE = "tp_admin";
const MAX_AGE = 60 * 60 * 24 * 30;

export function adminPassword(): string | null {
  const p = process.env.POINTS_ADMIN_PASSWORD;
  if (p) return p;
  return process.env.NODE_ENV === "production" ? null : "dev";
}

function key(password: string): string {
  const s = process.env.POINTS_SESSION_SECRET ?? (process.env.NODE_ENV === "production" ? "" : "dev-only-points-session-secret");
  return `${s}:admin:${password}`;
}

const sign = (body: string, password: string) => createHmac("sha256", key(password)).update(body).digest("base64url");
const digest = (v: string) => createHash("sha256").update(v).digest();

/** Checks the password and, if it matches, sets the admin cookie. */
export async function adminSignIn(attempt: string): Promise<boolean> {
  const password = adminPassword();
  if (!password || !timingSafeEqual(digest(attempt), digest(password))) return false;
  const body = Buffer.from(JSON.stringify({ x: Date.now() + MAX_AGE * 1000 })).toString("base64url");
  (await cookies()).set(COOKIE, `${body}.${sign(body, password)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
  return true;
}

export async function adminSignOut() {
  (await cookies()).delete(COOKIE);
}

/** True when this browser has a valid admin cookie. */
export async function isAdmin(): Promise<boolean> {
  const password = adminPassword();
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!password || !raw) return false;
  const [body, mac] = raw.split(".");
  if (!body || !mac) return false;
  const want = Buffer.from(sign(body, password));
  const got = Buffer.from(mac);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return false;
  try {
    return (JSON.parse(Buffer.from(body, "base64url").toString()) as { x: number }).x > Date.now();
  } catch {
    return false;
  }
}
