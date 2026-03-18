import { Router } from "express";
import Stripe from "stripe";
import { authenticate, AuthenticatedRequest } from "../middleware/authenticate";
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

export const stripeRoutes = Router();

stripeRoutes.get("/stripe/publishable-key", (_req, res) => {
  res.json({ publishableKey: process.env.STRIPE_PUBLISHABLE_KEY });
});

stripeRoutes.post(
  "/stripe/create-checkout",
  authenticate,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { priceId, successUrl, cancelUrl } = req.body;
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        client_reference_id: req.user!.uid,
        customer_email: req.user!.email,
      });
      res.json({ sessionId: session.id, url: session.url });
    } catch (error) {
      console.error("Error creating checkout session:", error);
      res.status(500).json({ error: "Failed to create checkout session" });
    }
  },
);

stripeRoutes.post(
  "/stripe/create-subscription",
  authenticate,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { paymentMethodId, priceId, trialDays } = req.body;

      const stripe = getStripe();
      // Find or create Stripe customer
      const customers = await stripe.customers.list({
        email: req.user!.email,
        limit: 1,
      });
      let customer: Stripe.Customer;
      if (customers.data.length > 0) {
        customer = customers.data[0];
      } else {
        customer = await stripe.customers.create({
          email: req.user!.email,
          metadata: { firebaseUid: req.user!.uid },
        });
      }

      // Attach payment method
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customer.id,
      });
      await stripe.customers.update(customer.id, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });

      // Create subscription
      const subscriptionParams: Stripe.SubscriptionCreateParams = {
        customer: customer.id,
        items: [{ price: priceId }],
        expand: ["latest_invoice.payment_intent"],
      };
      if (trialDays) {
        subscriptionParams.trial_period_days = trialDays;
      }

      const subscription = await stripe.subscriptions.create(subscriptionParams);
      res.json({
        subscriptionId: subscription.id,
        status: subscription.status,
        clientSecret:
          subscription.status === "active"
            ? null
            : (
                (subscription.latest_invoice as Stripe.Invoice)
                  .payment_intent as Stripe.PaymentIntent
              ).client_secret,
      });
    } catch (error) {
      console.error("Error creating subscription:", error);
      res.status(500).json({ error: "Failed to create subscription" });
    }
  },
);

stripeRoutes.post(
  "/stripe/create-payment-intent",
  authenticate,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { amount, currency = "usd", plan } = req.body;

      const stripe = getStripe();
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency,
        metadata: {
          firebaseUid: req.user!.uid,
          plan,
        },
      });

      res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error) {
      console.error("Error creating payment intent:", error);
      res.status(500).json({ error: "Failed to create payment intent" });
    }
  },
);

stripeRoutes.post(
  "/stripe/confirm-payment",
  authenticate,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { plan } = req.body;
      const email = req.user!.email;

      if (!email) {
        res.status(400).json({ error: "User email not found" });
        return;
      }

      // Find user profile by email
      const profilesRef = db.collection("userProfiles");
      const snapshot = await profilesRef
        .where("email", "==", email)
        .limit(1)
        .get();

      if (snapshot.empty) {
        res.status(404).json({ error: "User profile not found" });
        return;
      }

      const profileDoc = snapshot.docs[0];
      const updateData: Record<string, unknown> = {
        subscriptionStatus: plan === "business" ? "business" : "premium",
      };

      if (plan === "trial") {
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + 30);
        updateData.subscriptionStatus = "trial";
        updateData.trialEndDate = trialEnd;
      }

      await profileDoc.ref.update(updateData);
      res.json({ success: true, subscriptionStatus: updateData.subscriptionStatus });
    } catch (error) {
      console.error("Error confirming payment:", error);
      res.status(500).json({ error: "Failed to confirm payment" });
    }
  },
);
