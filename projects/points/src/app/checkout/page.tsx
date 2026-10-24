"use client";

import { Elements, ExpressCheckoutElement, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Appearance, type Stripe, type StripeExpressCheckoutElementConfirmEvent } from "@stripe/stripe-js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { PlanPicker } from "@/components/PlanPicker";
import { Icon, ICONS, PrimaryButton } from "@/components/ui";
import { createTrial, paymentsMode, planPrice, REMINDER_DAYS_BEFORE, startTestTrial, TRIAL_DAYS, type PaymentsMode, type PlanPrice } from "@/lib/payments";
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
 * The last step before the trial, kept to the minimum: the plan in one line
 * (changeable), the free-week dates, email, and payment on the page itself
 * (Apple Pay, Google Pay or card through Stripe's fields). $0 today. The
 * selling happened on the paywall; the exit gift lives there too, so nothing
 * here stands between someone ready to pay and the card fields.
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

      <h1 className="rise pt-4 pb-4 text-[30px] leading-[1.05] font-extrabold tracking-[-0.02em]">Start your free week</h1>

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
            <span className="nums text-[24px] font-extrabold text-gold">{price.month}</span>
            <span className="text-[12px] text-white/60">a month</span>
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
              <span className="text-trace-pink">$0 today</span> · {price.label}
            </span>
            <span className="text-[13px] text-muted">
              Free until {day(TRIAL_DAYS)}. We&apos;ll remind you {day(TRIAL_DAYS - REMINDER_DAYS_BEFORE)}.
            </span>
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
          <StripeCheckout publishableKey={mode.publishableKey} email={email} price={price} onStarted={started} />
        ) : (
          <TestCheckout
            email={email}
            onStart={() => {
              update({ email: email.trim(), member: startTestTrial(state.plan, state.gift), step: "done" });
              started(null);
            }}
          />
        )}
      </div>

      <p className="pt-3 text-center text-[12px] leading-snug text-muted">
        After your free week, renews automatically at {price.full} until you cancel. Cancel anytime in Account. By starting your trial you agree to the{" "}
        <Link href="/terms" className="underline">Terms</Link> and <Link href="/privacy" className="underline">Privacy policy</Link>.
      </p>
    </div>
  );
}

const Reassure = () => (
  <div className="flex items-center justify-center gap-3 text-[12.5px] font-semibold text-muted">
    <span className="flex items-center gap-1"><Icon d={ICONS.shield} size={13} /> Secured by Stripe</span>
    <span className="h-1 w-1 rounded-full bg-muted/60" />
    <span>Cancel in 2 taps</span>
  </div>
);

/** Real payment: Apple Pay / Google Pay buttons, then Stripe's card fields. */
function StripeCheckout({ publishableKey, ...rest }: { publishableKey: string; email: string; price: PlanPrice; onStarted: (sub: string) => void }) {
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
      stripe={getStripe(publishableKey)}
      options={{
        mode: "setup",
        currency: "usd",
        paymentMethodTypes: ["card"],
        appearance,
        fonts: [{ cssSrc: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700&display=swap" }],
      }}
    >
      <StripeForm {...rest} />
    </Elements>
  );
}

function StripeForm({ email, price, onStarted }: { email: string; price: PlanPrice; onStarted: (sub: string) => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const { state, update } = usePoints();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cardReady, setCardReady] = useState(false);
  const [hasWallet, setHasWallet] = useState(true);

  /** Creates the trial and confirms the card on it. Wallets pass their own email if the field is empty. */
  const confirm = async (address: string): Promise<string | null> => {
    if (!stripe || !elements) return "Payment is still loading.";
    if (!validEmail(address)) return "Add your email above first.";
    const { error: submitError } = await elements.submit();
    if (submitError) return submitError.message ?? "Check your card details.";
    try {
      update({ email: address.trim() });
      const { clientSecret, subscription } = await createTrial(state.plan, address.trim(), state.gift);
      const { error: confirmError } = await stripe.confirmSetup({
        elements,
        clientSecret,
        confirmParams: {
          return_url: `${window.location.origin}/checkout/success?subscription=${subscription}`,
          payment_method_data: { billing_details: { email: address.trim() } },
        },
        redirect: "if_required",
      });
      if (confirmError) return confirmError.message ?? "Your card was declined. Try another one.";
      onStarted(subscription);
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  };

  const payWithCard = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    const err = await confirm(email);
    if (err) {
      setError(err);
      setBusy(false);
    }
  };

  const payWithWallet = async (event: StripeExpressCheckoutElementConfirmEvent) => {
    setError("");
    const err = await confirm(validEmail(email) ? email : (event.billingDetails?.email ?? ""));
    if (err) {
      event.paymentFailed({ reason: "fail" });
      setError(err);
    }
  };

  return (
    <div className="flex flex-col gap-3">
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
                  recurringPaymentStartDate: new Date(Date.now() + TRIAL_DAYS * 86400000),
                  recurringPaymentIntervalUnit: price.interval,
                },
                trialBilling: { amount: 0, label: `Free for ${TRIAL_DAYS} days` },
              },
            },
          })
        }
        onConfirm={payWithWallet}
        options={{ buttonType: { applePay: "subscribe", googlePay: "subscribe" }, buttonHeight: 52, paymentMethods: { link: "never", amazonPay: "never", paypal: "never", klarna: "never" } }}
      />
      {hasWallet && (
        <div className="flex items-center gap-3 text-[12.5px] font-semibold text-muted">
          <span className="h-px flex-1 bg-line" /> or pay with card <span className="h-px flex-1 bg-line" />
        </div>
      )}
      <PaymentElement
        onReady={() => setCardReady(true)}
        // Cards only: Link's bank option and its save-your-info box don't fit a card-only trial.
        options={{ layout: "tabs", wallets: { applePay: "never", googlePay: "never", link: "never" }, fields: { billingDetails: { email: "never" } }, terms: { card: "never" } }}
      />
      {error && <div role="alert" className="rounded-2xl bg-near-bg px-4 py-3 text-[14px] font-semibold text-near">{error}</div>}
      <PrimaryButton onClick={payWithCard} disabled={!stripe || !cardReady || busy || !validEmail(email)}>
        {busy ? "Starting your free week…" : "Start my free week · $0 today"}
      </PrimaryButton>
      <Reassure />
    </div>
  );
}

/**
 * Test mode (no Stripe keys yet): the same layout with stand-in payment
 * fields, so the page can be reviewed. Nothing here accepts card details.
 */
function TestCheckout({ email, onStart }: { email: string; onStart: () => void }) {
  const field = "flex min-h-[52px] items-center rounded-2xl border border-line bg-surface px-4 text-[16px] text-muted/70";
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={onStart}
        disabled={!validEmail(email)}
        className="flex min-h-[52px] items-center justify-center gap-1.5 rounded-2xl bg-black text-[17px] font-semibold text-white disabled:opacity-40"
      >
        Subscribe with <span className="text-[19px] font-bold tracking-tight"> Pay</span>
      </button>
      <div className="flex items-center gap-3 text-[12.5px] font-semibold text-muted">
        <span className="h-px flex-1 bg-line" /> or pay with card <span className="h-px flex-1 bg-line" />
      </div>
      <div aria-hidden="true" className="flex flex-col gap-2">
        <div className={field}>Card number</div>
        <div className="grid grid-cols-2 gap-2">
          <div className={field}>MM / YY</div>
          <div className={field}>CVC</div>
        </div>
      </div>
      <p className="rounded-xl border border-dashed border-line px-3 py-2 text-center text-[11.5px] text-muted">
        Test mode: these are stand-in fields and no card is collected. Add Stripe keys for real Apple Pay, Google Pay and cards.
      </p>
      <PrimaryButton onClick={onStart} disabled={!validEmail(email)}>
        Start my free week · $0 today
      </PrimaryButton>
      <Reassure />
    </div>
  );
}
