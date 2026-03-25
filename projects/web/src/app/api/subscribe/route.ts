import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getDb } from "@/lib/firebase-admin";

const PRICE_IDS: Record<string, string> = {
  premium: "price_1SqPVwCn0fbGrA2SXHg4miAV",
  business: "price_1TEvltCn0fbGrA2SH3vhzfXi",
};

export async function POST(req: NextRequest) {
  try {
    const { paymentMethodId, email, name, plan } = await req.json();

    if (!paymentMethodId || !email || !plan) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const priceId = PRICE_IDS[plan];
    if (!priceId) {
      return NextResponse.json(
        { error: "Invalid plan" },
        { status: 400 },
      );
    }

    const stripe = getStripe();

    // 1. Create a Stripe Customer
    const customer = await stripe.customers.create({
      email,
      name: name || undefined,
      payment_method: paymentMethodId,
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    // 2. Run a $1 authorization hold to verify the card
    const authIntent = await stripe.paymentIntents.create({
      amount: 100,
      currency: "usd",
      customer: customer.id,
      payment_method: paymentMethodId,
      capture_method: "manual",
      confirm: true,
      automatic_payment_methods: { enabled: true, allow_redirects: "never" },
    });

    if (authIntent.status !== "requires_capture") {
      return NextResponse.json(
        { error: "Card verification failed. Please check your card details." },
        { status: 400 },
      );
    }

    // 3. Cancel the auth hold (releases the $1 — no actual charge)
    await stripe.paymentIntents.cancel(authIntent.id);

    // 4. Create the subscription with a 3-day free trial
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId }],
      trial_period_days: 3,
      default_payment_method: paymentMethodId,
      metadata: { plan },
    });

    // 5. Update Firestore user profile directly
    const subscriptionStatus = plan === "business" ? "business" : "premium";
    const trialEndDate = subscription.trial_end
      ? new Date(subscription.trial_end * 1000)
      : null;
    const currentPeriodEnd = subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000)
      : null;

    const snapshot = await getDb()
      .collection("userProfiles")
      .where("email", "==", email)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      await snapshot.docs[0].ref.update({
        subscriptionStatus,
        trialEndDate,
        stripeCustomerId: customer.id,
        stripeSubscriptionId: subscription.id,
        stripeSubscriptionStatus: subscription.status,
        stripePriceId: priceId,
        stripeCurrentPeriodEnd: currentPeriodEnd,
      });
    }

    return NextResponse.json({ success: true, plan });
  } catch (error: unknown) {
    console.error("Error creating subscription:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create subscription";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
