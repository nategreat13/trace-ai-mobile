import { NextResponse } from "next/server";
import { stripe, stripeEnabled } from "@/lib/server/stripe";

interface Session {
  status: string;
  customer: string;
  metadata: { plan?: "annual" | "monthly" };
  subscription: { id: string; status: string; trial_end: number | null } | null;
}

/** Confirms a Checkout session really completed before the client unlocks anything. */
export async function GET(req: Request) {
  if (!stripeEnabled()) return NextResponse.json({ ok: false, error: "Stripe is not configured" }, { status: 400 });
  const id = new URL(req.url).searchParams.get("session_id");
  if (!id) return NextResponse.json({ ok: false, error: "Missing session" }, { status: 400 });
  try {
    const s = await stripe<Session>("GET", `/checkout/sessions/${encodeURIComponent(id)}`, { "expand[]": "subscription" });
    const sub = s.subscription;
    if (s.status !== "complete" || !sub || !["trialing", "active"].includes(sub.status)) {
      return NextResponse.json({ ok: false, error: "Checkout isn't complete" }, { status: 402 });
    }
    return NextResponse.json({
      ok: true,
      plan: s.metadata.plan ?? "annual",
      trialEndsAt: new Date((sub.trial_end ?? Date.now() / 1000) * 1000).toISOString(),
      customer: s.customer,
      subscription: sub.id,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
