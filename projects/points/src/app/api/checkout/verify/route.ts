import { NextResponse } from "next/server";
import { getUser, recordSubscription } from "@/lib/server/members";
import { sendMetaEvent } from "@/lib/server/meta";
import { sessionEmail, setSession } from "@/lib/server/session";
import { postSlack } from "@/lib/server/slack";
import { stripe, stripeEnabled } from "@/lib/server/stripe";

interface Subscription {
  id: string;
  status: string;
  trial_end: number | null;
  customer: { id: string; email: string | null };
  default_payment_method: string | null;
  pending_setup_intent: { status: string } | null;
  metadata: { plan?: "annual" | "monthly"; offer?: string; fbp?: string; fbc?: string };
}

/**
 * Confirms the trial really has a card on it before the client unlocks
 * anything, records the membership, and signs the buyer in on this device
 * when that's safe: a brand-new account, or one already signed in here. An
 * existing account with saved data needs the email link instead, so paying
 * with someone else's email never opens their saved trips.
 */
export async function GET(req: Request) {
  if (!stripeEnabled()) return NextResponse.json({ ok: false, error: "Stripe is not configured" }, { status: 400 });
  const id = new URL(req.url).searchParams.get("subscription");
  if (!id?.startsWith("sub_")) return NextResponse.json({ ok: false, error: "Missing subscription" }, { status: 400 });
  try {
    const sub = await stripe<Subscription>("GET", `/subscriptions/${encodeURIComponent(id)}`, {
      "expand[0]": "customer",
      "expand[1]": "pending_setup_intent",
    });
    const carded = !!sub.default_payment_method || sub.pending_setup_intent?.status === "succeeded";
    if (!["trialing", "active"].includes(sub.status) || !carded) {
      return NextResponse.json({ ok: false, error: "Your card hasn't been confirmed yet." }, { status: 402 });
    }
    const email = (sub.customer.email ?? "").toLowerCase();
    const plan = sub.metadata.plan ?? "annual";

    let signedIn = false;
    if (email) {
      const before = await getUser(email);
      const firstTime = before?.stripeSubscriptionId !== sub.id;
      await recordSubscription({ email, plan, offer: sub.metadata.offer, status: sub.status, trialEnd: sub.trial_end, customer: sub.customer.id, subscription: sub.id });
      if (firstTime) {
        const value = plan === "monthly" ? 12 : sub.metadata.offer === "gift" ? 59.99 : 99;
        // Same event id as the browser's StartTrial, so Meta counts it once.
        await sendMetaEvent({ name: "StartTrial", eventId: sub.id, email, fbp: sub.metadata.fbp, fbc: sub.metadata.fbc, value });
        await postSlack(`:airplane: New Trace Points trial: ${email} (${plan}${sub.metadata.offer === "gift" ? ", $59.99 gift" : ""})`);
      }
      const current = await sessionEmail();
      if (current === email || !before?.state) {
        await setSession(email);
        signedIn = true;
      }
    }

    return NextResponse.json({
      ok: true,
      plan,
      offer: sub.metadata.offer,
      trialEndsAt: new Date((sub.trial_end ?? Date.now() / 1000) * 1000).toISOString(),
      customer: sub.customer.id,
      subscription: sub.id,
      status: sub.status,
      email,
      signedIn,
    });
  } catch (e) {
    console.error("[checkout/verify]", e);
    return NextResponse.json({ ok: false, error: "We couldn't confirm your trial yet. Refresh in a moment." }, { status: 502 });
  }
}
