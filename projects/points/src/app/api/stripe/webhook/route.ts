import { NextResponse } from "next/server";
import { verifyWebhook } from "@/lib/server/stripe";

interface StripeEvent {
  type: string;
  data: { object: { id: string; customer?: string; status?: string; trial_end?: number | null; metadata?: Record<string, string> } };
}

/**
 * Stripe → Trace. Point a Stripe webhook at /api/stripe/webhook and set
 * STRIPE_WEBHOOK_SECRET. Until there's a database these are logged; each case
 * marks where the real work goes.
 */
export async function POST(req: Request) {
  const payload = await req.text();
  if (!(await verifyWebhook(payload, req.headers.get("stripe-signature")))) {
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }
  const event = JSON.parse(payload) as StripeEvent;
  const sub = event.data.object;
  switch (event.type) {
    case "customer.subscription.created":
      // Trial started: save the member, send the welcome email, fire Meta CAPI StartTrial.
      console.info("[stripe] trial started", sub.id, sub.status, sub.metadata?.plan);
      break;
    case "customer.subscription.trial_will_end":
      // Stripe sends this 3 days before the trial ends: send the trial-ending reminder.
      console.info("[stripe] trial ending soon", sub.id, sub.trial_end);
      break;
    case "customer.subscription.updated":
      // Trial converted, plan switched, or canceled at period end.
      console.info("[stripe] subscription updated", sub.id, sub.status);
      break;
    case "customer.subscription.deleted":
      // Access ends: remove membership.
      console.info("[stripe] subscription ended", sub.id);
      break;
    case "invoice.payment_failed":
      console.info("[stripe] payment failed", sub.customer);
      break;
  }
  return NextResponse.json({ received: true });
}
