import { NextResponse } from "next/server";
import { getUser, recordSubscription } from "@/lib/server/members";
import { sessionEmail, setSession } from "@/lib/server/session";
import { stripe, stripeEnabled } from "@/lib/server/stripe";

interface Session {
  status: string;
  customer: string;
  customer_email: string | null;
  customer_details: { email: string | null } | null;
  metadata: { plan?: "annual" | "monthly" };
  subscription: { id: string; status: string; trial_end: number | null } | null;
}

/**
 * Confirms a Checkout session really completed before the client unlocks
 * anything, records the membership, and signs the buyer in on this device
 * when that's safe: a brand-new account, or one already signed in here. An
 * existing account with saved data needs the email link instead, so paying
 * with someone else's email never opens their saved trips.
 */
export async function GET(req: Request) {
  if (!stripeEnabled()) return NextResponse.json({ ok: false, error: "Stripe is not configured" }, { status: 400 });
  const id = new URL(req.url).searchParams.get("session_id");
  if (!id) return NextResponse.json({ ok: false, error: "Missing session" }, { status: 400 });
  try {
    const s = await stripe<Session>("GET", `/checkout/sessions/${encodeURIComponent(id)}`, { "expand[]": "subscription" });
    const sub = s.subscription;
    if (s.status !== "complete" || !sub || !["trialing", "active"].includes(sub.status)) {
      return NextResponse.json({ ok: false, error: "Checkout isn't complete" }, { status: 402 });
    }
    const email = (s.customer_details?.email ?? s.customer_email ?? "").toLowerCase();
    const plan = s.metadata.plan ?? "annual";

    let signedIn = false;
    if (email) {
      const before = await getUser(email);
      await recordSubscription({ email, plan, status: sub.status, trialEnd: sub.trial_end, customer: s.customer, subscription: sub.id });
      const current = await sessionEmail();
      if (current === email || !before?.state) {
        await setSession(email);
        signedIn = true;
      }
    }

    return NextResponse.json({
      ok: true,
      plan,
      trialEndsAt: new Date((sub.trial_end ?? Date.now() / 1000) * 1000).toISOString(),
      customer: s.customer,
      subscription: sub.id,
      status: sub.status,
      email,
      signedIn,
    });
  } catch (e) {
    console.error("[checkout/verify]", e);
    return NextResponse.json({ ok: false, error: "We couldn't confirm your checkout yet. Refresh in a moment." }, { status: 502 });
  }
}
