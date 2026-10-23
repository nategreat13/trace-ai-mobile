"use client";

import { track } from "./analytics";
import type { Membership } from "./store";

/**
 * Payments, one place. With Stripe keys on the server, checkout goes to
 * Stripe Checkout (card, Apple Pay, Google Pay) with a 7-day trial; without
 * them, everything runs in test mode on the device. Pages never talk to
 * Stripe directly.
 */

export const TRIAL_DAYS = 7;
/** The trial-ending reminder goes out this many days before billing starts. */
export const REMINDER_DAYS_BEFORE = 2;

export type Plan = Membership["plan"];

export async function paymentsMode(): Promise<"stripe" | "test"> {
  try {
    const r = await fetch("/api/checkout", { method: "GET" });
    const j = (await r.json()) as { mode: "stripe" | "test" };
    return j.mode;
  } catch {
    return "test";
  }
}

/** Starts checkout. Stripe mode redirects away; test mode returns the new membership. */
export async function startCheckout(plan: Plan, email: string): Promise<Membership | null> {
  const r = await fetch("/api/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ plan, email }),
  });
  const j = (await r.json()) as { mode: "stripe"; url: string } | { mode: "test" } | { error: string };
  if ("error" in j) throw new Error(j.error);
  if (j.mode === "stripe") {
    window.location.assign(j.url);
    return null;
  }
  const now = new Date();
  const m: Membership = {
    plan,
    startedAt: now.toISOString(),
    trialEndsAt: new Date(now.getTime() + TRIAL_DAYS * 86400000).toISOString(),
    testMode: true,
  };
  onTrialStarted(m);
  return m;
}

/** Confirms a finished Stripe Checkout and turns it into a membership. */
export async function verifyCheckout(sessionId: string): Promise<Membership> {
  const r = await fetch(`/api/checkout/verify?session_id=${encodeURIComponent(sessionId)}`);
  const j = (await r.json()) as
    | { ok: true; plan: Plan; trialEndsAt: string; customer: string; subscription: string }
    | { ok: false; error: string };
  if (!j.ok) throw new Error(j.error);
  const m: Membership = {
    plan: j.plan,
    startedAt: new Date().toISOString(),
    trialEndsAt: j.trialEndsAt,
    testMode: false,
    stripeCustomerId: j.customer,
    stripeSubscriptionId: j.subscription,
  };
  onTrialStarted(m);
  return m;
}

/** Opens Stripe's customer portal (2-tap cancel). Returns false in test mode. */
export async function openBillingPortal(customer: string | undefined): Promise<boolean> {
  if (!customer) return false;
  const r = await fetch("/api/portal", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ customer }),
  });
  const j = (await r.json()) as { url?: string };
  if (!j.url) return false;
  window.location.assign(j.url);
  return true;
}

/**
 * Everything that should happen the moment a trial starts, in one spot:
 * analytics (mapped to Meta's StartTrial). The trial-reminder email and
 * welcome email hook in here once email is connected; the Stripe webhook
 * covers the server side.
 */
function onTrialStarted(m: Membership) {
  track("trial_started", { plan: m.plan, test_mode: m.testMode, trial_ends: m.trialEndsAt });
}
