"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AIRLINE_IDS, BANK_IDS, PROGRAMS } from "@/engine/data";
import { cityStatuses } from "@/engine/engine";
import type { ProgramId, TripResult } from "@/engine/types";
import { track } from "@/lib/analytics";
import { kShort, num, plural } from "@/lib/format";
import { type FunnelStep, usePoints, useDeck } from "@/lib/store";
import { Paywall } from "../Paywall";
import { ResultsView } from "../results/ResultsView";
import { TripDetail } from "../TripDetail";
import { TripThumb } from "../TripThumb";
import { Check, cx, Eyebrow, Icon, ICONS, Logo, PrimaryButton, ProgramBadge, SecondaryButton } from "../ui";
import { AirportSearch } from "./AirportSearch";
import { BalanceCard } from "./BalanceCard";

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

  if (!ready) return <div className="min-h-dvh" />;

  const q = QUESTIONS.indexOf(step);
  return (
    <div className="flex min-h-dvh flex-col">
      {q >= 0 && (
        <div className="sticky top-0 z-30 flex items-center gap-3.5 bg-white px-5 pt-4 pb-2">
          <button
            type="button"
            aria-label="Back"
            onClick={() => go(PREV[step] ?? "land")}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line"
          >
            <Icon d={ICONS.back} size={18} />
          </button>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-soft" role="progressbar" aria-valuemin={0} aria-valuemax={5} aria-valuenow={q + 1}>
            <div className="h-full rounded-full bg-gradient-to-r from-trace-red to-trace-pink transition-[width] duration-300" style={{ width: `${((q + 1) / 5) * 100}%` }} />
          </div>
          <div className="w-10 text-right text-[13px] text-muted">{q + 1} of 5</div>
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
    <div className={cx("rise flex flex-1 flex-col px-5", icon ? "pt-14" : "pt-3")}>
      <div className="flex flex-col gap-1.5 pb-4">
        {icon && <div className="pb-3">{icon}</div>}
        <h1 className="text-[30px] leading-[1.1] font-black">{title}</h1>
        {sub && <p className="text-[15.5px] text-muted">{sub}</p>}
      </div>
      <div className="flex flex-1 flex-col">{children}</div>
      <div className="pb-safe sticky bottom-0 flex flex-col gap-2 bg-gradient-to-t from-white via-white to-white/0 pt-4">{footer}</div>
    </div>
  );
}

function Landing({ onStart }: { onStart: () => void }) {
  useEffect(() => {
    track("landing_view");
  }, []);
  return (
    <div className="trace-wash flex min-h-dvh flex-col justify-between px-6 pt-8 pb-8">
      <Logo className="h-6 self-start" />
      <div className="rise flex flex-col gap-4 py-10">
        <h1 className="text-[46px] leading-[1.0] font-black tracking-tight">You&apos;re sitting on a free flight.</h1>
        <p className="text-[17px] leading-relaxed text-[#4A4A4A]">
          Tell us your cards and balances. We&apos;ll do the math across every airline partner and show you exactly what you can book from your airport.
        </p>
        <div className="flex flex-col gap-2.5 rounded-2xl border border-line bg-white/80 p-4 shadow-sm">
          <Eyebrow>What points book, one way, typical</Eyebrow>
          {[
            ["12,500", "Hawaii in economy"],
            ["22,500", "New York in lie-flat"],
            ["52,500", "Tokyo in ANA business"],
          ].map(([p, t]) => (
            <div key={t} className="flex items-center justify-between gap-3 text-[15px]">
              <span className="font-mono font-bold text-trace-red">{p}</span>
              <span className="text-right font-semibold">{t}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        <PrimaryButton onClick={onStart}>See what my points can book</PrimaryButton>
        <div className="text-center text-[13px] text-muted">60 seconds · No card needed · No logins</div>
      </div>
    </div>
  );
}

function ProgramTile({ id }: { id: ProgramId }) {
  const { state, update } = usePoints();
  const on = state.progs.includes(id);
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => update((s) => ({ progs: on ? s.progs.filter((x) => x !== id) : [...s.progs, id] }))}
      className={cx(
        "relative flex min-h-[104px] flex-col items-center justify-center gap-2 rounded-2xl px-1.5 py-3 text-center transition",
        on ? "border-2 border-trace-red bg-trace-red/[0.07]" : "border border-line bg-white",
      )}
    >
      <ProgramBadge id={id} />
      <span className="text-[14px] leading-tight font-bold">{PROGRAMS[id].short}</span>
      {on && (
        <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-trace-red text-white">
          <Check size={11} />
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
      sub="Pick everything you've got. We'll combine them."
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
      <Eyebrow className="pb-2.5">Credit card points</Eyebrow>
      <div className="grid grid-cols-3 gap-2.5">{BANK_IDS.map((id) => <ProgramTile key={id} id={id} />)}</div>
      <Eyebrow className="pt-5 pb-2.5">Airline miles</Eyebrow>
      <div className="grid grid-cols-3 gap-2.5">{AIRLINE_IDS.map((id) => <ProgramTile key={id} id={id} />)}</div>
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
          <div className="flex items-center justify-between rounded-[14px] bg-soft px-4 py-3">
            <span className="text-[14px] font-semibold text-muted">Total points</span>
            <span className="font-mono text-[20px] font-bold">{num(values.total)}</span>
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
      <div className="flex flex-col gap-3">{state.progs.map((id) => <BalanceCard key={id} id={id} />)}</div>
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
          window.setTimeout(onNext, 200);
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
      <div className="flex flex-col items-center gap-5 rounded-3xl bg-soft px-5 py-7">
        <div className="flex w-full items-center justify-between">
          <button type="button" aria-label="Fewer travelers" disabled={n <= 1} onClick={() => set(n - 1)} className="flex h-16 w-16 items-center justify-center rounded-full border border-line bg-white disabled:opacity-40">
            <Icon d={ICONS.minus} size={26} stroke={2.6} />
          </button>
          <div className="flex flex-col items-center" aria-live="polite">
            <span className="bg-gradient-to-r from-trace-red to-trace-pink bg-clip-text text-[68px] leading-none font-black text-transparent">{n}</span>
            <span className="text-[14px] text-muted">{n === 1 ? "traveler" : "travelers"}</span>
          </div>
          <button type="button" aria-label="More travelers" disabled={n >= 6} onClick={() => set(n + 1)} className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-trace-red to-trace-pink text-white disabled:opacity-40">
            <Icon d={ICONS.plus} size={26} stroke={2.6} />
          </button>
        </div>
        <div className="flex gap-1.5" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span key={i} className={i < n ? "text-trace-red" : "text-[#D4D4D4]"}>
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
            className={cx("min-h-[44px] rounded-full border px-4 text-[15px] font-bold", n === v ? "border-trace-red bg-trace-red text-white" : "border-line")}
          >
            {label}
          </button>
        ))}
      </div>
    </Screen>
  );
}

function Picks({ onNext }: { onNext: () => void }) {
  const { state, update } = usePoints();
  const { input } = useDeck();
  const tiles = cityStatuses(input);
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
            {picks.length ? "Find my trips" : "Pick up to 3"}
          </PrimaryButton>
          <SecondaryButton onClick={() => finish([])}>I&apos;m flexible, show me everything</SecondaryButton>
        </>
      }
    >
      <div className="grid grid-cols-3 gap-2.5">
        {tiles.map((c) => {
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
              className={cx(
                "relative aspect-[4/5] overflow-hidden rounded-2xl text-left text-white",
                on && "ring-[3px] ring-trace-red ring-offset-2",
              )}
            >
              <TripThumb city={c.city} code={c.code} className="absolute inset-0" showCode={false} />
              <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/10" />
              <span className="absolute inset-x-0 bottom-0 flex flex-col gap-1 p-2.5">
                <span className="text-[15px] leading-tight font-black">{c.city}</span>
                <span className="flex items-center gap-1.5 text-[11px] font-bold">
                  <span className={cx("h-2 w-2 rounded-full", c.ok ? "bg-trace-green" : "bg-[#FBBF24]")} />
                  {c.ok ? "Can book" : `${kShort(c.gap)} short`}
                </span>
              </span>
              {on && (
                <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-trace-red">
                  <Check size={11} />
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
  return (
    <div className="flex min-h-dvh flex-col justify-center gap-7 px-8">
      <span className="pulse-soft text-trace-red"><Icon d={ICONS.plane} size={56} stroke={1.8} /></span>
      <h1 className="text-[30px] leading-[1.1] font-black">Doing the math on {num(values.total)} points…</h1>
      <ul className="flex flex-col gap-3.5" aria-live="polite">
        {lines.map((l, k) => (
          <li key={l} className={cx("flex items-center gap-3 text-[15.5px] transition-colors", k < i ? "text-ink" : "text-[#B3B3B3]")}>
            <span className={cx("flex h-6 w-6 shrink-0 items-center justify-center rounded-full", k < i ? "bg-trace-green text-white" : "border-2 border-line")}>
              {k < i && <Check size={12} />}
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
  const { ok, near } = useDeck();
  const [email, setEmail] = useState(state.email);
  const valid = /.+@.+\..+/.test(email);
  const head = ok.length ? `We found ${plural(ok.length, "trip")} you can book today.` : `We found ${plural(near.length, "trip")} you're close to.`;
  const sub = ok.length && near.length ? `Plus ${near.length} you're close to. Where should we send your list?` : "Where should we send your list?";
  return (
    <Screen
      title={head}
      sub={sub}
      icon={
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-trace-green text-white">
          <Check size={26} />
        </span>
      }
      footer={
        <>
          <PrimaryButton
            disabled={!valid}
            onClick={() => {
              update({ email });
              track("email_captured", { trips: ok.length + near.length });
              onNext();
            }}
          >
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
          if (!valid) return;
          update({ email });
          track("email_captured", { trips: ok.length + near.length });
          onNext();
        }}
        className="flex flex-col gap-2 pt-2"
      >
        <label htmlFor="email" className="text-[13px] font-bold text-muted">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="min-h-[56px] rounded-[14px] border border-line bg-soft px-4 text-[17px] outline-none focus:border-trace-red focus:bg-white"
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
      <div className="rise">
        <TripDetail r={detail} mode="free" onBack={() => setDetail(null)} onUnlock={onPaywall} />
      </div>
    );
  }
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="flex items-center px-5 pt-4">
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
  const first = deck.find((r) => state.saved.includes(r.trip.id)) ?? deck.find((r) => state.picks.includes(r.trip.city));
  return (
    <div className="rise flex min-h-dvh flex-col justify-center gap-5 px-7">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-trace-green text-white">
        <Check size={30} />
      </span>
      <h1 className="text-[38px] leading-[1.05] font-black">You&apos;re in.</h1>
      <p className="text-[16px] leading-relaxed text-[#4A4A4A]">
        {first
          ? `${first.trip.city} is first on your list. All ${plural(deck.length, "trip")} are unlocked, with booking steps.`
          : `All ${plural(deck.length, "trip")} are unlocked, with booking steps.`}
      </p>
      <div className="rounded-2xl bg-soft p-4 text-[14px] leading-snug">
        <span className="font-bold">On iPhone?</span> Tap Share, then &ldquo;Add to Home Screen&rdquo; so seat and bonus alerts can reach you.
      </div>
      <PrimaryButton onClick={onOpen}>Open Trace</PrimaryButton>
    </div>
  );
}
