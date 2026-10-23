import { NextResponse } from "next/server";
import { verifiedEmailFromIdToken } from "@/lib/server/firebase";
import { ensureUser } from "@/lib/server/members";
import { setSession } from "@/lib/server/session";

/**
 * Finishes an email-link sign-in: the client sends the Firebase ID token
 * from signInWithEmailLink, we confirm the email is verified, and start a
 * Points session for it.
 */
export async function POST(req: Request) {
  const { idToken } = (await req.json().catch(() => ({}))) as { idToken?: string };
  const email = idToken ? await verifiedEmailFromIdToken(idToken) : null;
  if (!email) return NextResponse.json({ error: "That sign-in link didn't work. Request a new one." }, { status: 401 });
  await ensureUser(email);
  await setSession(email);
  return NextResponse.json({ ok: true, email });
}
