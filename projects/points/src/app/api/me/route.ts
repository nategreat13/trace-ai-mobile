import { NextResponse } from "next/server";
import { getUser, saveState } from "@/lib/server/members";
import { clearSession, sessionEmail } from "@/lib/server/session";
import { pickSynced, type MeResponse } from "@/lib/sync";

const MAX_BYTES = 200_000;

/** The signed-in member: email, membership (from Stripe) and synced state. Signed out: email null. */
export async function GET() {
  const email = await sessionEmail();
  if (!email) return NextResponse.json({ email: null, member: null, state: null });
  const user = await getUser(email);
  const body: MeResponse = { email, verified: !!user?.verified, member: user?.member ?? null, state: user?.state ?? null };
  return NextResponse.json(body);
}

/** Saves the synced part of the client's state. Membership is never taken from the client. */
export async function PUT(req: Request) {
  const email = await sessionEmail();
  if (!email) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const raw = await req.text();
  if (raw.length > MAX_BYTES) return NextResponse.json({ error: "Too large" }, { status: 413 });
  let state;
  try {
    state = pickSynced((JSON.parse(raw) as { state?: object }).state ?? {});
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  // The account email is the signed-in one, whatever the client says.
  await saveState(email, { ...state, email });
  return NextResponse.json({ ok: true });
}

/** Signs out on this device. */
export async function DELETE() {
  await clearSession();
  return NextResponse.json({ ok: true });
}
