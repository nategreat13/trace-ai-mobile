import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { getDb } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 },
    );
  }

  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

  let event: Stripe.Event;
  try {
    const body = await req.text();
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(subscription);
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentSucceeded(invoice);
        break;
      }
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Error handling webhook event:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 },
    );
  }
}

async function getProfileByCustomerEmail(email: string) {
  const snapshot = await getDb()
    .collection("userProfiles")
    .where("email", "==", email)
    .limit(1)
    .get();
  return snapshot.empty ? null : snapshot.docs[0];
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const email = session.customer_email;
  if (!email) return;

  // Retrieve subscription metadata for plan info
  let subscriptionPlan: string | undefined;
  if (!subscriptionPlan && session.subscription) {
    const stripe = getStripe();
    const subscription = await stripe.subscriptions.retrieve(
      session.subscription as string,
    );
    subscriptionPlan = subscription.metadata?.plan;
  }

  const profileDoc = await getProfileByCustomerEmail(email);
  if (!profileDoc) return;

  const subscriptionStatus =
    subscriptionPlan === "business" ? "business" : "premium";

  await profileDoc.ref.update({ subscriptionStatus });

  // TODO: send to Drip
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const stripe = getStripe();
  const customer = (await stripe.customers.retrieve(
    subscription.customer as string,
  )) as Stripe.Customer;
  if (!customer.email) return;

  const profileDoc = await getProfileByCustomerEmail(customer.email);
  if (!profileDoc) return;

  const status = subscription.status;
  const plan = subscription.metadata?.plan;

  let subscriptionStatus: string;
  if (status === "active") {
    subscriptionStatus = plan === "business" ? "business" : "premium";
  } else if (status === "trialing") {
    subscriptionStatus = plan === "business" ? "business" : "premium";
  } else {
    subscriptionStatus = "free";
  }

  await profileDoc.ref.update({
    subscriptionStatus,
    ...(subscription.trial_end
      ? { trialEndDate: new Date(subscription.trial_end * 1000) }
      : {}),
  });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const stripe = getStripe();
  const customer = (await stripe.customers.retrieve(
    subscription.customer as string,
  )) as Stripe.Customer;
  if (!customer.email) return;

  const profileDoc = await getProfileByCustomerEmail(customer.email);
  if (!profileDoc) return;

  await profileDoc.ref.update({
    subscriptionStatus: "free",
    trialEndDate: null,
  });
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  if (!invoice.customer_email) return;

  const profileDoc = await getProfileByCustomerEmail(invoice.customer_email);
  if (!profileDoc) return;

  const currentStatus = profileDoc.data().subscriptionStatus;
  if (currentStatus !== "premium" && currentStatus !== "business") {
    await profileDoc.ref.update({ subscriptionStatus: "premium" });
  }
}
