"use client";

import { Elements, ExpressCheckoutElement, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Appearance, type Stripe, type StripeExpressCheckoutElementConfirmEvent } from "@stripe/stripe-js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { GiftOffer } from "@/components/GiftOffer";
import { PlanPicker } from "@/components/PlanPicker";
import { Check, cx, Icon, ICONS, PrimaryButton, stagger } from "@/components/ui";
import { groupDestinations } from "@/lib/destinations";
import { money, plural } from "@/lib/format";
import { createTrial, paymentsMode, planPrice, REMINDER_DAYS_BEFORE, startTestTrial, TRIAL_DAYS, type PaymentsMode, type PlanPrice } from "@/lib/payments";
import { useDeck, usePoints } from "@/lib/store";

const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};
const validEmail = (e: string) => /.+@.+\..+/.test(e.trim());

let stripePromise: Promise<Stripe | null> | null = null;
const getStripe = (key: string) => (stripePromise ??= loadStripe(key));

/**
 * The last step before the trial: what they're unlocking (their own numbers),
 * the plan, when billing would start, and payment on the page itself (Apple
 * Pay, Google Pay or card through Stripe's fields). $0 today. Backing out
 * once offers the $59.99 annual gift.
 */
export default function CheckoutPage() {
  const { state, update, ready } = usePoints();
  const { deck, values } = useDeck();
  const router = useRouter();
  const [mode, setMode] = useState<PaymentsMode | null>(null);
  const [email, setEmail] = useState("");
  const [gift, setGift] = useState(false);
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

  const destinations = groupDestinations(deck);
  const okCount = destinations.filter((d) => d.ok).length;
  const price = planPrice(state.plan, state.gift);

  const leave = () => (window.history.length > 1 ? router.back() : router.push("/"));
  const back = () => {
    if (!state.giftOffered && !state.member) setGift(true);
    else leave();
  };

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

      <div className="rise flex flex-col gap-2 pt-4 pb-5">
        <span className="bg-trace self-start rounded-full px-2.5 py-1 text-[12px] font-extrabold tracking-[0.04em] text-white">$0 TODAY</span>
        <h1 className="text-[32px] leading-[1.05] font-extrabold tracking-[-0.02em]">Start your free week</h1>
        <p className="text-[16px] leading-snug font-medium text-muted">
          {destinations.length ? (
            <>
              Unlock all <span className="font-extrabold text-ink">{plural(destinations.length, "destination")}</span>
              {okCount ? <> ({okCount} you can book today)</> : null}, worth <span className="text-gradient font-extrabold">{money(values.flights)}</span> in flights.
            </>
          ) : (
            <>Every deal your points can book, with exact dates and seat alerts.</>
          )}
        </p>
      </div>

      <PlanPicker />

      <ul className="mt-5 flex flex-col gap-2">
        {["Exact dates and seat counts for every trip", "Alerts the moment seats or bonuses open", "Our team checks seats for you within 24 hours"].map((t, i) => (
          <li key={t} className="rise flex items-center gap-2.5 text-[14.5px] font-bold" style={stagger(i, 60)}>
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-trace-green text-white">
              <Check size={11} />
            </span>
            {t}
          </li>
        ))}
      </ul>

      <Timeline price={price} />

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

      {gift && (
        <GiftOffer
          where="checkout"
          onClaim={() => setGift(false)}
          onDecline={() => {
            setGift(false);
            leave();
          }}
        />
      )}
    </div>
  );
}

function Timeline({ price }: { price: PlanPrice }) {
  const steps = [
    { when: "Today", what: "Free week starts", icon: null },
    { when: day(TRIAL_DAYS - REMINDER_DAYS_BEFORE), what: "Reminder email", icon: ICONS.bell },
    { when: day(TRIAL_DAYS), what: `${price.amount} if you stay`, icon: ICONS.card },
  ];
  return (
    <ol className="mt-5 grid grid-cols-3 gap-2 rounded-3xl bg-soft p-3">
      {steps.map((s, i) => (
        <li key={s.what} className="flex flex-col items-center gap-1.5 text-center">
          <span className={cx("flex h-8 w-8 items-center justify-center rounded-full", i === 0 ? "bg-trace text-white" : "bg-surface text-muted")}>
            {s.icon ? <Icon d={s.icon} size={15} /> : <Check size={14} />}
          </span>
          <span className="text-[11px] font-extrabold tracking-[0.05em] text-muted uppercase">{s.when}</span>
          <span className="text-[13px] leading-tight font-bold">{s.what}</span>
        </li>
      ))}
    </ol>
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
        options={{ buttonType: { applePay: "subscribe", googlePay: "subscribe" }, buttonHeight: 52 }}
      />
      {hasWallet && (
        <div className="flex items-center gap-3 text-[12.5px] font-semibold text-muted">
          <span className="h-px flex-1 bg-line" /> or pay with card <span className="h-px flex-1 bg-line" />
        </div>
      )}
      <PaymentElement
        onReady={() => setCardReady(true)}
        options={{ layout: "tabs", wallets: { applePay: "never", googlePay: "never" }, fields: { billingDetails: { email: "never" } }, terms: { card: "never" } }}
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
