import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getDb } from "@/lib/firebase-admin";

const PRICE_IDS: Record<string, string> = {
  premium: "price_1TEy9QCn0fbGrA2SEgEcCSGc",
  business: "price_1TEy9cCn0fbGrA2ShzSH4WMR",
};

export async function POST(req: NextRequest) {
  try {
    const { email, plan } = await req.json();

    if (!email || !plan) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const newPriceId = PRICE_IDS[plan];
    if (!newPriceId) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const snapshot = await getDb()
      .collection("userProfiles")
      .where("email", "==", email)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const profile = snapshot.docs[0].data();
    const subscriptionId = profile.stripeSubscriptionId;

    if (!subscriptionId) {
      return NextResponse.json(
        { error: "No active subscription found" },
        { status: 400 },
      );
    }

    const stripe = getStripe();
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const currentItem = subscription.items.data[0];

    if (!currentItem) {
      return NextResponse.json(
        { error: "No subscription item found" },
        { status: 400 },
      );
    }

    if (currentItem.price.id === newPriceId) {
      return NextResponse.json(
        { error: "Already on this plan" },
        { status: 400 },
      );
    }

    // Preview the proration with an upcoming invoice
    const invoice = await stripe.invoices.createPreview({
      customer: subscription.customer as string,
      subscription: subscriptionId,
      subscription_details: {
        items: [{ id: currentItem.id, price: newPriceId }],
        proration_behavior: "create_prorations",
      },
    });

    // amount_due is in cents
    const amountDue = invoice.amount_due;
    const credit = amountDue < 0 ? Math.abs(amountDue) : 0;
    const charge = amountDue > 0 ? amountDue : 0;

    return NextResponse.json({
      amountDue,
      charge,
      credit,
      currentPlan: profile.subscriptionStatus,
      periodEnd: subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null,
    });
  } catch (error: unknown) {
    console.error("Error previewing switch:", error);
    const message =
      error instanceof Error ? error.message : "Failed to preview plan change";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
