import { NextResponse } from "next/server";
import { getUser } from "@/lib/server/members";
import { sessionEmail } from "@/lib/server/session";
import { stripe, stripeEnabled } from "@/lib/server/stripe";

/**
 * Stripe's hosted customer portal: update card, switch plan, or cancel in
 * two taps. The customer comes from the signed-in account, never from the
 * request, so nobody can open someone else's billing.
 */
export async function POST(req: Request) {
  if (!stripeEnabled()) return NextResponse.json({ mode: "test" });
  const email = await sessionEmail();
  if (!email) return NextResponse.json({ error: "Sign in to manage billing", signIn: true }, { status: 401 });
  const customer = (await getUser(email))?.stripeCustomerId;
  if (!customer) return NextResponse.json({ error: "No subscription on this account" }, { status: 404 });
  try {
    const s = await stripe<{ url: string }>("POST", "/billing_portal/sessions", {
      customer,
      return_url: `${new URL(req.url).origin}/account`,
    });
    return NextResponse.json({ url: s.url });
  } catch (e) {
    console.error("[portal]", e);
    return NextResponse.json({ error: "Billing is unavailable right now. Try again in a minute." }, { status: 502 });
  }
}
