"use client";

import { track } from "./analytics";
import type { Membership } from "./store";

/**
 * Payments, one place. With Stripe keys, /checkout shows Stripe's own card,
 * Apple Pay and Google Pay fields on the page and starts a 7-day trial
 * subscription; without them, everything runs in test mode on the device.
 */

export const TRIAL_DAYS = 7;
/** The trial-ending reminder goes out this many days before billing starts. */
export const REMINDER_DAYS_BEFORE = 2;

export type Plan = Membership["plan"];

export interface PlanPrice {
  /** Cents, for Apple Pay's recurring-payment sheet. */
  cents: number;
  /** "$99" */
  amount: string;
  /** "$99 a year" */
  full: string;
  /** "Yearly · $99" */
  label: string;
  /** "Just $1.90 a week" */
  sub: string;
  /** "$1.90" */
  week: string;
  interval: "year" | "month";
}

const price = (cents: number, interval: "year" | "month", label: string, sub?: string): PlanPrice => {
  const amount = `$${cents % 100 ? (cents / 100).toFixed(2) : cents / 100}`;
  const week = `$${(cents / 100 / (interval === "year" ? 52 : 4.33)).toFixed(2)}`;
  return { cents, amount, full: `${amount} a ${interval}`, label: `${label} · ${amount}`, sub: sub ?? `Just ${week} a week`, week, interval };
};

const PRICES = {
  annual: price(9900, "year", "Yearly"),
  gift: price(5999, "year", "Yearly"),
  monthly: price(1200, "month", "Monthly", "Cancel anytime"),
};

/** What a plan costs, with the exit gift ($59.99 a year) applied when they claimed it. */
export const planPrice = (plan: Plan, gift?: boolean): PlanPrice => (plan === "annual" && gift ? PRICES.gift : PRICES[plan]);

/** How much yearly saves over twelve months of monthly, e.g. 31. */
export const annualSavings = () => Math.round((1 - PRICES.annual.cents / (PRICES.monthly.cents * 12)) * 100);

/** The gift's discount off the regular yearly price: $59.99 vs $99 is 39%. */
export const giftDiscount = () => Math.floor((1 - PRICES.gift.cents / PRICES.annual.cents) * 100);

export type PaymentsMode = { mode: "stripe"; publishableKey: string } | { mode: "test" };

export async function paymentsMode(): Promise<PaymentsMode> {
  try {
    const r = await fetch("/api/checkout", { method: "GET" });
    return (await r.json()) as PaymentsMode;
  } catch {
    return { mode: "test" };
  }
}

/**
 * Starts the trial subscription and returns the secret the card fields
 * confirm against. Throws with a message fit to show.
 */
export async function createTrial(plan: Plan, email: string, gift: boolean): Promise<{ clientSecret: string; subscription: string }> {
  const r = await fetch("/api/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ plan, email, offer: gift ? "gift" : undefined }),
  });
  const j = (await r.json()) as { clientSecret?: string; subscription?: string; error?: string };
  if (!j.clientSecret || !j.subscription) throw new Error(j.error || "Checkout is unavailable right now.");
  return { clientSecret: j.clientSecret, subscription: j.subscription };
}

/** Test mode (no Stripe keys): the trial starts on this device only. */
export function startTestTrial(plan: Plan, gift: boolean): Membership {
  const now = new Date();
  const m: Membership = {
    plan,
    offer: plan === "annual" && gift ? "gift" : undefined,
    startedAt: now.toISOString(),
    trialEndsAt: new Date(now.getTime() + TRIAL_DAYS * 86400000).toISOString(),
    testMode: true,
  };
  onTrialStarted(m);
  return m;
}

/** Confirms the card is on the trial and turns it into a membership. */
export async function verifyCheckout(subscriptionId: string): Promise<{ member: Membership; email: string; signedIn: boolean }> {
  const r = await fetch(`/api/checkout/verify?subscription=${encodeURIComponent(subscriptionId)}`);
  const j = (await r.json()) as
    | { ok: true; plan: Plan; offer?: string; trialEndsAt: string; customer: string; subscription: string; status: string; email: string; signedIn: boolean }
    | { ok: false; error: string };
  if (!j.ok) throw new Error(j.error);
  const m: Membership = {
    plan: j.plan,
    offer: j.offer,
    startedAt: new Date().toISOString(),
    trialEndsAt: j.trialEndsAt,
    testMode: false,
    status: j.status,
    stripeCustomerId: j.customer,
    stripeSubscriptionId: j.subscription,
  };
  onTrialStarted(m, subscriptionId);
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
 * analytics (mapped to Meta's StartTrial). The eventId is the subscription
 * id, which the server also sends to Meta's Conversions API, so Meta counts
 * the trial once.
 */
function onTrialStarted(m: Membership, eventId?: string) {
  const p = planPrice(m.plan, m.offer === "gift");
  track("trial_started", { plan: m.plan, offer: m.offer, test_mode: m.testMode, trial_ends: m.trialEndsAt, value: p.cents / 100, currency: "USD" }, eventId);
}
