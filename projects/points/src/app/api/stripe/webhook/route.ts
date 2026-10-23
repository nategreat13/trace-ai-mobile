import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/server/email";
import { emailForCustomer, recordSubscription } from "@/lib/server/members";
import { sendMetaEvent } from "@/lib/server/meta";
import { postSlack } from "@/lib/server/slack";
import { stripe, verifyWebhook } from "@/lib/server/stripe";

type Plan = "annual" | "monthly";

interface Subscription {
  id: string;
  customer: string;
  status: string;
  trial_end: number | null;
  metadata?: { plan?: Plan };
}

interface CheckoutSession {
  id: string;
  customer: string;
  subscription: string | null;
  customer_details: { email: string | null } | null;
  customer_email: string | null;
  metadata?: { plan?: Plan; fbp?: string; fbc?: string };
}

interface StripeEvent {
  id: string;
  type: string;
  data: { object: Subscription & CheckoutSession };
}

/**
 * Stripe → Trace. Point a Stripe webhook at /api/stripe/webhook with the
 * events handled below and set STRIPE_WEBHOOK_SECRET. Membership in
 * Firestore follows the subscription: on during the trial and while paid,
 * off when it's canceled or unpaid.
 */
export async function POST(req: Request) {
  const payload = await req.text();
  if (!(await verifyWebhook(payload, req.headers.get("stripe-signature")))) {
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }
  const event = JSON.parse(payload) as StripeEvent;
  const obj = event.data.object;

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        // Covers buyers who close the tab before the success page loads.
        if (!obj.subscription) break;
        const email = (obj.customer_details?.email ?? obj.customer_email ?? "").toLowerCase();
        const sub = await stripe<Subscription>("GET", `/subscriptions/${obj.subscription}`);
        const plan = obj.metadata?.plan ?? sub.metadata?.plan ?? "annual";
        if (email) await recordSubscription({ email, plan, status: sub.status, trialEnd: sub.trial_end, customer: obj.customer, subscription: sub.id });
        // Same event id as the browser's StartTrial, so Meta counts it once.
        await sendMetaEvent({ name: "StartTrial", eventId: obj.id, email, fbp: obj.metadata?.fbp, fbc: obj.metadata?.fbc, value: plan === "annual" ? 99 : 12 });
        await postSlack(`:airplane: New Trace Points trial: ${email || obj.customer} (${plan})`);
        break;
      }
      case "customer.subscription.trial_will_end": {
        // Set "Trial ending events" to 2 days in Stripe so this matches the
        // reminder promised at checkout.
        const email = await emailForCustomer(obj.customer);
        if (!email) break;
        const plan = obj.metadata?.plan ?? "annual";
        const ends = new Date((obj.trial_end ?? Date.now() / 1000) * 1000).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "America/Denver" });
        const price = plan === "annual" ? "$99 for the year" : "$12 for the month";
        const sent = await sendEmail(
          email,
          `Your Trace Points trial ends ${ends}`,
          `Hi,\n\nYour free week of Trace Points ends on ${ends}. If you keep it, your card is charged ${price} that day.\n\nNot for you? Cancel in two taps before then: open Trace Points, go to Account, and tap Cancel free trial. You won't be charged.\n\nThanks for trying Trace.\n`,
        );
        if (!sent) await postSlack(`:alarm_clock: Send a trial reminder by hand: ${email}'s trial ends ${ends} (${plan}). Email isn't connected yet.`);
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const email = await emailForCustomer(obj.customer);
        if (!email) {
          console.warn("[stripe] no Points member for customer", obj.customer, event.type);
          break;
        }
        const status = event.type === "customer.subscription.deleted" ? "canceled" : obj.status;
        await recordSubscription({ email, plan: obj.metadata?.plan ?? "annual", status, trialEnd: obj.trial_end, customer: obj.customer, subscription: obj.id });
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
