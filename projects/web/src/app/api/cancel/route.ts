import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getDb } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: "Missing email" },
        { status: 400 },
      );
    }

    const snapshot = await getDb()
      .collection("userProfiles")
      .where("email", "==", email)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 },
      );
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

    // Cancel at period end so user keeps access until billing cycle ends
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });

    await snapshot.docs[0].ref.update({
      stripeSubscriptionStatus: subscription.status,
      stripeCancelAtPeriodEnd: true,
    });

    return NextResponse.json({
      success: true,
      cancelAt: subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null,
    });
  } catch (error: unknown) {
    console.error("Error cancelling subscription:", error);
    const message =
      error instanceof Error ? error.message : "Failed to cancel subscription";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
