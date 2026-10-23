import "server-only";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

/**
 * Points passwords, hashed with scrypt and stored on the pointsUsers doc.
 * Deliberately not Firebase email/password: that provider belongs to the
 * mobile app in the same Firebase project, so a Trace app password would
 * otherwise open Points too (see the note in firebase.ts).
 */
const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number, opts: { N: number; r: number; p: number; maxmem: number }) => Promise<Buffer>;
const N = 16384;
const PARAMS = { N, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const LEN = 32;

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 200;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, LEN, PARAMS);
  return `scrypt$${N}$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

/** True when `password` matches `stored`. With no stored hash it still does the work, so timing doesn't reveal which emails have passwords. */
export async function checkPassword(password: string, stored: string | undefined): Promise<boolean> {
  const [kind, n, salt, hash] = (stored ?? "").split("$");
  const ok = kind === "scrypt" && Number(n) === N && !!salt && !!hash;
  const want = ok ? Buffer.from(hash, "base64url") : randomBytes(LEN);
  const got = await scryptAsync(password, ok ? Buffer.from(salt, "base64url") : randomBytes(16), LEN, PARAMS);
  return ok && want.length === got.length && timingSafeEqual(want, got);
}
