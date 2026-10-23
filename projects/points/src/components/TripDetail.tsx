"use client";

import { PROGRAMS } from "@/engine/data";
import type { TripResult } from "@/engine/types";
import { track } from "@/lib/analytics";
import { money, num } from "@/lib/format";
import { usePoints } from "@/lib/store";
import { creditFor } from "@/lib/images";
import { finePrint } from "@/lib/tripText";
import { CardOfferLink } from "./CardOffer";
import { cabinLabel } from "./results/DestinationCard";
import { TripThumb } from "./TripThumb";
import { CabinBadge, Card, Check, cx, Eyebrow, Icon, ICONS, LockIcon, StatusPill } from "./ui";

interface Step {
  title: string;
  desc: string;
  link?: { label: string; href: string };
}

function bookingSteps(r: TripResult, origin: string, travelers: number): Step[] {
  const p = r.best.partner;
  const steps: Step[] = [
    {
      title: `Find the seat on ${p.short}`,
      desc: `Search ${origin} to ${r.trip.code} for ${r.best.option.on} flights${travelers > 1 ? `, ${travelers} passengers` : ""}. Don't move any points until you see it.`,
      link: { label: `Open ${p.short} search`, href: p.searchUrl },
    },
  ];
  for (const part of r.best.parts) {
    const src = PROGRAMS[part.from];
    steps.push(
      part.direct
        ? { title: `Use ${num(part.miles)} of your ${src.short} miles`, desc: "They're already in the right account. No transfer needed." }
        : {
            title: `Move ${num(part.spend)} ${src.short} points to ${p.short}`,
            desc: `${part.bonus ? `With the ${part.bonus.pct}% bonus that becomes ${num(part.miles)} miles. ` : ""}Usually instant, and it can't be undone.`,
            link: { label: `Open ${src.short} transfers`, href: src.transferUrl },
          },
    );
  }
  steps.push({ title: `Book it and pay about ${money(r.taxesTotal)} in taxes`, desc: "Book right away. Award seats can disappear within hours." });
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
  const steps = bookingSteps(r, origin, n);
  const watching = state.watching[id] ?? state.saved.includes(id);
  const requested = !!state.checks[`${id}:seats-requested`];
  const have = r.best.capacity;
  const credit = creditFor(r.trip.city);

  return (
    <div className="flex flex-col">
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
            <div className="flex flex-col">
              <span className="nums text-[26px] leading-tight font-extrabold">{num(r.need)} <span className="text-[15px] font-semibold opacity-80">points</span></span>
              <span className="text-[13px] opacity-85">+ about {money(r.taxesTotal)} taxes{n > 1 ? ` for ${n}` : ""} · <span className="line-through">{money(r.cashTotal)}</span> cash</span>
            </div>
            <StatusPill ok={r.ok} className="bg-white">{r.ok ? "You can book this" : `${num(r.gap)} short`}</StatusPill>
          </div>
          {credit && (
            <a href={credit.page} target="_blank" rel="noopener noreferrer" className="text-[10.5px] opacity-60">
              Photo: {credit.author}, {credit.license}
            </a>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-5 px-5 pt-5 pb-10">
        <Card className="flex flex-col gap-2 p-4">
          <Eyebrow>The math</Eyebrow>
          {r.best.parts.map((p) => (
            <div key={p.from} className="flex justify-between gap-3 text-[15px]">
              <span>
                {p.direct
                  ? `Your ${PROGRAMS[p.from].short} miles`
                  : `${num(p.spend)} ${PROGRAMS[p.from].short} → ${r.best.partner.short}`}
                {p.bonus && <span className="ml-1 rounded bg-ok-bg px-1.5 py-0.5 text-[11px] font-bold whitespace-nowrap text-ok">+{p.bonus.pct}% bonus</span>}
              </span>
              <span className="nums font-bold">{num(p.miles)}</span>
            </div>
          ))}
          {!r.ok && (
            <div className="flex justify-between gap-3 text-[15px]">
              <span>You have</span>
              <span className="nums font-bold">{num(have)}</span>
            </div>
          )}
          <div className="flex justify-between gap-3 border-t border-line pt-2 text-[15px] font-bold">
            <span>Needed{n > 1 ? ` for ${n}` : ""}</span>
            <span className="nums">{num(r.need)}</span>
          </div>
          <p className="text-[12.5px] text-muted">
            {r.best.parts.length > 1
              ? "You can move points from more than one card into the same airline account."
              : `Booked through ${r.best.partner.name} on ${r.best.option.on}.`}
          </p>
        </Card>

        {!r.ok &&
          (r.suggestion ? (
            <CardOfferLink suggestion={r.suggestion} gap={r.gap} trip={r.trip.id} where="detail" />
          ) : (
            <div className="rounded-3xl bg-near-bg p-4 text-[14px] font-semibold text-[#5A3A00]">
              You&apos;re {num(r.gap)} points short. Keep earning and we&apos;ll tell you the day you can book it.
            </div>
          ))}

        <section className="flex flex-col gap-2.5">
          <h2 className="text-[18px] font-extrabold">Seats</h2>
          {member ? (
            requested ? (
              <Card className="p-4 text-[14px] leading-snug">
                <div className="font-bold">We&apos;re checking real dates for you.</div>
                <div className="text-muted">A Trace analyst confirms open seats within 24 hours. You&apos;ll see them here.</div>
              </Card>
            ) : (
              <button
                type="button"
                onClick={() => {
                  track("book_request", { trip: id });
                  update((s) => ({ checks: { ...s.checks, [`${id}:seats-requested`]: true } }));
                }}
                className="flex min-h-[64px] items-center gap-3 rounded-2xl border border-trace-red bg-white p-4 text-left"
              >
                <span className="text-trace-red"><Icon d={ICONS.seat} size={22} /></span>
                <span className="flex flex-col">
                  <span className="text-[15px] font-bold">Find my seats</span>
                  <span className="text-[13px] text-muted">We confirm real dates and seat counts within 24 hours</span>
                </span>
              </button>
            )
          ) : (
            <button
              type="button"
              onClick={onUnlock}
              className="flex min-h-[64px] items-center gap-3 rounded-2xl border border-dashed border-trace-red bg-white p-4 text-left"
            >
              <span className="text-trace-red"><LockIcon size={22} /></span>
              <span className="flex flex-col">
                <span className="text-[15px] font-bold">Dates for {r.trip.city}</span>
                <span className="text-[13px] text-muted">Members see exact dates and get seat alerts</span>
              </span>
            </button>
          )}
        </section>

        <section className="flex flex-col gap-2.5">
          <h2 className="text-[18px] font-extrabold">{r.ok ? `Book it in ${steps.length} steps` : "How you'll book it"}</h2>
          {steps.map((st, j) => {
            const key = `${id}:${j}`;
            const done = member && !!state.checks[key];
            const toggle = () => update((s) => ({ checks: { ...s.checks, [key]: !s.checks[key] } }));
            return (
              <Card key={key} className="flex gap-3 p-4">
                {member ? (
                  <button
                    type="button"
                    aria-label={done ? `Mark step ${j + 1} not done` : `Mark step ${j + 1} done`}
                    aria-pressed={done}
                    onClick={toggle}
                    className={cx(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[14px] font-bold",
                      done ? "bg-trace-green text-white" : "border-2 border-line",
                    )}
                  >
                    {done ? <Check size={14} /> : j + 1}
                  </button>
                ) : (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-line text-[14px] font-bold">{j + 1}</span>
                )}
                <div className="flex flex-1 flex-col gap-1.5">
                  <div className={cx("text-[15px] font-bold", done && "text-muted line-through")}>{st.title}</div>
                  <div className="text-[13.5px] leading-snug text-muted">{st.desc}</div>
                  {st.link && (
                    <a
                      href={st.link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 inline-flex min-h-[40px] items-center gap-1.5 self-start rounded-xl bg-soft px-3 text-[13.5px] font-bold"
                    >
                      {st.link.label}
                      <Icon d={ICONS.external} size={14} />
                    </a>
                  )}
                </div>
              </Card>
            );
          })}
          <p className="rounded-xl bg-soft p-3 text-[13px] leading-snug font-semibold">
            Transfers are one-way. Always confirm the seat is there before you move any points.
          </p>
        </section>

        {member && (
          <Card className="flex items-center justify-between gap-3 p-4">
            <div>
              <div className="font-bold">Watch this trip</div>
              <div className="text-[13px] text-muted">Ping me when dates open or a bonus lowers the price</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={watching}
              aria-label="Watch this trip"
              onClick={() => update((s) => ({ watching: { ...s.watching, [id]: !watching } }))}
              className={cx("flex h-8 w-14 shrink-0 rounded-full p-1 transition", watching ? "justify-end bg-trace-red" : "justify-start bg-line")}
            >
              <span className="h-6 w-6 rounded-full bg-white shadow" />
            </button>
          </Card>
        )}

        {!member && (
          <button
            type="button"
            onClick={onUnlock}
            className="flex min-h-[60px] flex-col items-center justify-center rounded-[14px] bg-gradient-to-r from-trace-red to-trace-pink px-4 py-3 text-white"
          >
            <span className="text-[16px] font-extrabold">Unlock dates</span>
            <span className="text-[13px] font-semibold opacity-90">First 7 days free</span>
          </button>
        )}

        <p className="text-[12px] leading-relaxed text-muted">{finePrint(r)}</p>
      </div>
    </div>
  );
}
