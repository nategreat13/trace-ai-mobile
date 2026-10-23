import { NextResponse } from "next/server";
import { priceFor, stripe, stripeEnabled } from "@/lib/server/stripe";

const TRIAL_DAYS = 7;

/** Tells the client whether real payments are on. */
export async function GET() {
  return NextResponse.json({ mode: stripeEnabled() ? "stripe" : "test" });
}

/**
 * Creates a Stripe Checkout session for a subscription with a 7-day trial.
 * The card is collected now and charged when the trial ends unless the user
 * cancels. Without Stripe keys, tells the client to run in test mode.
 */
export async function POST(req: Request) {
  if (!stripeEnabled()) return NextResponse.json({ mode: "test" });
  const { plan, email } = (await req.json()) as { plan?: "annual" | "monthly"; email?: string };
  if (plan !== "annual" && plan !== "monthly") return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
  const price = priceFor(plan);
  if (!price) return NextResponse.json({ error: `No Stripe price set for the ${plan} plan` }, { status: 500 });

  const origin = new URL(req.url).origin;
  try {
    const session = await stripe<{ url: string }>("POST", "/checkout/sessions", {
      mode: "subscription",
      "line_items[0][price]": price,
      "line_items[0][quantity]": 1,
      "subscription_data[trial_period_days]": TRIAL_DAYS,
      // If no card ends up on file, cancel rather than bill at trial end.
      "subscription_data[trial_settings][end_behavior][missing_payment_method]": "cancel",
      "subscription_data[metadata][plan]": plan,
      "metadata[plan]": plan,
      customer_email: email || undefined,
      allow_promotion_codes: true,
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout?canceled=1`,
    });
    return NextResponse.json({ mode: "stripe", url: session.url });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
