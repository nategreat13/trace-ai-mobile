import { NextResponse } from "next/server";
import { priceFor, stripe, stripeEnabled } from "@/lib/server/stripe";

/** Yearly only; monthly is charged today. */
const TRIAL_DAYS = 3;

/** Tells the client whether real payments are on, and the publishable key for the card fields. */
export async function GET() {
  return NextResponse.json(
    stripeEnabled() ? { mode: "stripe", publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY } : { mode: "test" },
  );
}

interface Customer {
  id: string;
}
interface Subscription {
  id: string;
  status: string;
  default_payment_method: string | null;
  metadata?: Record<string, string>;
  pending_setup_intent: { client_secret: string } | null;
  latest_invoice: { confirmation_secret?: { client_secret: string } | null; payment_intent?: { client_secret: string } | null } | null;
}

/**
 * Starts the subscription for the card fields on /checkout. Yearly gets a
 * 3-day trial and returns its setup-intent secret ("setup"): the card is
 * saved and charged when the trial ends unless they cancel. Monthly has no
 * trial: it returns the first invoice's payment secret ("payment"), charged
 * when the browser confirms. Either way the browser confirms with Stripe
 * directly (card, Apple Pay, Google Pay), so card details never touch our
 * server, and the card becomes the subscription's default.
 */
export async function POST(req: Request) {
  if (!stripeEnabled()) return NextResponse.json({ mode: "test" });
  const { plan, email: rawEmail, offer } = (await req.json().catch(() => ({}))) as { plan?: string; email?: string; offer?: string };
  if (plan !== "annual" && plan !== "monthly") return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
  const email = (rawEmail ?? "").trim().toLowerCase();
  if (!/.+@.+\..+/.test(email)) return NextResponse.json({ error: "Add your email first." }, { status: 400 });
  const gift = plan === "annual" && offer === "gift";
  const price = priceFor(plan, gift ? "gift" : undefined);
  if (!price) return NextResponse.json({ error: `No Stripe price set for the ${gift ? "gift" : plan} plan` }, { status: 500 });

  // Meta's browser ids, so the server-side StartTrial matches the ad click.
  const cookie = req.headers.get("cookie") ?? "";
  const metaId = (name: string) => cookie.match(new RegExp(`(?:^|; )${name}=([^;]+)`))?.[1];

  try {
    const found = await stripe<{ data: Customer[] }>("GET", "/customers", { email, limit: 1 });
    const customer = found.data[0] ?? (await stripe<Customer>("POST", "/customers", { email, "metadata[source]": "points" }));

    // One live membership per customer. Earlier attempts that never got a card are cleared out.
    const subs = await stripe<{ data: Subscription[] }>("GET", "/subscriptions", { customer: customer.id, status: "all", limit: 20 });
    for (const s of subs.data) {
      if (!["trialing", "active", "past_due", "incomplete"].includes(s.status)) continue;
      if (s.default_payment_method) {
        return NextResponse.json({ error: "This email already has a membership. Sign in instead.", signIn: true }, { status: 409 });
      }
      if (s.metadata?.source === "points") await stripe("POST", `/subscriptions/${s.id}/cancel`);
    }

    const trial = plan === "annual";
    const base = {
      customer: customer.id,
      "items[0][price]": price,
      "payment_settings[save_default_payment_method]": "on_subscription",
      // Cards only (Apple Pay and Google Pay are cards), matching the card fields on /checkout.
      "payment_settings[payment_method_types][0]": "card",
      "metadata[source]": "points",
      "metadata[plan]": plan,
      "metadata[offer]": gift ? "gift" : undefined,
      "metadata[fbp]": metaId("_fbp"),
      "metadata[fbc]": metaId("_fbc"),
    };
    if (trial) {
      const sub = await stripe<Subscription>("POST", "/subscriptions", {
        ...base,
        trial_period_days: TRIAL_DAYS,
        // No card by the end of the trial: cancel rather than bill.
        "trial_settings[end_behavior][missing_payment_method]": "cancel",
        "expand[]": "pending_setup_intent",
      });
      if (!sub.pending_setup_intent) throw new Error("Stripe didn't return a setup intent");
      return NextResponse.json({ mode: "stripe", kind: "setup", clientSecret: sub.pending_setup_intent.client_secret, subscription: sub.id });
    }

    // Monthly: the first invoice waits for the card. Newer Stripe API versions
    // expose its secret as confirmation_secret, older ones on payment_intent;
    // an unknown expand is rejected before anything is created, so try both.
    const monthly = { ...base, payment_behavior: "default_incomplete" };
    let sub: Subscription;
    try {
      sub = await stripe<Subscription>("POST", "/subscriptions", { ...monthly, "expand[]": "latest_invoice.confirmation_secret" });
    } catch {
      sub = await stripe<Subscription>("POST", "/subscriptions", { ...monthly, "expand[]": "latest_invoice.payment_intent" });
    }
    const secret = sub.latest_invoice?.confirmation_secret?.client_secret ?? sub.latest_invoice?.payment_intent?.client_secret;
    if (!secret) throw new Error("Stripe didn't return a payment secret");
    return NextResponse.json({ mode: "stripe", kind: "payment", clientSecret: secret, subscription: sub.id });
  } catch (e) {
    console.error("[checkout]", e);
    return NextResponse.json({ error: "Checkout is unavailable right now. Try again in a minute." }, { status: 502 });
  }
}
