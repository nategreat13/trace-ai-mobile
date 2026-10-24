import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/server/email";
import { emailForCustomer, recordSubscription } from "@/lib/server/members";
import { postSlack } from "@/lib/server/slack";
import { stripe, verifyWebhook } from "@/lib/server/stripe";

interface Subscription {
  id: string;
  customer: string;
  status: string;
  trial_end: number | null;
  default_payment_method: string | null;
  metadata?: { plan?: "annual" | "monthly"; offer?: string; source?: string };
}

interface StripeEvent {
  id: string;
  type: string;
  data: { object: Subscription };
}

/**
 * Stripe → Trace. Point a Stripe webhook at /api/stripe/webhook with the
 * events handled below and set STRIPE_WEBHOOK_SECRET. Membership in
 * Firestore follows the subscription: on during the trial and while paid,
 * off when it's canceled or unpaid. Trials only count once a card is on
 * them; checkout starts the subscription before the card is confirmed.
 */
export async function POST(req: Request) {
  const payload = await req.text();
  if (!(await verifyWebhook(payload, req.headers.get("stripe-signature")))) {
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }
  const event = JSON.parse(payload) as StripeEvent;
  const sub = event.data.object;

  try {
    switch (event.type) {
      case "customer.subscription.trial_will_end": {
        // Stripe sends this 3 days before the trial ends (its default); with
        // the 3-day trial that's right after it starts.
        if (!sub.default_payment_method) break;
        const email = await emailForCustomer(sub.customer);
        if (!email) break;
        const ends = new Date((sub.trial_end ?? Date.now() / 1000) * 1000).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "America/Denver" });
        const price = sub.metadata?.offer === "gift" ? "$49.99 for the year" : "$64 for the year";
        const sent = await sendEmail(
          email,
          `Your Trace Points trial ends ${ends}`,
          `Hi,\n\nYour 3-day Trace Points trial ends on ${ends}. If you keep it, your card is charged ${price} that day.\n\nNot for you? Cancel in two taps before then: open Trace Points, go to Account, and tap Cancel free trial. You won't be charged.\n\nThanks for trying Trace.\n`,
        );
        if (!sent) await postSlack(`:alarm_clock: Send a trial reminder by hand: ${email}'s trial ends ${ends} (${price}). Email isn't connected yet.`);
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const deleted = event.type === "customer.subscription.deleted";
        // A subscription that never got a card is an abandoned checkout (or one
        // we cleared on a retry), not a member. Ignore it either way.
        if (!sub.default_payment_method) break;
        let email = await emailForCustomer(sub.customer);
        // Covers buyers who closed the tab before the success page confirmed.
        if (!email && !deleted && sub.metadata?.source === "points") {
          email = (await stripe<{ email: string | null }>("GET", `/customers/${sub.customer}`)).email?.toLowerCase() ?? null;
        }
        if (!email) break;
        await recordSubscription({
          email,
          plan: sub.metadata?.plan ?? "annual",
          offer: sub.metadata?.offer,
          status: deleted ? "canceled" : sub.status,
          trialEnd: sub.trial_end,
          customer: sub.customer,
          subscription: sub.id,
        });
        break;
      }
    }
  } catch (e) {
    // A 500 makes Stripe retry, which is what we want for a failed write.
    console.error("[stripe webhook]", event.type, event.id, e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
