"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AIRLINE_IDS, BANK_IDS, PROGRAMS, hopFor } from "@/engine/data";
import { cityStatuses } from "@/engine/engine";
import type { ProgramId, TripResult } from "@/engine/types";
import { track } from "@/lib/analytics";
import { groupDestinations } from "@/lib/destinations";
import { kShort, num, plural } from "@/lib/format";
import { type FunnelStep, usePoints, useDeck } from "@/lib/store";
import { Paywall } from "../Paywall";
import { ResultsView } from "../results/ResultsView";
import { TripDetail } from "../TripDetail";
import { TripThumb } from "../TripThumb";
import { Check, Confetti, cx, Eyebrow, Icon, ICONS, Logo, PrimaryButton, ProgramBadge, SecondaryButton, stagger } from "../ui";
import { AirportSearch } from "./AirportSearch";
import { BalanceCard } from "./BalanceCard";
import { Landing } from "./Landing";

const QUESTIONS: FunnelStep[] = ["progs", "bal", "air", "trav", "picks"];
const PREV: Partial<Record<FunnelStep, FunnelStep>> = { progs: "land", bal: "progs", air: "bal", trav: "air", picks: "trav" };

export function Funnel() {
  const { state, update, ready } = usePoints();
  const router = useRouter();
  const step = state.step;
  const go = (s: FunnelStep) => update({ step: s });

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
        <div className="sticky top-0 z-30 flex items-center gap-3.5 bg-white/90 px-5 pt-4 pb-3 backdrop-blur">
          <button
            type="button"
            aria-label="Back"
            onClick={() => go(PREV[step] ?? "land")}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-soft active:scale-95"
          >
            <Icon d={ICONS.back} size={18} stroke={2.4} />
          </button>
          <div className="flex flex-1 gap-1.5" role="progressbar" aria-valuemin={0} aria-valuemax={5} aria-valuenow={q + 1} aria-label={`Step ${q + 1} of 5`}>
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
      {step === "air" && <AirportStep onNext={() => go("trav")} />}
      {step === "trav" && <Travelers onNext={() => go("picks")} />}
      {step === "picks" && <Picks onNext={() => go("load")} />}
      {step === "load" && <Loading onDone={() => go("email")} />}
      {step === "email" && <EmailStep onNext={() => go("results")} />}
      {step === "results" && <FreeResults onPaywall={() => go("pay")} />}
      {step === "pay" && <Paywall onClose={() => go("results")} onStart={() => go("done")} />}
      {step === "done" && <Done onOpen={() => router.push("/discover")} />}
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
      {footer && <div className="pb-safe sticky bottom-0 flex flex-col gap-2 bg-gradient-to-t from-white from-70% to-white/0 pt-6">{footer}</div>}
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
        on ? "bg-white shadow-[0_0_0_2.5px_#FD297B,0_10px_24px_rgba(253,41,123,0.18)]" : "bg-soft",
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
      <div className="grid grid-cols-3 gap-2.5">{AIRLINE_IDS.map((id, i) => <ProgramTile key={id} id={id} i={i + 5} />)}</div>
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
          <div className="flex items-center justify-between rounded-2xl bg-midnight px-5 py-3.5 text-white">
            <span className="text-[14px] font-semibold text-white/70">Total points</span>
            <span className="nums text-[22px] font-extrabold">{num(values.total)}</span>
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
            <BalanceCard id={id} />
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

function Travelers({ onNext }: { onNext: () => void }) {
  const { state, update } = usePoints();
  const n = state.travelers;
  const set = (v: number) => update({ travelers: Math.max(1, Math.min(6, v)) });
  return (
    <Screen
      title="Who's coming with you?"
      sub="We'll price every trip for your whole crew."
      footer={
        <PrimaryButton
          onClick={() => {
            track("travelers_set", { travelers: n });
            onNext();
          }}
        >
          Price trips for {plural(n, "traveler")}
        </PrimaryButton>
      }
    >
      <div className="rise flex flex-col items-center gap-6 rounded-[28px] bg-gradient-to-br from-[#FFF1F3] via-[#FDF2FF] to-[#EEF6FF] px-5 py-8">
        <div className="flex w-full items-center justify-between">
          <button type="button" aria-label="Fewer travelers" disabled={n <= 1} onClick={() => set(n - 1)} className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm active:scale-90 disabled:opacity-40">
            <Icon d={ICONS.minus} size={26} stroke={2.6} />
          </button>
          <div className="flex flex-col items-center" aria-live="polite">
            <span key={n} className="pop text-gradient nums text-[76px] leading-none font-extrabold">{n}</span>
            <span className="text-[14px] font-semibold text-muted">{n === 1 ? "traveler" : "travelers"}</span>
          </div>
          <button type="button" aria-label="More travelers" disabled={n >= 6} onClick={() => set(n + 1)} className="bg-trace flex h-16 w-16 items-center justify-center rounded-full text-white shadow-[0_8px_20px_rgba(253,41,123,0.35)] active:scale-90 disabled:opacity-40">
            <Icon d={ICONS.plus} size={26} stroke={2.6} />
          </button>
        </div>
        <div className="flex gap-1.5" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5].map((k) => (
            <span key={k} className={cx("transition-all duration-300", k < n ? "scale-100 text-trace-pink" : "scale-90 text-[#D5D8E0]")}>
              <Icon d={ICONS.person} size={30} />
            </span>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 pt-5">
        {[
          [1, "Solo"],
          [2, "Couple"],
          [3, "Family of 3"],
          [4, "Family of 4"],
        ].map(([v, label]) => (
          <button
            key={label}
            type="button"
            aria-pressed={n === v}
            onClick={() => set(v as number)}
            className={cx("min-h-[46px] rounded-full border px-4 text-[15px] font-bold transition active:scale-95", n === v ? "border-ink bg-ink text-white" : "border-line")}
          >
            {label}
          </button>
        ))}
      </div>
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
    `Pricing trips from ${state.airport} for ${state.travelers === 1 ? "you" : plural(state.travelers, "traveler")}`,
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
          <li key={l} className={cx("flex items-center gap-3 text-[15.5px] font-medium transition-colors duration-300", k < i ? "text-ink" : "text-[#B3B8C4]")}>
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

function EmailStep({ onNext }: { onNext: () => void }) {
  const { state, update } = usePoints();
  const { deck } = useDeck();
  const dests = groupDestinations(deck);
  const ok = dests.filter((d) => d.ok);
  const near = dests.filter((d) => !d.ok);
  const [email, setEmail] = useState(state.email);
  const valid = /.+@.+\..+/.test(email);
  const head = ok.length ? `We found ${plural(ok.length, "destination")} you can book today.` : `We found ${plural(near.length, "destination")} you're close to.`;
  const sub = ok.length && near.length ? `Plus ${near.length} you're close to. Where should we send your list?` : "Where should we send your list?";
  const submit = () => {
    if (!valid) return;
    update({ email });
    track("email_captured", { trips: ok.length + near.length });
    onNext();
  };
  return (
    <Screen
      title={head}
      sub={sub}
      icon={
        <span className="check-in bg-trace flex h-16 w-16 items-center justify-center rounded-3xl text-white shadow-[0_10px_28px_rgba(253,41,123,0.35)]">
          <Icon d={ICONS.sparkle} size={30} stroke={2.2} />
        </span>
      }
      footer={
        <>
          <PrimaryButton disabled={!valid} onClick={submit}>
            See my trips
          </PrimaryButton>
          <button type="button" onClick={onNext} className="min-h-[44px] text-[14px] font-semibold text-muted">
            Skip for now
          </button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex flex-col gap-2 pt-1"
      >
        <label htmlFor="email" className="text-[13px] font-bold text-muted">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="min-h-[58px] rounded-2xl border border-line bg-soft px-4 text-[17px] outline-none focus:border-trace-pink focus:bg-white"
        />
      </form>
    </Screen>
  );
}

function FreeResults({ onPaywall }: { onPaywall: () => void }) {
  const { state, update } = usePoints();
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
        <TripDetail r={detail} mode="free" onBack={() => setDetail(null)} onUnlock={onPaywall} />
      </div>
    );
  }
  return (
    <div className="flex min-h-dvh flex-col">
      {first && <Confetti />}
      <div className="flex items-center px-5 pt-5">
        <Logo className="h-5" />
      </div>
      <ResultsView
        mode="free"
        countUp={first}
        onOpen={(r) => {
          track("detail_free_view", { trip: r.trip.id });
          window.scrollTo(0, 0);
          setDetail(r);
        }}
        onPaywall={() => onPaywall()}
      />
    </div>
  );
}

function Done({ onOpen }: { onOpen: () => void }) {
  const { state } = usePoints();
  const { deck } = useDeck();
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
        <div className="rise rounded-2xl border border-white/20 bg-white/10 p-4 text-[14px] leading-snug backdrop-blur" style={stagger(3)}>
          <span className="font-bold">On iPhone?</span> Tap Share, then &ldquo;Add to Home Screen&rdquo; so seat and bonus alerts can reach you.
        </div>
        <PrimaryButton onClick={onOpen}>Open Trace</PrimaryButton>
      </div>
    </div>
  );
}
