import { NextResponse } from "next/server";
import { ensureUser, getUser, recordPasswordResult, setPasswordHash } from "@/lib/server/members";
import { normalizeEmail } from "@/lib/server/firebase";
import { checkPassword, hashPassword, PASSWORD_MAX, PASSWORD_MIN } from "@/lib/server/password";
import { sessionEmail, setSession } from "@/lib/server/session";

const NO_MATCH = "That email and password don't match.";

/**
 * Sets or changes the password on the signed-in account. Only a session can
 * do this (checkout's own new account, or a Google / email-link sign-in), so
 * typing someone else's email somewhere never lets you put a password on it.
 */
export async function PUT(req: Request) {
  const email = await sessionEmail();
  if (!email) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { password } = (await req.json().catch(() => ({}))) as { password?: unknown };
  if (typeof password !== "string" || password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
    return NextResponse.json({ error: `Use at least ${PASSWORD_MIN} characters.` }, { status: 400 });
  }
  await ensureUser(email);
  await setPasswordHash(email, await hashPassword(password));
  return NextResponse.json({ ok: true });
}

/** Signs in with email and password. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: unknown; password?: unknown };
  if (typeof body.email !== "string" || typeof body.password !== "string" || !body.password || body.password.length > PASSWORD_MAX) {
    return NextResponse.json({ error: NO_MATCH }, { status: 401 });
  }
  const email = normalizeEmail(body.email);
  const user = /.+@.+\..+/.test(email) ? await getUser(email) : null;
  if (user?.passwordLockedUntil && user.passwordLockedUntil > Date.now()) {
    return NextResponse.json({ error: "Too many tries. Wait 15 minutes, or use “Email me a sign-in link”." }, { status: 429 });
  }
  // Always hash, so a missing account takes as long as a wrong password.
  const ok = await checkPassword(body.password, user?.mergedInto ? undefined : user?.passwordHash);
  if (!user?.passwordHash || user.mergedInto) return NextResponse.json({ error: NO_MATCH }, { status: 401 });
  await recordPasswordResult(email, ok, user.passwordFails ?? 0);
  if (!ok) return NextResponse.json({ error: NO_MATCH }, { status: 401 });
  await setSession(email);
  return NextResponse.json({ ok: true, email });
}
