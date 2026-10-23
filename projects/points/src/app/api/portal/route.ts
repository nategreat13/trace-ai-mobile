import { NextResponse } from "next/server";
import { stripe, stripeEnabled } from "@/lib/server/stripe";

/** Stripe's hosted customer portal: update card, switch plan, or cancel in two taps. */
export async function POST(req: Request) {
  if (!stripeEnabled()) return NextResponse.json({ mode: "test" });
  const { customer } = (await req.json()) as { customer?: string };
  if (!customer) return NextResponse.json({ error: "Missing customer" }, { status: 400 });
  try {
    const s = await stripe<{ url: string }>("POST", "/billing_portal/sessions", {
      customer,
      return_url: `${new URL(req.url).origin}/account`,
    });
    return NextResponse.json({ url: s.url });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
