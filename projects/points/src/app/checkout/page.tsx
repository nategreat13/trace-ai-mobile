"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { PRICES } from "@/components/Paywall";
import { Check, cx, Icon, ICONS, PrimaryButton, stagger } from "@/components/ui";
import { paymentsMode, REMINDER_DAYS_BEFORE, startCheckout, TRIAL_DAYS } from "@/lib/payments";
import { usePoints } from "@/lib/store";

const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

/**
 * Checkout: confirm the plan, see exactly when billing starts, give the email
 * the account needs, then hand off to Stripe (or start a test-mode trial when
 * no Stripe keys are set).
 */
export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh" />}>
      <Checkout />
    </Suspense>
  );
}

function Checkout() {
  const { state, update, ready } = usePoints();
  const router = useRouter();
  const canceled = useSearchParams().get("canceled") === "1";
  const [mode, setMode] = useState<"stripe" | "test" | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Set once this page starts a trial, so the "already a member" redirect doesn't race the welcome screen.
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    paymentsMode().then(setMode);
  }, []);
  useEffect(() => {
    if (!ready) return;
    if (state.member && !finishing) router.replace("/discover");
    setEmail((e) => e || state.email);
  }, [ready, state.member, state.email, router, finishing]);

  const plan = state.plan;
  const price = plan === "annual" ? "$99 a year" : "$12 a month";
  const valid = /.+@.+\..+/.test(email);

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError("");
    update({ email });
    try {
      const m = await startCheckout(plan, email);
      if (m) {
        setFinishing(true);
        update({ member: m, step: "done" });
        router.replace("/");
      }
      // Stripe mode navigates away; nothing else to do here.
    } catch (e) {
      setError((e as Error).message || "Something went wrong. Nothing was charged.");
      setBusy(false);
    }
  };

  const steps = [
    { when: `Today, ${day(0)}`, what: "Your free week starts", sub: "Every destination, exact dates, seat alerts", tone: "now" },
    { when: day(TRIAL_DAYS - REMINDER_DAYS_BEFORE), what: "We email you a reminder", sub: "Two days before anything is charged", tone: "later" },
    { when: day(TRIAL_DAYS), what: `${price} begins`, sub: "Cancel before then and you pay nothing", tone: "later" },
  ];

  return (
    <div className="flex min-h-dvh flex-col px-5 pt-4 pb-safe">
      <button
        type="button"
        aria-label="Back"
        onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
        className="flex h-11 w-11 items-center justify-center rounded-2xl bg-soft active:scale-95"
      >
        <Icon d={ICONS.back} size={18} stroke={2.4} />
      </button>

      <div className="rise flex flex-col gap-1.5 pt-4 pb-5">
        <h1 className="text-[32px] leading-[1.05] font-extrabold tracking-[-0.02em]">Start your free week</h1>
        <p className="text-[16px] font-medium text-muted">Full access for {TRIAL_DAYS} days. You won&apos;t be charged today.</p>
      </div>

      {canceled && (
        <div className="mb-4 rounded-2xl bg-near-bg px-4 py-3 text-[14px] font-semibold text-near">Checkout was canceled. Nothing was charged.</div>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        {(["annual", "monthly"] as const).map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={plan === p}
            onClick={() => update({ plan: p })}
            className={cx(
              "relative flex min-h-[76px] flex-col items-start justify-center rounded-2xl px-4 text-left transition active:scale-[0.98]",
              plan === p ? "bg-surface shadow-[0_0_0_2.5px_#FD297B,0_10px_24px_rgba(253,41,123,0.15)]" : "bg-soft",
            )}
          >
            {p === "annual" && <span className="bg-trace absolute -top-2.5 right-3 rounded-full px-2 py-0.5 text-[11px] font-extrabold text-white">SAVE 31%</span>}
            <span className="text-[15.5px] font-extrabold">{PRICES[p].label}</span>
            <span className="text-[12.5px] text-muted">{PRICES[p].sub}</span>
          </button>
        ))}
      </div>

      <ol className="mt-6 flex flex-col rounded-3xl bg-soft p-5">
        {steps.map((s, i) => (
          <li key={s.what} className="rise flex gap-3.5" style={stagger(i, 80)}>
            <span className="flex flex-col items-center">
              <span className={cx("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", s.tone === "now" ? "bg-trace text-white" : "bg-surface text-muted")}>
                {s.tone === "now" ? <Check size={14} /> : <Icon d={i === 1 ? ICONS.bell : ICONS.card} size={15} />}
              </span>
              {i < steps.length - 1 && <span className="my-1 w-0.5 flex-1 bg-line" />}
            </span>
            <span className="flex flex-col pb-4">
              <span className="text-[12px] font-extrabold tracking-[0.06em] text-muted uppercase">{s.when}</span>
              <span className="text-[16px] font-extrabold">{s.what}</span>
              <span className="text-[13.5px] text-muted">{s.sub}</span>
            </span>
          </li>
        ))}
      </ol>

      <form
        className="mt-5 flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label htmlFor="checkout-email" className="text-[13px] font-bold text-muted">Email for your account and receipts</label>
        <input
          id="checkout-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="min-h-[56px] rounded-2xl bg-soft px-4 text-[17px] outline-none focus:bg-surface focus:ring-2 focus:ring-trace-pink"
        />
      </form>

      <div className="flex-1" />

      <div className="flex flex-col gap-2.5 pt-6">
        {error && <div className="rounded-2xl bg-near-bg px-4 py-3 text-[14px] font-semibold text-near">{error}</div>}
        <PrimaryButton onClick={submit} disabled={!valid || busy || !mode}>
          {busy ? "One moment…" : mode === "stripe" ? "Continue to secure payment" : "Start my free week"}
        </PrimaryButton>
        {mode === "stripe" ? (
          <p className="flex items-center justify-center gap-1.5 text-center text-[12.5px] font-medium text-muted">
            <Icon d={ICONS.shield} size={14} /> Secure checkout by Stripe · Card, Apple Pay, Google Pay
          </p>
        ) : (
          <p className="rounded-xl border border-dashed border-line px-3 py-2 text-center text-[11.5px] text-muted">
            Test mode: no card is collected. Add Stripe keys to take real payments.
          </p>
        )}
        <p className="text-center text-[12px] text-muted">Cancel anytime in Account. Money-back guarantee.</p>
      </div>
    </div>
  );
}
