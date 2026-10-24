"use client";

import { CardCvcElement, CardExpiryElement, CardNumberElement, Elements, ExpressCheckoutElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Appearance, type Stripe, type StripeCardNumberElement, type StripeElementStyle, type StripeExpressCheckoutElementConfirmEvent } from "@stripe/stripe-js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { PlanPicker } from "@/components/PlanPicker";
import { Icon, ICONS, PrimaryButton } from "@/components/ui";
import { createTrial, hasTrial, paymentsMode, planPrice, startTestTrial, TRIAL_DAYS, type PaymentsMode, type PlanPrice } from "@/lib/payments";
import { money } from "@/lib/format";
import { usePoints, useDeck } from "@/lib/store";

const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};
const validEmail = (e: string) => /.+@.+\..+/.test(e.trim());

let stripePromise: Promise<Stripe | null> | null = null;
const getStripe = (key: string) => (stripePromise ??= loadStripe(key));

/**
 * The last step, kept to the minimum: the plan in one line (changeable), the
 * trial dates, email, and payment on the page itself (Apple Pay, Google Pay
 * or card through Stripe's fields). Yearly is $0 today for 3 days; monthly is
 * charged today. The selling happened on the paywall; the exit gift lives
 * there too, so nothing here stands between someone ready to pay and the
 * card fields.
 */
export default function CheckoutPage() {
  const { state, update, ready } = usePoints();
  const router = useRouter();
  const [mode, setMode] = useState<PaymentsMode | null>(null);
  const [email, setEmail] = useState("");
  const [changing, setChanging] = useState(false);
  // Set once this page starts a trial, so the "already a member" redirect doesn't race the welcome screen.
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    paymentsMode().then(setMode);
  }, []);
  useEffect(() => {
    if (!ready) return;
    if (state.member && !finishing) router.replace("/discover");
    setEmail((e) => e || state.email);
    if (!state.checkoutVisited) update({ checkoutVisited: true });
  }, [ready, state.member, state.email, state.checkoutVisited, router, finishing, update]);

  const { values } = useDeck();
  const price = planPrice(state.plan, state.gift);
  const trial = hasTrial(state.plan);
  const back = () => (window.history.length > 1 ? router.back() : router.push("/"));

  const started = (subscription: string | null) => {
    setFinishing(true);
    if (subscription) router.replace(`/checkout/success?subscription=${subscription}`);
    else router.replace("/");
  };

  return (
    <div className="flex min-h-dvh flex-col px-5 pt-4 pb-safe">
      <button type="button" aria-label="Back" onClick={back} className="flex h-11 w-11 items-center justify-center rounded-2xl bg-soft active:scale-95">
        <Icon d={ICONS.back} size={18} stroke={2.4} />
      </button>

      <h1 className="rise pt-4 pb-4 text-[30px] leading-[1.05] font-extrabold tracking-[-0.02em]">{trial ? "Start your free trial" : "Join Trace"}</h1>

      {/* The trade in one line: what their points book against what Trace costs. */}
      {values.flights > 0 && (
        <div className="bg-premium mb-2 flex items-center justify-between rounded-2xl px-4 py-3 text-white">
          <span className="flex flex-col leading-tight">
            <span className="text-[12px] font-semibold text-white/60">{state.starter ? "One card bonus" : "Your points"}</span>
            <span className="text-gradient nums text-[24px] font-extrabold">{money(values.flights)}</span>
            <span className="text-[12px] text-white/60">in flights</span>
          </span>
          <span className="flex flex-col text-right leading-tight">
            <span className="text-[12px] font-semibold text-white/60">Trace</span>
            <span className="nums text-[24px] font-extrabold text-gold">{price.each}</span>
            <span className="text-[12px] text-white/60">a {price.per}</span>
          </span>
        </div>
      )}

      {/* What they're paying, decided on the paywall: one line, changeable, nothing else to read. */}
      {changing ? (
        <div className="flex flex-col gap-2">
          <PlanPicker />
          <button type="button" onClick={() => setChanging(false)} className="min-h-[40px] text-[14px] font-bold text-muted">
            Done
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl bg-soft px-4 py-3">
          <span className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="text-[16px] font-extrabold">
              <span className="text-trace-pink">{trial ? "$0 today" : `${price.amount} today`}</span> · {trial ? price.label : "Monthly"}
            </span>
            <span className="text-[13px] text-muted">{trial ? `Free until ${day(TRIAL_DAYS)}, then ${price.full}.` : "Renews monthly."}</span>
          </span>
          <button type="button" onClick={() => setChanging(true)} className="min-h-[40px] shrink-0 px-1 text-[14px] font-bold text-trace-pink">
            Change
          </button>
        </div>
      )}

      <label htmlFor="checkout-email" className="mt-5 pb-2 text-[13px] font-bold text-muted">
        Email for your account and receipts
      </label>
      <input
        id="checkout-email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="min-h-[56px] rounded-2xl bg-soft px-4 text-[17px] outline-none focus:bg-surface focus:ring-2 focus:ring-trace-pink"
      />

      <div className="mt-5">
        {!mode ? (
          <div className="h-[220px] animate-pulse rounded-2xl bg-soft" />
        ) : mode.mode === "stripe" ? (
          <StripeCheckout publishableKey={mode.publishableKey} email={email} price={price} trial={trial} onStarted={started} />
        ) : (
          <TestCheckout
            email={email}
            trial={trial}
            onStart={() => {
              update({ email: email.trim(), member: startTestTrial(state.plan, state.gift), step: "done" });
              started(null);
            }}
          />
        )}
      </div>

      <p className="pt-3 text-center text-[12px] leading-snug text-muted">
        {trial ? `After ${TRIAL_DAYS} days, renews` : "Renews"} automatically at {price.full} until you cancel. Cancel anytime in Account. By continuing you agree to the{" "}
        <Link href="/terms" className="underline">Terms</Link> and <Link href="/privacy" className="underline">Privacy policy</Link>.
      </p>
    </div>
  );
}

const Reassure = () => (
  <div className="flex flex-col items-center gap-1 text-center">
    <span className="text-[14px] font-bold">No commitment, cancel anytime</span>
    <span className="flex items-center gap-1 text-[12px] font-semibold text-muted"><Icon d={ICONS.shield} size={12} /> Secured by Stripe</span>
  </div>
);

/** Real payment: Apple Pay / Google Pay buttons, then Stripe's card fields. */
function StripeCheckout({ publishableKey, ...rest }: { publishableKey: string; email: string; price: PlanPrice; trial: boolean; onStarted: (sub: string) => void }) {
  const dark = typeof document !== "undefined" && document.documentElement.dataset.theme === "dark";
  const appearance: Appearance = useMemo(
    () => ({
      theme: dark ? "night" : "stripe",
      variables: { colorPrimary: "#FD297B", borderRadius: "16px", fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif', fontSizeBase: "16px" },
    }),
    [dark],
  );
  return (
    <Elements
      // Remount when the plan switches between trial (setup) and charge-today (subscription).
      key={rest.trial ? "setup" : "subscription"}
      stripe={getStripe(publishableKey)}
      options={{
        ...(rest.trial ? { mode: "setup" as const } : { mode: "subscription" as const, amount: rest.price.cents }),
        currency: "usd",
        paymentMethodTypes: ["card"],
        appearance,
        fonts: [{ cssSrc: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700&display=swap" }],
      }}
    >
      <StripeForm {...rest} dark={dark} />
    </Elements>
  );
}

const fieldBox = "min-h-[54px] rounded-2xl border border-line bg-surface px-4 py-[17px]";

function StripeForm({ email, price, trial, dark, onStarted }: { email: string; price: PlanPrice; trial: boolean; dark: boolean; onStarted: (sub: string) => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const { state, update } = usePoints();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [hasWallet, setHasWallet] = useState(true);
  // Card number first; expiry and CVC appear once the number is complete.
  const [numberDone, setNumberDone] = useState(false);
  const [cardDone, setCardDone] = useState({ expiry: false, cvc: false });
  const cardReady = numberDone && cardDone.expiry && cardDone.cvc;
  const style: StripeElementStyle = useMemo(
    () => ({
      base: { fontSize: "17px", fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif', fontWeight: "600", color: dark ? "#F4F6FB" : "#0F1730", "::placeholder": { color: "#8A93A8" } },
      invalid: { color: "#E5484D" },
    }),
    [dark],
  );

  /** Creates the subscription; returns its secret and whether it's a trial (setup) or a charge (payment). */
  const begin = async (address: string) => {
    update({ email: address.trim() });
    return createTrial(state.plan, address.trim(), state.gift);
  };

  const payWithCard = async () => {
    if (busy || !stripe || !elements) return;
    if (!validEmail(email)) return setError("Add your email above first.");
    setBusy(true);
    setError("");
    try {
      const { clientSecret, subscription, kind } = await begin(email);
      const card = elements.getElement(CardNumberElement) as StripeCardNumberElement;
      const payment_method = { card, billing_details: { email: email.trim() } };
      const { error: e } = kind === "payment" ? await stripe.confirmCardPayment(clientSecret, { payment_method }) : await stripe.confirmCardSetup(clientSecret, { payment_method });
      if (e) throw new Error(e.message ?? "Your card was declined. Try another one.");
      onStarted(subscription);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const payWithWallet = async (event: StripeExpressCheckoutElementConfirmEvent) => {
    if (!stripe || !elements) return;
    setError("");
    try {
      const address = validEmail(email) ? email : (event.billingDetails?.email ?? "");
      if (!validEmail(address)) throw new Error("Add your email above first.");
      const { error: submitError } = await elements.submit();
      if (submitError) throw new Error(submitError.message ?? "Check your details.");
      const { clientSecret, subscription, kind } = await begin(address);
      const confirmParams = {
        return_url: `${window.location.origin}/checkout/success?subscription=${subscription}`,
        payment_method_data: { billing_details: { email: address.trim() } },
      };
      const { error: e } =
        kind === "payment"
          ? await stripe.confirmPayment({ elements, clientSecret, confirmParams, redirect: "if_required" })
          : await stripe.confirmSetup({ elements, clientSecret, confirmParams, redirect: "if_required" });
      if (e) throw new Error(e.message ?? "Your card was declined. Try another one.");
      onStarted(subscription);
    } catch (e) {
      event.paymentFailed({ reason: "fail" });
      setError((e as Error).message);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="mx-auto w-full max-w-[280px]">
        <ExpressCheckoutElement
          onReady={({ availablePaymentMethods }) => setHasWallet(!!availablePaymentMethods)}
          onClick={(event) =>
            event.resolve({
              emailRequired: !validEmail(email),
              applePay: {
                recurringPaymentRequest: {
                  paymentDescription: `Trace Points ${state.plan === "annual" ? "yearly" : "monthly"} membership`,
                  managementURL: `${window.location.origin}/account`,
                  regularBilling: {
                    amount: price.cents,
                    label: `Trace Points, ${price.full}`,
                    recurringPaymentStartDate: trial ? new Date(Date.now() + TRIAL_DAYS * 86400000) : undefined,
                    recurringPaymentIntervalUnit: price.interval,
                  },
                  ...(trial ? { trialBilling: { amount: 0, label: `Free for ${TRIAL_DAYS} days` } } : {}),
                },
              },
            })
          }
          onConfirm={payWithWallet}
          options={{ buttonType: { applePay: "subscribe", googlePay: "subscribe" }, buttonHeight: 50, paymentMethods: { link: "never", amazonPay: "never", paypal: "never", klarna: "never" } }}
        />
      </div>
      {hasWallet && (
        <div className="flex items-center gap-3 text-[12.5px] font-semibold text-muted">
          <span className="h-px flex-1 bg-line" /> or card <span className="h-px flex-1 bg-line" />
        </div>
      )}
      <div className={fieldBox}>
        <CardNumberElement options={{ style, placeholder: "Card number", showIcon: true }} onChange={(e) => setNumberDone(e.complete)} />
      </div>
      {numberDone && (
        <div className="rise grid grid-cols-2 gap-2">
          <div className={fieldBox}>
            <CardExpiryElement options={{ style }} onChange={(e) => setCardDone((c) => ({ ...c, expiry: e.complete }))} />
          </div>
          <div className={fieldBox}>
            <CardCvcElement options={{ style, placeholder: "CVC" }} onChange={(e) => setCardDone((c) => ({ ...c, cvc: e.complete }))} />
          </div>
        </div>
      )}
      {error && <div role="alert" className="rounded-2xl bg-near-bg px-4 py-3 text-[14px] font-semibold text-near">{error}</div>}
      <PrimaryButton onClick={payWithCard} disabled={!stripe || !cardReady || busy || !validEmail(email)}>
        {busy ? "Starting…" : trial ? `Start my ${TRIAL_DAYS}-day free trial` : `Join for ${price.amount}/mo`}
      </PrimaryButton>
      <Reassure />
    </div>
  );
}

/**
 * Test mode (no Stripe keys yet): the same layout with stand-in payment
 * fields, so the page can be reviewed. Nothing here accepts card details.
 */
function TestCheckout({ email, trial, onStart }: { email: string; trial: boolean; onStart: () => void }) {
  const field = "flex min-h-[52px] items-center rounded-2xl border border-line bg-surface px-4 text-[16px] text-muted/70";
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={onStart}
        disabled={!validEmail(email)}
        className="mx-auto flex min-h-[50px] w-full max-w-[280px] items-center justify-center gap-1.5 rounded-2xl bg-black text-[17px] font-semibold text-white disabled:opacity-40"
      >
        Subscribe with <span className="text-[19px] font-bold tracking-tight"> Pay</span>
      </button>
      <div className="flex items-center gap-3 text-[12.5px] font-semibold text-muted">
        <span className="h-px flex-1 bg-line" /> or card <span className="h-px flex-1 bg-line" />
      </div>
      <div aria-hidden="true" className="flex flex-col gap-2">
        <div className={field}>Card number</div>
      </div>
      <p className="rounded-xl border border-dashed border-line px-3 py-2 text-center text-[11.5px] text-muted">
        Test mode: these are stand-in fields and no card is collected. Add Stripe keys for real Apple Pay, Google Pay and cards.
      </p>
      <PrimaryButton onClick={onStart} disabled={!validEmail(email)}>
        {trial ? `Start my ${TRIAL_DAYS}-day free trial` : "Join for $7.99/mo"}
      </PrimaryButton>
      <Reassure />
    </div>
  );
}
