import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  try {
    const { plan, email } = await req.json();

    const priceId =
      plan === "business"
        ? process.env.STRIPE_BUSINESS_PRICE_ID
        : process.env.STRIPE_PREMIUM_PRICE_ID;

    if (!priceId) {
      return NextResponse.json(
        { error: "Price ID not configured" },
        { status: 500 },
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_URL || "http://localhost:3000";
    const stripe = getStripe();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 3,
        metadata: { plan },
      },
      ...(email ? { customer_email: email } : {}),
      success_url: `${baseUrl}/success?plan=${plan}`,
      cancel_url: `${baseUrl}/subscribe?plan=${plan}`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 },
    );
  }
}
