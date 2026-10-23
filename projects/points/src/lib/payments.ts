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
export async function verifyCheckout(sessionId: string): Promise<{ member: Membership; email: string; signedIn: boolean }> {
  const r = await fetch(`/api/checkout/verify?session_id=${encodeURIComponent(sessionId)}`);
  const j = (await r.json()) as
    | { ok: true; plan: Plan; trialEndsAt: string; customer: string; subscription: string; status: string; email: string; signedIn: boolean }
    | { ok: false; error: string };
  if (!j.ok) throw new Error(j.error);
  const m: Membership = {
    plan: j.plan,
    startedAt: new Date().toISOString(),
    trialEndsAt: j.trialEndsAt,
    testMode: false,
    status: j.status,
    stripeCustomerId: j.customer,
    stripeSubscriptionId: j.subscription,
  };
  onTrialStarted(m, sessionId);
  return { member: m, email: j.email, signedIn: j.signedIn };
}

/**
 * Opens Stripe's customer portal (2-tap cancel) for the signed-in account.
 * Returns "test" in test mode, "signin" when they need to sign in first.
 */
export async function openBillingPortal(): Promise<"opened" | "test" | "signin" | "error"> {
  const r = await fetch("/api/portal", { method: "POST" });
  const j = (await r.json()) as { url?: string; mode?: "test"; signIn?: boolean };
  if (j.mode === "test") return "test";
  if (j.signIn) return "signin";
  if (!j.url) return "error";
  window.location.assign(j.url);
  return "opened";
}

/**
 * Everything that should happen the moment a trial starts, in one spot:
 * analytics (mapped to Meta's StartTrial). The eventId is the Checkout
 * session id, which the webhook also sends to Meta's Conversions API, so
 * Meta counts the trial once.
 */
function onTrialStarted(m: Membership, eventId?: string) {
  track("trial_started", { plan: m.plan, test_mode: m.testMode, trial_ends: m.trialEndsAt, value: m.plan === "annual" ? 99 : 12, currency: "USD" }, eventId);
}
