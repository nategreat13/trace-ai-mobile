"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AIRLINE_IDS, BANK_IDS, HOTEL_IDS, PROGRAMS, hopFor } from "@/engine/data";
import { cityStatuses } from "@/engine/engine";
import type { ProgramId, TripResult } from "@/engine/types";
import { track } from "@/lib/analytics";
import { groupDestinations } from "@/lib/destinations";
import { milesTotal, tierFor } from "@/lib/tiers";
import { kShort, num, plural } from "@/lib/format";
import { useAccount } from "@/lib/account";
import { effectiveBalances, type FunnelStep, usePoints, useDeck } from "@/lib/store";
import { GiftOffer } from "../GiftOffer";
import { SignInOptions } from "../SignInOptions";
import { Paywall } from "../Paywall";
import { ResultsView, type PayReason } from "../results/ResultsView";
import { TripDetail } from "../TripDetail";
import { TripThumb } from "../TripThumb";
import { Check, Confetti, cx, Eyebrow, Icon, ICONS, Logo, PrimaryButton, ProgramBadge, SecondaryButton, stagger } from "../ui";
import { AirportSearch } from "./AirportSearch";
import { StoreBalanceCard } from "./BalanceCard";
import { Landing } from "./Landing";

// Travelers and email used to be steps here. Both moved out of the way: prices
// default to one ticket (changeable later), and email is asked for alongside
// results and at checkout instead of blocking them.
const QUESTIONS: FunnelStep[] = ["progs", "bal", "air", "picks"];
const PREV: Partial<Record<FunnelStep, FunnelStep>> = { progs: "land", bal: "progs", air: "bal", picks: "air" };

export function Funnel() {
  const { state, update, ready } = usePoints();
  const router = useRouter();
  const step = state.step;
  const go = (s: FunnelStep) => update({ step: s });
  const [payReason, setPayReason] = useState<PayReason>("cta");

  // Browser back walks back through the funnel instead of leaving the site.
  useEffect(() => {
    if (!ready) return;
    if (window.history.state?.step !== step) window.history.pushState({ ...window.history.state, step }, "");
  }, [step, ready]);
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      if (e.state?.step) update({ step: e.state.step === "load" ? "picks" : e.state.step });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [update]);

  useEffect(() => {
    if (ready && state.member && step !== "done") router.replace("/discover");
  }, [ready, state.member, step, router]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  if (!ready) return <div className="min-h-dvh bg-midnight" />;

  const q = QUESTIONS.indexOf(step);
  return (
    <div className="flex min-h-dvh flex-col">
      {q >= 0 && (
        <div className="sticky top-0 z-30 flex items-center gap-3.5 bg-surface/90 px-5 pt-4 pb-3 backdrop-blur">
          <button
            type="button"
            aria-label="Back"
            onClick={() => go(PREV[step] ?? "land")}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-soft active:scale-95"
          >
            <Icon d={ICONS.back} size={18} stroke={2.4} />
          </button>
          <div className="flex flex-1 gap-1.5" role="progressbar" aria-valuemin={0} aria-valuemax={QUESTIONS.length} aria-valuenow={q + 1} aria-label={`Step ${q + 1} of ${QUESTIONS.length}`}>
            {QUESTIONS.map((s, k) => (
              <span key={s} className="h-1.5 flex-1 overflow-hidden rounded-full bg-soft">
                <span className={cx("block h-full rounded-full bg-trace transition-[width] duration-500", k <= q ? "w-full" : "w-0")} />
              </span>
            ))}
          </div>
        </div>
      )}
      {step === "land" && <Landing onStart={() => go("progs")} />}
      {step === "progs" && <Programs onNext={() => go("bal")} />}
      {step === "bal" && <BalancesStep onNext={() => go("air")} />}
      {step === "air" && <AirportStep onNext={() => go("picks")} />}
      {step === "picks" && <Picks onNext={() => go("load")} />}
      {step === "load" && <Loading onDone={() => go("results")} />}
      {step === "results" && (
        <FreeResults
          onPaywall={(reason) => {
            setPayReason(reason);
            go("pay");
          }}
        />
      )}
      {step === "pay" && <Paywall reason={payReason} onClose={() => go("results")} onStart={() => router.push("/checkout")} />}
      {step === "done" && <Done onOpen={() => router.push("/discover")} />}
      {/* Came back from the payment page without starting (browser back included): offer the gift once. */}
      {(step === "results" || step === "pay") && state.checkoutVisited && !state.giftOffered && !state.member && (
        <GiftOffer where="results" onClaim={() => router.push("/checkout")} onDecline={() => {}} />
      )}
    </div>
  );
}

function Screen({
  title,
  sub,
  children,
  footer,
  icon,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
  footer: React.ReactNode;
  /** Shown above the title on screens without the progress bar. */
  icon?: React.ReactNode;
}) {
  return (
    <div className={cx("flex flex-1 flex-col px-5", icon ? "pt-14" : "pt-2")}>
      <div className="rise flex flex-col gap-2 pb-5">
        {icon && <div className="pb-3">{icon}</div>}
        <h1 className="text-[31px] leading-[1.08] font-extrabold tracking-[-0.02em]">{title}</h1>
        {sub && <p className="text-[16px] leading-snug text-muted">{sub}</p>}
      </div>
      <div className="flex flex-1 flex-col">{children}</div>
      {footer && <div className="pb-safe sticky bottom-0 flex flex-col gap-2 bg-gradient-to-t from-surface from-70% to-surface/0 pt-6">{footer}</div>}
    </div>
  );
}

function ProgramTile({ id, i }: { id: ProgramId; i: number }) {
  const { state, update } = usePoints();
  const on = state.progs.includes(id);
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => update((s) => ({ progs: on ? s.progs.filter((x) => x !== id) : [...s.progs, id] }))}
      style={stagger(i)}
      className={cx(
        "rise relative flex min-h-[112px] flex-col items-center justify-center gap-2.5 rounded-3xl px-1.5 py-3 text-center transition-all duration-200 active:scale-95",
        on ? "bg-surface shadow-[0_0_0_2.5px_#FD297B,0_10px_24px_rgba(253,41,123,0.18)]" : "bg-soft",
      )}
    >
      <span className={cx("transition-transform duration-200", on && "scale-110")}>
        <ProgramBadge id={id} size={48} />
      </span>
      <span className="text-[13.5px] leading-tight font-bold">{PROGRAMS[id].short}</span>
      {on && (
        <span className="check-in bg-trace absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full text-white">
          <Check size={12} />
        </span>
      )}
    </button>
  );
}

function Programs({ onNext }: { onNext: () => void }) {
  const { state } = usePoints();
  const n = state.progs.length;
  return (
    <Screen
      title="Which points do you have?"
      sub="Pick every card and airline. We'll combine them."
      footer={
        <PrimaryButton
          disabled={!n}
          onClick={() => {
            track("programs_selected", { programs: state.progs.join(","), count: n });
            onNext();
          }}
        >
          {n ? `Continue with ${plural(n, "program")}` : "Pick at least one"}
        </PrimaryButton>
      }
    >
      <Eyebrow className="pb-3">Credit card points</Eyebrow>
      <div className="grid grid-cols-3 gap-2.5">{BANK_IDS.map((id, i) => <ProgramTile key={id} id={id} i={i} />)}</div>
      <Eyebrow className="pt-6 pb-3">Airline miles</Eyebrow>
      <div className="grid grid-cols-3 gap-2.5">{AIRLINE_IDS.map((id, i) => <ProgramTile key={id} id={id} i={i + BANK_IDS.length} />)}</div>
      {HOTEL_IDS.length > 0 && (
        <>
          <Eyebrow className="pt-6 pb-3">Hotel points</Eyebrow>
          <div className="grid grid-cols-3 gap-2.5">
            {HOTEL_IDS.map((id, i) => <ProgramTile key={id} id={id} i={i + BANK_IDS.length + AIRLINE_IDS.length} />)}
          </div>
        </>
      )}
    </Screen>
  );
}

function BalancesStep({ onNext }: { onNext: () => void }) {
  const { state } = usePoints();
  const { values } = useDeck();
  const ok = state.progs.length > 0 && state.progs.every((id) => state.estimated[id] || (Number(state.balances[id]) || 0) > 0);
  return (
    <Screen
      title="How many do you have?"
      sub={`Check your card's app, or tap "Not sure" and we'll estimate.`}
      footer={
        <>
          <div
            className="flex items-center justify-between rounded-2xl px-5 py-3 text-white transition-[background] duration-700"
            style={{ background: values.total ? tierFor(milesTotal(effectiveBalances(state))).gradient : "#0F1730" }}
          >
            <span className="flex flex-col leading-tight">
              <span className="text-[13px] font-semibold text-white/80">Total points</span>
              {values.total > 0 && (
                <span key={tierFor(milesTotal(effectiveBalances(state))).level} className="pop text-[12.5px] font-extrabold">
                  {tierFor(milesTotal(effectiveBalances(state))).label}
                </span>
              )}
            </span>
            <span key={Math.round(values.total / 10000)} className="pop nums text-[24px] font-extrabold">{num(values.total)}</span>
          </div>
          <PrimaryButton
            disabled={!ok}
            onClick={() => {
              track("balances_entered", { total: values.total, estimated: Object.values(state.estimated).filter(Boolean).length });
              onNext();
            }}
          >
            Continue
          </PrimaryButton>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {state.progs.map((id, i) => (
          <div key={id} className="rise" style={stagger(i, 70)}>
            <StoreBalanceCard id={id} />
          </div>
        ))}
      </div>
    </Screen>
  );
}

function AirportStep({ onNext }: { onNext: () => void }) {
  const { update } = usePoints();
  return (
    <Screen title="Where do you fly from?" sub="Search your city, state, zip or airport." footer={null}>
      <AirportSearch
        onPick={(a) => {
          update({ airport: a.code });
          track("airport_selected", { airport: a.code });
          window.setTimeout(onNext, 220);
        }}
      />
    </Screen>
  );
}

/** The cities shown on the picks screen: the brief's list, two more favorites, and the weekend hop. */
const FEATURED = ["Tokyo", "Paris", "Rome", "Maui", "Honolulu", "Cancún", "Los Cabos", "Costa Rica", "New York", "Seoul", "Sydney", "Bali", "London", "Santorini"];

function Picks({ onNext }: { onNext: () => void }) {
  const { state, update } = usePoints();
  const { input } = useDeck();
  const all = cityStatuses(input);
  const hop = hopFor(input.origin).city;
  const tiles = [...FEATURED, hop].map((c) => all.find((x) => x.city === c)).filter((x): x is NonNullable<typeof x> => !!x);
  const picks = state.picks;
  const finish = (p: string[]) => {
    update({ picks: p });
    track("picks_set", { picks: p.join(","), count: p.length });
    onNext();
  };
  return (
    <Screen
      title="Any trips in mind?"
      sub="Pick up to 3 and we'll put them first."
      footer={
        <>
          <PrimaryButton disabled={!picks.length} onClick={() => finish(picks)}>
            {picks.length ? `Find my trips (${picks.length})` : "Pick up to 3"}
          </PrimaryButton>
          <SecondaryButton onClick={() => finish([])}>I&apos;m flexible, show me everything</SecondaryButton>
        </>
      }
    >
      <div className="flex items-center gap-4 pb-3 text-[12.5px] font-semibold text-muted">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-trace-green" /> Your points cover it</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#FBBF24]" /> Points short</span>
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {tiles.map((c, i) => {
          const on = picks.includes(c.city);
          return (
            <button
              key={c.city}
              type="button"
              aria-pressed={on}
              aria-label={`${c.city}, ${c.ok ? "can book" : `${kShort(c.gap)} short`}`}
              onClick={() =>
                update((s) => ({
                  picks: on ? s.picks.filter((x) => x !== c.city) : s.picks.length >= 3 ? s.picks : [...s.picks, c.city],
                }))
              }
              style={stagger(i, 35)}
              className={cx(
                "rise relative aspect-[3/4] overflow-hidden rounded-3xl text-left text-white transition-transform duration-200 active:scale-95",
                on && "ring-[3px] ring-trace-pink ring-offset-2",
              )}
            >
              <TripThumb city={c.city} code={c.code} className={cx("absolute inset-0 transition-transform duration-500", on && "scale-110")} showCode={false} />
              <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
              <span className="absolute inset-x-0 bottom-0 flex flex-col gap-1 p-2.5">
                <span className="text-[15px] leading-tight font-extrabold">{c.city}</span>
                <span className="flex items-center gap-1.5 text-[11px] font-bold">
                  <span className={cx("h-2 w-2 rounded-full", c.ok ? "bg-trace-green" : "bg-[#FBBF24]")} />
                  {c.ok ? "Can book" : `${kShort(c.gap)} short`}
                </span>
              </span>
              {on && (
                <span className="check-in bg-trace absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full">
                  <Check size={12} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </Screen>
  );
}

function Loading({ onDone }: { onDone: () => void }) {
  const { state } = usePoints();
  const { values } = useDeck();
  const [i, setI] = useState(0);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const timers = [1, 2, 3, 4, 5].map((k) => window.setTimeout(() => setI(k), k * 600));
    timers.push(window.setTimeout(() => done.current(), 3500));
    return () => timers.forEach(clearTimeout);
  }, []);
  const banks = state.progs.filter((p) => PROGRAMS[p].kind === "bank").map((p) => PROGRAMS[p].short);
  const holders = (banks.length ? banks : state.progs.map((p) => PROGRAMS[p].short)).slice(0, 2);
  const lines = [
    `Reading ${holders.join(" and ")} transfer partners`,
    "Checking 11 airline programs",
    "Applying live transfer bonuses",
    `Pricing every trip from ${state.airport}`,
    "Finding the cheapest way to book each one",
  ];
  const path = "M 24 150 C 110 20, 250 20, 336 120";
  return (
    <div className="trace-wash flex min-h-dvh flex-col justify-center gap-7 px-7">
      <div className="relative h-[170px]" aria-hidden="true">
        <svg viewBox="0 0 360 170" className="absolute inset-0 h-full w-full">
          <path d={path} fill="none" stroke="#FD297B" strokeOpacity="0.35" strokeWidth="2.5" strokeDasharray="6 8" className="dash-move" />
          <circle cx="24" cy="150" r="6" fill="#FF655B" />
          <circle cx="336" cy="120" r="6" fill="#7C3AED" />
        </svg>
        <span
          className="absolute top-0 left-0 text-trace-pink"
          style={{ offsetPath: `path("${path}")`, offsetRotate: "auto 90deg", animation: "fly 2.4s ease-in-out infinite" } as React.CSSProperties}
        >
          <Icon d={ICONS.plane} size={30} stroke={1.5} />
        </span>
        <span className="nums absolute bottom-0 left-0 text-[13px] font-extrabold text-trace-red">{state.airport}</span>
        <span className="absolute right-0 bottom-6 text-[13px] font-extrabold text-violet">Anywhere</span>
      </div>
      <h1 className="text-[30px] leading-[1.1] font-extrabold tracking-[-0.02em]">
        Doing the math on <span className="text-gradient nums">{num(values.total)}</span> points…
      </h1>
      <ul className="flex flex-col gap-3.5" aria-live="polite">
        {lines.map((l, k) => (
          <li key={l} className={cx("flex items-center gap-3 text-[15.5px] font-medium transition-colors duration-300", k < i ? "text-ink" : "text-muted/60")}>
            <span className={cx("flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-all duration-300", k < i ? "bg-trace-green text-white" : "border-2 border-line")}>
              {k < i && <span className="check-in"><Check size={12} /></span>}
            </span>
            {l}
          </li>
        ))}
      </ul>
    </div>
  );
}

function FreeResults({ onPaywall }: { onPaywall: (reason: PayReason) => void }) {
  const { state, update } = usePoints();
  const [editing, setEditing] = useState(false);
  const [detail, setDetail] = useState<TripResult | null>(null);
  const [first] = useState(() => !state.resultsSeen);
  useEffect(() => {
    track("results_view");
    if (first) update({ resultsSeen: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (detail) {
    return (
      <div className="slide-in-right">
        <TripDetail r={detail} mode="free" onBack={() => setDetail(null)} onUnlock={() => onPaywall("locked")} />
      </div>
    );
  }
  return (
    <div className="flex min-h-dvh flex-col">
      {first && <Confetti />}
      <div className="flex items-center justify-between px-5 pt-4">
        <Logo className="h-5" />
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex min-h-[40px] items-center gap-1.5 rounded-full bg-soft px-3.5 text-[13.5px] font-bold active:scale-95"
        >
          <Icon d={ICONS.gear} size={15} /> Edit answers
        </button>
      </div>
      {editing && <EditAnswers onClose={() => setEditing(false)} />}
      <ResultsView
        mode="free"
        countUp={first}
        onOpen={(r) => {
          track("detail_free_view", { trip: r.trip.id });
          window.scrollTo(0, 0);
          setDetail(r);
        }}
        onPaywall={(reason) => onPaywall(reason)}
      />
    </div>
  );
}

/**
 * Free results used to be a dead end. This lets people jump back to any
 * answer (their answers are kept) or start over, while the rest stays locked.
 */
function EditAnswers({ onClose }: { onClose: () => void }) {
  const { state, update, reset } = usePoints();
  const { values } = useDeck();
  const rows: { step: FunnelStep; label: string; now: string; icon: string }[] = [
    { step: "progs", label: "Change my points", now: `${num(values.total)} points across ${plural(state.progs.length, "program")}`, icon: ICONS.wallet },
    { step: "air", label: "Change my airport", now: `Flying from ${state.airport}`, icon: ICONS.pin },
    { step: "picks", label: "Change my trip picks", now: state.picks.length ? state.picks.join(", ") : "Flexible, showing everything", icon: ICONS.heart },
  ];
  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-[480px] flex-col justify-end" role="dialog" aria-modal="true" aria-label="Edit your answers">
      <button type="button" aria-label="Close" onClick={onClose} className="fade absolute inset-0 bg-midnight/50" />
      <div className="sheet-up pb-safe-lg relative flex flex-col gap-2 rounded-t-[32px] bg-surface px-5 pt-3">
        <div className="mx-auto h-1.5 w-10 rounded-full bg-line" />
        <div className="pb-1 text-[20px] font-extrabold">Edit your answers</div>
        {rows.map((r) => (
          <button
            key={r.step}
            type="button"
            onClick={() => {
              update({ step: r.step });
              onClose();
            }}
            className="flex min-h-[64px] items-center gap-3 rounded-2xl bg-soft px-4 text-left active:scale-[0.99]"
          >
            <span className="bg-trace flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"><Icon d={r.icon} size={18} /></span>
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="text-[15.5px] font-bold">{r.label}</span>
              <span className="truncate text-[13px] text-muted">{r.now}</span>
            </span>
            <Icon d={ICONS.chevron} size={16} stroke={2.4} className="text-muted" />
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            reset();
            onClose();
          }}
          className="mt-1 min-h-[48px] text-[14.5px] font-bold text-muted"
        >
          Start over
        </button>
        <Link href="/contact?from=results" className="-mt-1 flex min-h-[44px] items-center justify-center gap-1.5 text-[14px] font-semibold text-muted">
          <Icon d={ICONS.mail} size={15} /> Questions? Contact us
        </Link>
      </div>
    </div>
  );
}

function Done({ onOpen }: { onOpen: () => void }) {
  const { state } = usePoints();
  const { deck } = useDeck();
  const { verified } = useAccount();
  // The account step: shown until they sign in with Google or an email link.
  const [linkSent, setLinkSent] = useState(false);
  const first = deck.find((r) => state.saved.includes(r.trip.id)) ?? deck.find((r) => state.picks.includes(r.trip.city)) ?? deck[0];
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-midnight text-white">
      <Confetti count={80} />
      {first && <TripThumb city={first.trip.city} code={first.trip.code} className="kenburns absolute inset-0 opacity-70" showCode={false} />}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/30 to-black/90" />
      <div className="relative mt-auto flex flex-col gap-5 px-7 pb-safe">
        <span className="check-in flex h-16 w-16 items-center justify-center rounded-3xl bg-trace-green text-white">
          <Check size={30} />
        </span>
        <h1 className="rise text-[42px] leading-[1.02] font-extrabold tracking-[-0.02em]">You&apos;re in.</h1>
        <p className="rise text-[17px] leading-relaxed text-white/90" style={stagger(2)}>
          {first
            ? `${first.trip.city} is first on your list. All ${plural(groupDestinations(deck).length, "destination")} are unlocked, with booking steps.`
            : `All ${plural(groupDestinations(deck).length, "destination")} are unlocked, with booking steps.`}
        </p>
        {verified ? (
          <>
            <div className="rise rounded-2xl border border-white/20 bg-white/10 p-4 text-[14px] leading-snug backdrop-blur" style={stagger(3)}>
              <span className="font-bold">On iPhone?</span> Tap Share, then &ldquo;Add to Home Screen&rdquo; so seat and bonus alerts can reach you.
            </div>
            <PrimaryButton onClick={onOpen}>Open Trace</PrimaryButton>
          </>
        ) : (
          <div className="rise flex flex-col gap-3 rounded-3xl border border-white/20 bg-black/35 p-5 backdrop-blur-md" style={stagger(3)}>
            <div className="flex flex-col gap-1">
              <span className="text-[20px] font-extrabold">Create your account</span>
              <span className="text-[14px] leading-snug text-white/80">So your trips, points and membership follow you to any device. No password needed.</span>
            </div>
            <SignInOptions dark email={state.email || undefined} onSignedIn={onOpen} onLinkSent={() => setLinkSent(true)} />
            <button type="button" onClick={onOpen} className="min-h-[40px] text-[14px] font-bold text-white/75">
              {linkSent ? "Open Trace" : "Skip for now"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
