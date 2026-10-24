"use client";

import { track } from "./analytics";
import type { Membership } from "./store";

/**
 * Payments, one place. With Stripe keys, /checkout shows Stripe's own card,
 * Apple Pay and Google Pay fields on the page. Yearly starts with a 3-day
 * free trial; monthly is charged today. Without keys, everything runs in
 * test mode on the device.
 */

export const TRIAL_DAYS = 3;
/**
 * The trial-ending reminder goes out this many days before billing starts:
 * Stripe's default for its trial_will_end event, which is an account-wide
 * setting we leave alone. With a 3-day trial it arrives right away.
 */
export const REMINDER_DAYS_BEFORE = 3;

export type Plan = Membership["plan"];

/** Only yearly comes with the free trial. */
export const hasTrial = (plan: Plan) => plan === "annual";

export interface PlanPrice {
  /** Cents, for Apple Pay's recurring-payment sheet. */
  cents: number;
  /** "$64" */
  amount: string;
  /** "$64 a year" */
  full: string;
  /** "Yearly · $1.23/wk" */
  label: string;
  /** "$64 billed yearly" */
  sub: string;
  /** The headline price: per week for yearly plans ("$1.23"), per month for monthly ("$7.99"). */
  each: string;
  /** "week" or "month", to go with each. */
  per: "week" | "month";
  interval: "year" | "month";
}

const dollars = (cents: number) => `$${cents % 100 ? (cents / 100).toFixed(2) : cents / 100}`;
const weekly = (yearCents: number) => dollars(Math.round(yearCents / 52));

/**
 * Both yearly prices are shown as a discount off this list price ($84 a
 * year, $1.62 a week): $64 is 24% off, the $49.99 gift 40% off.
 */
const LIST_YEAR = 8400;

const yearly = (cents: number): PlanPrice => {
  const amount = dollars(cents);
  return { cents, amount, full: `${amount} a year`, label: `Yearly · ${weekly(cents)}/wk`, sub: `${amount} billed yearly`, each: weekly(cents), per: "week", interval: "year" };
};

const PRICES = {
  annual: yearly(6400),
  gift: yearly(4999),
  monthly: { cents: 799, amount: "$7.99", full: "$7.99 a month", label: "Monthly · $7.99", sub: "Billed monthly", each: "$7.99", per: "month", interval: "month" } as PlanPrice,
};

/** What a plan costs, with the exit gift ($49.99 a year) applied when they claimed it. */
export const planPrice = (plan: Plan, gift?: boolean): PlanPrice => (plan === "annual" && gift ? PRICES.gift : PRICES[plan]);

/** The struck-out weekly list price yearly is measured against: "$1.62". */
export const listWeekly = () => weekly(LIST_YEAR);

/** Yearly's discount off the $84 list price: 24, or 40 with the gift. */
export const yearlyOff = (gift?: boolean) => Math.round((1 - planPrice("annual", gift).cents / LIST_YEAR) * 100);

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
export async function createTrial(plan: Plan, email: string, gift: boolean): Promise<{ clientSecret: string; subscription: string; kind: "setup" | "payment" }> {
  const r = await fetch("/api/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ plan, email, offer: gift ? "gift" : undefined }),
  });
  const j = (await r.json()) as { clientSecret?: string; subscription?: string; kind?: "setup" | "payment"; error?: string };
  if (!j.clientSecret || !j.subscription) throw new Error(j.error || "Checkout is unavailable right now.");
  return { clientSecret: j.clientSecret, subscription: j.subscription, kind: j.kind ?? "setup" };
}

/** Test mode (no Stripe keys): the trial starts on this device only. */
export function startTestTrial(plan: Plan, gift: boolean): Membership {
  const now = new Date();
  const m: Membership = {
    plan,
    offer: plan === "annual" && gift ? "gift" : undefined,
    startedAt: now.toISOString(),
    trialEndsAt: new Date(now.getTime() + (hasTrial(plan) ? TRIAL_DAYS * 86400000 : 0)).toISOString(),
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
