import { NextResponse } from "next/server";
import { verifiedEmailFromIdToken } from "@/lib/server/firebase";
import { ensureUser, markVerified, mergeAccount } from "@/lib/server/members";
import { sessionEmail, setSession } from "@/lib/server/session";
import { stripe, stripeEnabled } from "@/lib/server/stripe";

/**
 * Finishes a Google or email-link sign-in: the client sends the Firebase ID
 * token, we confirm the email is verified, and start a Points session for
 * it. If this device was signed in from checkout under a different email,
 * the membership moves to the one they just proved they own, and Stripe's
 * receipts follow it there.
 */
export async function POST(req: Request) {
  const { idToken } = (await req.json().catch(() => ({}))) as { idToken?: string };
  const email = idToken ? await verifiedEmailFromIdToken(idToken) : null;
  if (!email) return NextResponse.json({ error: "That sign-in didn't work. Try again." }, { status: 401 });

  const current = await sessionEmail();
  let moved = false;
  if (current && current !== email) {
    const customer = await mergeAccount(current, email);
    moved = !!customer;
    if (customer && stripeEnabled()) {
      await stripe("POST", `/customers/${customer}`, { email }).catch((e) => console.error("[session] Stripe email update failed", e));
    }
  }
  await ensureUser(email);
  await markVerified(email);
  await setSession(email);
  return NextResponse.json({ ok: true, email, moved });
}
