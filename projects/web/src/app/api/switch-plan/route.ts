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

    // Retrieve the current subscription to find the item to swap
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

    const isTrial = subscription.status === "trialing";

    // Swap the price — skip proration during trial since no billing has occurred
    const updated = await stripe.subscriptions.update(subscriptionId, {
      items: [{ id: currentItem.id, price: newPriceId }],
      proration_behavior: isTrial ? "none" : "create_prorations",
      metadata: { plan },
      // If the sub was set to cancel at period end, undo that
      cancel_at_period_end: false,
    });

    const subscriptionStatus = plan === "business" ? "business" : "premium";
    const currentPeriodEnd = updated.current_period_end
      ? new Date(updated.current_period_end * 1000)
      : null;

    await snapshot.docs[0].ref.update({
      subscriptionStatus,
      stripeSubscriptionId: updated.id,
      stripeSubscriptionStatus: updated.status,
      stripePriceId: newPriceId,
      stripeCurrentPeriodEnd: currentPeriodEnd,
      stripeCancelAtPeriodEnd: false,
    });

    return NextResponse.json({ success: true, plan });
  } catch (error: unknown) {
    console.error("Error switching plan:", error);
    const message =
      error instanceof Error ? error.message : "Failed to switch plan";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
