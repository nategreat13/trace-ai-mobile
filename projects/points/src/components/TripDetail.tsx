"use client";

import { useState } from "react";
import { PROGRAMS } from "@/engine/data";
import type { AwardProgramId, ProgramId, TripResult } from "@/engine/types";
import { track } from "@/lib/analytics";
import { money, num } from "@/lib/format";
import { creditFor } from "@/lib/images";
import { usePoints } from "@/lib/store";
import { finePrint } from "@/lib/tripText";
import { useCashDeals } from "@/lib/cashDeals";
import { centsPerPoint, cppLabel } from "@/lib/value";
import { CashDealStrip } from "./results/Insights";
import { CardOfferLink } from "./CardOffer";
import { cabinLabel } from "./results/DestinationCard";
import { TripThumb } from "./TripThumb";
import { CabinBadge, Check, Confetti, cx, Icon, ICONS, LockIcon, ProgramBadge, StatusPill, stagger } from "./ui";

/** Airline programs Trace prices but nobody holds directly (no logo file): a colored code instead. */
const AWARD_ONLY: Partial<Record<AwardProgramId, { code: string; color: string }>> = {
  turkish: { code: "TK", color: "#C8102E" },
  kris: { code: "SQ", color: "#F2A900" },
};

function AwardBadge({ program, size = 44 }: { program: AwardProgramId; size?: number }) {
  if (program in PROGRAMS) return <ProgramBadge id={program as ProgramId} size={size} />;
  const a = AWARD_ONLY[program] ?? { code: program.slice(0, 2).toUpperCase(), color: "#475569" };
  return (
    <span
      aria-hidden="true"
      className="nums inline-flex shrink-0 items-center justify-center font-extrabold text-white"
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.26), background: a.color, fontSize: Math.round(size * 0.32) }}
    >
      {a.code}
    </span>
  );
}

type StepKind = "search" | "move" | "use" | "book";

interface Step {
  kind: StepKind;
  title: string;
  sub: string;
  bonus?: number;
  link?: { label: string; href: string };
}

const STEP_LOOK: Record<StepKind, { icon: string; color: string }> = {
  search: { icon: ICONS.search, color: "#0EA5E9" },
  move: { icon: ICONS.bonus, color: "#7C3AED" },
  use: { icon: ICONS.wallet, color: "#14B8A6" },
  book: { icon: ICONS.plane, color: "#FD297B" },
};

function bookingSteps(r: TripResult, origin: string): Step[] {
  const p = r.best.partner;
  const steps: Step[] = [
    {
      kind: "search",
      title: "Find the seat",
      sub: `${origin} → ${r.trip.code} on ${p.short}. Check it's there first.`,
      link: { label: `Search ${p.short}`, href: p.searchUrl },
    },
  ];
  for (const part of r.best.parts) {
    const src = PROGRAMS[part.from];
    steps.push(
      part.direct
        ? { kind: "use", title: `Use ${num(part.miles)} ${src.short} miles`, sub: "Already in the right account." }
        : {
            kind: "move",
            title: `Move ${num(part.spend)} ${src.short} points`,
            sub: `Instant, and one-way, so only after you've found the seat.`,
            bonus: part.bonus?.pct,
            link: { label: `Open ${src.short}`, href: src.transferUrl },
          },
    );
  }
  steps.push({ kind: "book", title: `Book it, pay ~${money(r.taxesTotal)}`, sub: "Grab it fast. Award seats go quickly." });
  return steps;
}

export function TripDetail({
  r,
  mode,
  onBack,
  onUnlock,
}: {
  r: TripResult;
  mode: "free" | "member";
  onBack: () => void;
  onUnlock: () => void;
}) {
  const { state, update } = usePoints();
  const n = state.travelers;
  const origin = state.airport ?? "";
  const id = r.trip.id;
  const member = mode === "member";
  const steps = bookingSteps(r, origin);
  const doneCount = steps.filter((_, j) => state.checks[`${id}:${j}`]).length;
  const allDone = member && doneCount === steps.length;
  // Confetti only at the moment the last step is ticked, not every time a finished trip is reopened.
  const [celebrate, setCelebrate] = useState(false);
  const watching = state.watching[id] ?? state.saved.includes(id);
  const requested = !!state.checks[`${id}:seats-requested`];
  const have = r.best.capacity;
  const pct = Math.min(100, Math.round((have / r.need) * 100));
  const saved = Math.max(0, r.cashTotal - r.taxesTotal);
  const credit = creditFor(r.trip.city);
  const cash = useCashDeals(r.ok ? null : state.airport, [r.trip.city])[r.trip.city];

  return (
    <div className="flex flex-col">
      {celebrate && <Confetti count={70} />}
      <div className="relative h-[330px] overflow-hidden text-white">
        <TripThumb city={r.trip.city} code={r.trip.code} className="kenburns absolute inset-0" showCode={false} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/30" />
        <button
          type="button"
          aria-label="Back"
          onClick={onBack}
          className="absolute top-4 left-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-black/30 backdrop-blur-md active:scale-95"
        >
          <Icon d={ICONS.back} size={20} stroke={2.4} />
        </button>
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 px-5 pb-6">
          <div className="flex items-center gap-2">
            <CabinBadge business={r.isBusiness} label={cabinLabel(r)} />
            <span className="nums text-[14px] font-bold opacity-90">{origin} → {r.trip.code} · {r.trip.route}</span>
          </div>
          <h1 className="rise text-[44px] leading-none font-extrabold tracking-[-0.02em]">{r.trip.city}</h1>
          <div className="flex items-end justify-between gap-3">
            <span className="nums text-[26px] leading-tight font-extrabold">
              {num(r.need)} <span className="text-[15px] font-semibold opacity-80">points{n > 1 ? ` for ${n}` : ""}</span>
            </span>
            <StatusPill ok={r.ok} className="bg-surface">{r.ok ? "You can book this" : `${num(r.gap)} short`}</StatusPill>
          </div>
          {credit && (
            <a href={credit.page} target="_blank" rel="noopener noreferrer" className="text-[10.5px] opacity-60">
              Photo: {credit.author}, {credit.license}
            </a>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4 px-4 pt-4 pb-10">
        {/* What it's worth: cash fare vs what they actually pay. */}
        <div className="rise bg-trace relative overflow-hidden rounded-[28px] p-5 text-white shadow-[0_14px_36px_rgba(253,41,123,0.28)]">
          <div aria-hidden="true" className="absolute -right-8 -bottom-12 h-40 w-40 rounded-full bg-white/15" />
          <div className="relative flex items-end justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-[13px] font-bold text-white/85">Keep in your pocket</span>
              <span className="nums text-[40px] leading-none font-extrabold">{money(saved)}</span>
            </div>
            <div className="flex flex-col items-end text-right text-[13px] leading-snug font-semibold">
              <span className="nums text-white/75 line-through">{money(r.cashTotal)} cash fare</span>
              <span className="nums">You pay ~{money(r.taxesTotal)} + points</span>
            </div>
          </div>
          <div className="relative mt-3 flex items-center gap-2 border-t border-white/20 pt-3 text-[13px] font-semibold">
            <span className="nums shrink-0 whitespace-nowrap rounded-full bg-white px-2.5 py-0.5 text-[13px] font-extrabold text-trace-pink">{cppLabel(centsPerPoint(r))} per point</span>
            <span className="text-white/90">Cashing out gets you about 1¢.</span>
          </div>
        </div>

        {/* The math, drawn: where the points come from and where they land. */}
        <section className="rise flex flex-col gap-4 rounded-[28px] bg-surface p-5 shadow-[0_8px_24px_rgba(15,23,48,0.08)] ring-1 ring-line" style={stagger(1)}>
          <div className="flex items-center justify-between">
            <span className="text-[17px] font-extrabold">Your points → this trip</span>
            {r.ok && (
              <span className="check-in flex items-center gap-1 rounded-full bg-ok-bg px-2.5 py-1 text-[12px] font-extrabold text-ok">
                <Check size={11} /> Covered
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              {r.best.parts.map((part) => (
                <div key={part.from} className="flex items-center gap-2.5 rounded-2xl bg-soft p-2 pr-3">
                  <ProgramBadge id={part.from} size={36} />
                  <span className="flex min-w-0 flex-col gap-0.5 leading-tight">
                    <span className="nums text-[16px] font-extrabold">{num(part.spend)}</span>
                    <span className="flex items-center gap-1.5 text-[12px] text-muted">
                      <span className="truncate">{PROGRAMS[part.from].short}</span>
                      {part.bonus && (
                        <span className="shrink-0 rounded-full bg-gradient-to-r from-sea to-sky px-1.5 py-px text-[10.5px] font-extrabold text-white">
                          +{part.bonus.pct}%
                        </span>
                      )}
                    </span>
                  </span>
                </div>
              ))}
              {!r.best.parts.length && <div className="rounded-2xl bg-soft p-3 text-[13px] text-muted">No points yet that reach {r.best.partner.short}</div>}
            </div>
            <svg width="34" height="60" viewBox="0 0 34 60" aria-hidden="true" className="shrink-0 text-trace-pink">
              <path d="M2 30 H28" stroke="currentColor" strokeWidth="2.5" strokeDasharray="5 5" className="dash-move" fill="none" />
              <path d="M22 23 L30 30 L22 37" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div className="flex w-[104px] shrink-0 flex-col items-center gap-1.5 text-center">
              <AwardBadge program={r.best.partner.program} size={52} />
              <span className="text-[13px] leading-tight font-extrabold">{r.best.partner.short}</span>
              <span className="text-[11.5px] leading-tight text-muted">flying {r.best.option.on}</span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="h-3 overflow-hidden rounded-full bg-soft" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Points covered">
              <div
                className="h-full rounded-full transition-[width] duration-1000"
                style={{ width: `${Math.max(4, pct)}%`, background: r.ok ? "linear-gradient(90deg,#00D665,#14B8A6)" : "linear-gradient(90deg,#F59E0B,#FD297B)" }}
              />
            </div>
            <div className="nums flex justify-between text-[12.5px] font-bold">
              <span className={r.ok ? "text-ok" : "text-near"}>You have {num(have)}</span>
              <span className="text-muted">Need {num(r.need)}</span>
            </div>
          </div>
        </section>

        {!r.ok && r.suggestion && <CardOfferLink suggestion={r.suggestion} gap={r.gap} trip={r.trip.id} where="detail" />}
        {!r.ok && cash && (
          <div className="overflow-hidden rounded-[24px] bg-surface ring-1 ring-line [&>a]:border-t-0">
            <CashDealStrip deal={cash} city={r.trip.city} />
          </div>
        )}

        {/* Seats */}
        {member ? (
          requested ? (
            <div className="flex items-center gap-3 rounded-[24px] bg-gradient-to-r from-sky/15 to-violet/15 p-4">
              <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky text-white">
                <Icon d={ICONS.seat} size={20} />
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky opacity-70" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-sky ring-2 ring-surface" />
                </span>
              </span>
              <span className="flex flex-col leading-tight">
                <span className="text-[15px] font-extrabold">Checking real seats for you</span>
                <span className="text-[13px] text-muted">Dates show up here, usually within 24 hours</span>
              </span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                track("book_request", { trip: id });
                update((s) => ({ checks: { ...s.checks, [`${id}:seats-requested`]: true } }));
              }}
              className="flex min-h-[68px] items-center gap-3 rounded-[24px] bg-gradient-to-r from-sky to-violet p-4 text-left text-white shadow-[0_10px_26px_rgba(14,165,233,0.3)] active:scale-[0.99]"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/20"><Icon d={ICONS.seat} size={20} /></span>
              <span className="flex flex-1 flex-col leading-tight">
                <span className="text-[16px] font-extrabold">Find my seats</span>
                <span className="text-[13px] text-white/85">Real dates and seat counts, within 24 hours</span>
              </span>
              <Icon d={ICONS.chevron} size={18} stroke={2.6} />
            </button>
          )
        ) : (
          <button
            type="button"
            onClick={onUnlock}
            className="flex min-h-[68px] items-center gap-3 rounded-[24px] bg-midnight p-4 text-left text-white active:scale-[0.99]"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-gold"><LockIcon size={20} /></span>
            <span className="flex flex-1 flex-col leading-tight">
              <span className="text-[16px] font-extrabold">Dates for {r.trip.city}</span>
              <span className="text-[13px] text-white/70">Members see exact dates and get seat alerts</span>
            </span>
            <Icon d={ICONS.chevron} size={18} stroke={2.6} />
          </button>
        )}

        {/* Booking steps as a checklist. */}
        <section className="flex flex-col gap-3 pt-2">
          <div className="flex items-end justify-between px-1">
            <h2 className="text-[20px] font-extrabold tracking-[-0.01em]">{r.ok ? `Book it in ${steps.length} steps` : "How you'll book it"}</h2>
            {member && <span className="nums text-[13px] font-bold text-muted">{doneCount} of {steps.length}</span>}
          </div>
          {member && (
            <div className="h-1.5 overflow-hidden rounded-full bg-soft">
              <div className="bg-trace h-full rounded-full transition-[width] duration-500" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
            </div>
          )}
          <ol className="flex flex-col">
            {steps.map((st, j) => {
              const key = `${id}:${j}`;
              const done = member && !!state.checks[key];
              const look = STEP_LOOK[st.kind];
              const toggle = () => {
                if (!done && doneCount === steps.length - 1) setCelebrate(true);
                update((s) => ({ checks: { ...s.checks, [key]: !s.checks[key] } }));
              };
              return (
                <li key={key} className="rise flex gap-3" style={stagger(j + 2, 70)}>
                  <span className="flex flex-col items-center">
                    <button
                      type="button"
                      disabled={!member}
                      aria-label={member ? (done ? `Mark step ${j + 1} not done` : `Mark step ${j + 1} done`) : `Step ${j + 1}`}
                      aria-pressed={member ? done : undefined}
                      onClick={toggle}
                      className={cx("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white transition-transform active:scale-90", done && "pop")}
                      style={{ background: done ? "#00D665" : look.color, boxShadow: `0 8px 18px ${done ? "#00D66540" : `${look.color}40`}` }}
                    >
                      {done ? <Check size={18} /> : <Icon d={look.icon} size={20} stroke={2.2} />}
                    </button>
                    {j < steps.length - 1 && <span className={cx("my-1 w-0.5 flex-1 rounded-full", done ? "bg-trace-green" : "bg-line")} />}
                  </span>
                  <div className="flex flex-1 flex-col gap-1.5 pb-5">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className={cx("text-[16px] leading-tight font-extrabold", done && "text-muted line-through")}>{st.title}</span>
                      {st.bonus && (
                        <span className="rounded-full bg-gradient-to-r from-sea to-sky px-2 py-0.5 text-[11px] font-extrabold whitespace-nowrap text-white">+{st.bonus}% bonus</span>
                      )}
                    </span>
                    <span className="text-[13.5px] leading-snug text-muted">{st.sub}</span>
                    {st.link && (
                      <a
                        href={st.link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex min-h-[40px] items-center gap-1.5 self-start rounded-xl px-3.5 text-[13.5px] font-extrabold text-white active:scale-95"
                        style={{ background: look.color }}
                      >
                        {st.link.label}
                        <Icon d={ICONS.external} size={13} stroke={2.4} />
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
          {allDone && (
            <div className="check-in flex items-center gap-3 rounded-[24px] bg-gradient-to-r from-trace-green to-sea p-4 text-white">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20"><Icon d={ICONS.plane} size={20} /></span>
              <span className="flex flex-col leading-tight">
                <span className="text-[17px] font-extrabold">Booked. Enjoy {r.trip.city}!</span>
                <span className="text-[13px] text-white/90">That&apos;s {money(saved)} you didn&apos;t spend.</span>
              </span>
            </div>
          )}
        </section>

        {member && (
          <div className="flex items-center gap-3 rounded-[24px] bg-surface p-4 ring-1 ring-line">
            <span className={cx("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-colors", watching ? "bg-trace text-white" : "bg-soft text-muted")}>
              <Icon d={ICONS.bell} size={20} />
            </span>
            <span className="flex flex-1 flex-col leading-tight">
              <span className="text-[15px] font-extrabold">Watch this trip</span>
              <span className="text-[13px] text-muted">{watching ? "We'll ping you about dates and bonuses" : "Get pinged when dates open"}</span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={watching}
              aria-label="Watch this trip"
              onClick={() => update((s) => ({ watching: { ...s.watching, [id]: !watching } }))}
              className={cx("flex h-8 w-14 shrink-0 rounded-full p-1 transition", watching ? "justify-end bg-trace-pink" : "justify-start bg-line")}
            >
              <span className="h-6 w-6 rounded-full bg-white shadow" />
            </button>
          </div>
        )}

        {!member && (
          <button
            type="button"
            onClick={onUnlock}
            className="bg-trace shimmer flex min-h-[62px] flex-col items-center justify-center rounded-2xl px-4 py-3 text-white shadow-[0_10px_28px_rgba(253,41,123,0.32)]"
          >
            <span className="text-[17px] font-extrabold">Unlock dates for {r.trip.city}</span>
            <span className="text-[13px] font-semibold opacity-90">First 7 days free</span>
          </button>
        )}

        <p className="px-1 text-[12px] leading-relaxed text-muted">{finePrint(r)}</p>
      </div>
    </div>
  );
}
