import { Router } from "express";
import express from "express";
import Stripe from "stripe";
import { db } from "../firebase";

let _stripe: Stripe;
function getStripe() {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    _stripe = new Stripe(key, { apiVersion: "2025-02-24.acacia" });
  }
  return _stripe;
}

export const stripeWebhookRoutes = Router();

// Raw body parser for webhook signature verification
stripeWebhookRoutes.post(
  "/",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    if (!sig) {
      res.status(400).json({ error: "Missing stripe-signature header" });
      return;
    }

    const stripe = getStripe();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      res.status(400).json({ error: "Invalid signature" });
      return;
    }

    try {
      switch (event.type) {
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

      res.json({ received: true });
    } catch (error) {
      console.error("Error handling webhook event:", error);
      res.status(500).json({ error: "Webhook handler failed" });
    }
  },
);

async function getProfileByCustomerEmail(email: string) {
  const snapshot = await db
    .collection("userProfiles")
    .where("email", "==", email)
    .limit(1)
    .get();
  return snapshot.empty ? null : snapshot.docs[0];
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const customer = (await getStripe().customers.retrieve(
    subscription.customer as string,
  )) as Stripe.Customer;
  if (!customer.email) return;

  const profileDoc = await getProfileByCustomerEmail(customer.email);
  if (!profileDoc) return;

  const status = subscription.status;
  let subscriptionStatus: string;

  if (status === "active" || status === "trialing") {
    subscriptionStatus = status === "trialing" ? "trial" : "premium";
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
  const customer = (await getStripe().customers.retrieve(
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

  // Ensure profile is marked as premium after successful payment
  const currentStatus = profileDoc.data().subscriptionStatus;
  if (currentStatus !== "premium" && currentStatus !== "business") {
    await profileDoc.ref.update({ subscriptionStatus: "premium" });
  }
}
