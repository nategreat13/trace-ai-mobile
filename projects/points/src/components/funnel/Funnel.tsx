"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AIRLINE_IDS, BANK_IDS, HOTEL_IDS, PROGRAMS, hopFor } from "@/engine/data";
import { evalAll } from "@/engine/engine";
import type { ProgramId, TripResult } from "@/engine/types";
import { track } from "@/lib/analytics";
import { groupDestinations } from "@/lib/destinations";
import { milesTotal, tierFor } from "@/lib/tiers";
import { money, num, plural } from "@/lib/format";
import { useAccount } from "@/lib/account";
import { effectiveBalances, type FunnelStep, STARTER, usePoints, useDeck } from "@/lib/store";
import { shownReviews } from "@/lib/reviews";
import { useBackClose } from "@/lib/useBackClose";
import { GiftButton, GiftOffer } from "../GiftOffer";
import { PasswordCreate, SignInOptions } from "../SignInOptions";
import { Paywall, ReviewsPage } from "../Paywall";
import { ResultsView, type PayReason } from "../results/ResultsView";
import { TripDetail } from "../TripDetail";
import { TripThumb } from "../TripThumb";
import { Check, Confetti, cx, Eyebrow, Icon, ICONS, Logo, PrimaryButton, ProgramBadge, stagger } from "../ui";
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

  // Saw the price and left the paywall (its close button or browser back): offer the gift once.
  const [exitGift, setExitGift] = useState(false);
  const prevStep = useRef(step);
  useEffect(() => {
    if (prevStep.current === "pay" && step === "results" && !state.giftOffered && !state.member) setExitGift(true);
    prevStep.current = step;
  }, [step, state.giftOffered, state.member]);

  // Browser back walks back through the funnel instead of leaving the site.
  useEffect(() => {
    if (!ready) return;
    if (window.history.state?.step !== step) {
      // A new step's entry never carries an open overlay's marker (useBackClose), or closing that overlay would pop it.
      const { overlay: _overlay, ...rest } = window.history.state ?? {};
      window.history.pushState({ ...rest, step }, "");
    }
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

  // Before the saved answers load (and in the server HTML), show the landing
  // page: it's what a new visitor from an ad sees, so it appears instantly
  // instead of a blank screen while the JavaScript downloads.
  // Same shape as the landing branch below, so it stays the same element once ready.
  if (!ready) {
    return (
      <div className="flex min-h-dvh flex-col">
        {false}
        <Landing onStart={() => go("progs")} />
      </div>
    );
  }

  const q = QUESTIONS.indexOf(step);
  return (
    <div className="flex min-h-dvh flex-col">
      {q >= 0 && (
        <div className="sticky top-0 z-30 flex items-center gap-3.5 bg-surface/90 px-5 pt-4 pb-3 backdrop-blur">
          <button
            type="button"
            aria-label="Back"
            onClick={() => go(step === "air" && state.starter ? "progs" : (PREV[step] ?? "land"))}
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
      {step === "progs" && <Programs onNext={() => go("bal")} onStarter={() => go("air")} />}
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
      {step === "pay" && (
        <Paywall reason={payReason} onClose={() => go("results")} onStart={() => (shownReviews().length ? go("reviews") : router.push("/checkout"))} />
      )}
      {step === "reviews" && <ReviewsPage onBack={() => go("pay")} onContinue={() => router.push("/checkout")} />}
      {step === "done" && <Done onOpen={() => router.push("/discover")} />}
      {step === "results" && !exitGift && (
        <GiftButton
          onPaywall={() => {
            setPayReason("cta");
            go("pay");
          }}
        />
      )}
      {exitGift && step === "results" && (
        <GiftOffer
          where="paywall"
          onClaim={() => {
            setExitGift(false);
            go("pay");
          }}
          onDecline={() => setExitGift(false)}
        />
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
        "rise relative flex min-h-[80px] flex-col items-center justify-center gap-1.5 rounded-2xl px-0.5 py-2 text-center transition-all duration-200 active:scale-95",
        on ? "bg-surface shadow-[0_0_0_2.5px_#FD297B,0_10px_24px_rgba(253,41,123,0.18)]" : "bg-soft",
      )}
    >
      <span className={cx("transition-transform duration-200", on && "scale-110")}>
        <ProgramBadge id={id} size={36} />
      </span>
      <span className="text-[11px] leading-tight font-bold">{PROGRAMS[id].short}</span>
      {on && (
        <span className="check-in bg-trace absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full text-white">
          <Check size={10} />
        </span>
      )}
    </button>
  );
}

function Programs({ onNext, onStarter }: { onNext: () => void; onStarter: () => void }) {
  const { state, update } = usePoints();
  // Back here from the "no points yet" path: start clean, so the stand-in bonus isn't mistaken for their own.
  useEffect(() => {
    if (state.starter) update({ starter: false, progs: [], balances: {}, estimated: {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const n = state.progs.length;
  return (
    <Screen
      title="Which points do you have?"
      sub="Tap all that apply."
      footer={
        <>
          <PrimaryButton
            disabled={!n}
            onClick={() => {
              track("programs_selected", { programs: state.progs.join(","), count: n });
              onNext();
            }}
          >
            {n ? "Continue" : "Tap at least one"}
          </PrimaryButton>
          {!n && (
            <button
              type="button"
              onClick={() => {
                track("programs_selected", { programs: "none", count: 0, starter: true });
                update({ starter: true, progs: [STARTER.program], balances: { [STARTER.program]: STARTER.points }, estimated: {} });
                onStarter();
              }}
              className="min-h-[48px] rounded-2xl text-[15px] font-bold text-muted active:bg-soft"
            >
              I don&apos;t have points yet
            </button>
          )}
        </>
      }
    >
      <Eyebrow className="pb-2">Credit cards</Eyebrow>
      <div className="grid grid-cols-5 gap-1.5">{BANK_IDS.map((id, i) => <ProgramTile key={id} id={id} i={i} />)}</div>
      <Eyebrow className="pt-4 pb-2">Airlines</Eyebrow>
      <div className="grid grid-cols-5 gap-1.5">{AIRLINE_IDS.map((id, i) => <ProgramTile key={id} id={id} i={i + BANK_IDS.length} />)}</div>
      {HOTEL_IDS.length > 0 && (
        <>
          <Eyebrow className="pt-4 pb-2">Hotels</Eyebrow>
          <div className="grid grid-cols-5 gap-1.5">
            {HOTEL_IDS.map((id, i) => <ProgramTile key={id} id={id} i={i + BANK_IDS.length + AIRLINE_IDS.length} />)}
          </div>
        </>
      )}
    </Screen>
  );
}

function BalancesStep({ onNext }: { onNext: () => void }) {
  const { state, update } = usePoints();
  const { values } = useDeck();
  // Start every program at a typical balance, so Continue works straight away
  // and nobody has to leave to look a number up. Typing one replaces it.
  useEffect(() => {
    const missing = state.progs.filter((id) => !state.estimated[id] && !((Number(state.balances[id]) || 0) > 0));
    if (missing.length) update((s) => ({ estimated: { ...s.estimated, ...Object.fromEntries(missing.map((id) => [id, true])) } }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const ok = state.progs.length > 0 && state.progs.every((id) => state.estimated[id] || (Number(state.balances[id]) || 0) > 0);
  return (
    <Screen
      title="How many points?"
      sub="A rough guess works."
      footer={
        <>
          <div
            className="flex items-center justify-between rounded-2xl px-5 py-3 text-white transition-[background] duration-700"
            style={{ background: values.total ? tierFor(milesTotal(effectiveBalances(state))).gradient : "#0F1730" }}
          >
            <span className="flex flex-col leading-tight">
              <span className="nums text-[13px] font-semibold text-white/80">{num(values.total)} points</span>
              {values.total > 0 && (
                <span key={tierFor(milesTotal(effectiveBalances(state))).level} className="pop text-[12.5px] font-extrabold">
                  {tierFor(milesTotal(effectiveBalances(state))).label}
                </span>
              )}
            </span>
            {/* Dollars lead from here on: the same number shows on results, the paywall and checkout. */}
            <span className="flex flex-col items-end leading-tight">
              <span key={Math.round(values.flights / 100)} className="pop nums text-[24px] font-extrabold">{money(values.flights)}</span>
              <span className="text-[12px] font-semibold text-white/80">in flights</span>
            </span>
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
  // Our best guess from their location, offered as one tap above the search.
  const [near, setNear] = useState<{ code: string; city: string; state: string } | null>(null);
  useEffect(() => {
    fetch(`/api/nearby-airport${window.location.search}`)
      .then((r) => r.json())
      .then((j: { airport: typeof near }) => setNear(j.airport))
      .catch(() => {});
  }, []);
  const pick = (code: string, how: string) => {
    update({ airport: code });
    track("airport_selected", { airport: code, how });
    window.setTimeout(onNext, 220);
  };
  return (
    <Screen title="Where do you fly from?" sub="City, zip or airport." footer={null}>
      {near && (
        <button
          type="button"
          onClick={() => pick(near.code, "suggested")}
          className="rise mb-4 flex min-h-[72px] items-center gap-3 rounded-2xl bg-surface px-4 text-left shadow-[0_0_0_2px_#FD297B,0_10px_24px_rgba(253,41,123,0.15)] active:scale-[0.99]"
        >
          <span className="bg-trace flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[13px] font-extrabold text-white">{near.code}</span>
          <span className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="text-[17px] font-extrabold">Flying from {near.city}?</span>
            <span className="text-[13px] text-muted">Tap to use {near.code}</span>
          </span>
          <Icon d={ICONS.chevron} size={18} stroke={2.4} className="text-trace-pink" />
        </button>
      )}
      <AirportSearch onPick={(a) => pick(a.code, "search")} />
    </Screen>
  );
}

/**
 * One tap on a kind of trip, and results lead with it. Six photo tiles fill
 * one screen with no scrolling; "Surprise me" leaves the ranking to value.
 */
const VIBES: { id: string; label: string; photo: string; match?: (t: TripResult["trip"]) => boolean }[] = [
  { id: "beach", label: "Beaches", photo: "Maui", match: (t) => t.kind === "beach" },
  { id: "europe", label: "Europe", photo: "Paris", match: (t) => t.region === "Europe" },
  { id: "asia", label: "Asia", photo: "Tokyo", match: (t) => t.region === "Asia" },
  { id: "city", label: "Big cities", photo: "New York", match: (t) => t.kind === "city" && !t.international },
  { id: "nature", label: "Mountains", photo: "Banff", match: (t) => t.kind === "nature" },
  { id: "any", label: "Surprise me", photo: "Santorini" },
];

function Picks({ onNext }: { onNext: () => void }) {
  const { update } = usePoints();
  const { input } = useDeck();
  const [chosen, setChosen] = useState<string | null>(null);
  const pick = (v: (typeof VIBES)[number]) => {
    // The vibe's trips they can book come first, then the closest ones; five is plenty to lead the list.
    const trips = v.match ? evalAll(input).filter((r) => v.match!(r.trip)).sort((a, b) => Number(b.ok) - Number(a.ok) || a.gap - b.gap) : [];
    const picks = [...new Set(trips.map((r) => r.trip.city))].slice(0, 5);
    setChosen(v.id);
    update({ picks });
    track("picks_set", { vibe: v.id, picks: picks.join(","), count: picks.length });
    window.setTimeout(onNext, 260);
  };
  return (
    <Screen title="What sounds good?" footer={null}>
      <div className="grid flex-1 grid-cols-2 grid-rows-3 gap-2.5 pb-safe max-h-[calc(100dvh-190px)]">
        {VIBES.map((v, i) => (
          <button
            key={v.id}
            type="button"
            onClick={() => pick(v)}
            style={stagger(i, 45)}
            className={cx(
              "rise relative min-h-[120px] overflow-hidden rounded-3xl text-left text-white transition-transform duration-200 active:scale-95",
              chosen === v.id && "ring-[3px] ring-trace-pink ring-offset-2",
            )}
          >
            <TripThumb city={v.photo} code="" className="absolute inset-0" showCode={false} />
            <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
            <span className="absolute inset-x-0 bottom-0 p-3 text-[19px] leading-tight font-extrabold">{v.label}</span>
          </button>
        ))}
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
    const timers = [1, 2, 3].map((k) => window.setTimeout(() => setI(k), k * 700));
    timers.push(window.setTimeout(() => done.current(), 2700));
    return () => timers.forEach(clearTimeout);
  }, []);
  const banks = state.progs.filter((p) => PROGRAMS[p].kind === "bank").map((p) => PROGRAMS[p].short);
  const holders = (banks.length ? banks : state.progs.map((p) => PROGRAMS[p].short)).slice(0, 2);
  const lines = [`Checking ${holders.join(" + ")} partners`, "Adding transfer bonuses", `Pricing trips from ${state.airport}`];
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
        Turning <span className="text-gradient nums">{num(values.total)}</span> points into flights…
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
  useBackClose(!!detail, () => setDetail(null));
  useBackClose(editing, () => setEditing(false));
  const [first] = useState(() => !state.resultsSeen);
  useEffect(() => {
    track("results_view");
    if (first) {
      track("funnel_complete");
      update({ resultsSeen: true });
    }
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
      <div className="flex items-center justify-between px-5 pt-5 pb-1">
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
    { step: "picks", label: "Change my trip style", now: state.picks.length ? state.picks.slice(0, 3).join(", ") : "Surprise me", icon: ICONS.heart },
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
  const { email, verified, hasPassword } = useAccount();
  // The account step: one password field, shown until they have a password.
  // Checkout signs brand-new accounts in, so the password goes on that session
  // with the email already filled. An existing account isn't signed in by
  // checkout, so it has to prove the email first (Google or the link).
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
          All {plural(groupDestinations(deck).length, "trip")} unlocked ✈️
        </p>
        {verified || hasPassword ? (
          <>
            <div className="rise rounded-2xl border border-white/20 bg-white/10 p-4 text-[14px] leading-snug backdrop-blur" style={stagger(3)}>
              <span className="font-bold">On iPhone?</span> Tap Share, then &ldquo;Add to Home Screen&rdquo; so seat and bonus alerts can reach you.
            </div>
            <PrimaryButton onClick={onOpen}>Open Trace</PrimaryButton>
          </>
        ) : (
          <div className="rise flex flex-col gap-3 rounded-3xl border border-white/20 bg-black/35 p-5 backdrop-blur-md" style={stagger(3)}>
            {/* Signed in by checkout (a new account): just a password. Otherwise the email has to be proven first, with one link. */}
            <span className="text-[20px] font-extrabold">{email ? "Set your password" : "Confirm your email"}</span>
            {email ? (
              <PasswordCreate dark email={email} cta="Save & open Trace" onDone={onOpen} />
            ) : (
              <SignInOptions dark linkOnly email={state.email || undefined} onSignedIn={onOpen} onLinkSent={() => setLinkSent(true)} />
            )}
            <button type="button" onClick={onOpen} className="min-h-[40px] text-[14px] font-bold text-white/75">
              {linkSent ? "Open Trace" : "Skip for now"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
