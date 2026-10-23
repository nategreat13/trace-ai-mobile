"use client";

import Link from "next/link";
import { useMemo } from "react";
import { evalAll } from "@/engine/engine";
import type { TripResult } from "@/engine/types";
import { CardOfferLink } from "@/components/CardOffer";
import { RequestStatus } from "@/components/TripRequest";
import { cabinLabel } from "@/components/results/DestinationCard";
import { TripThumb } from "@/components/TripThumb";
import { CabinBadge, cx, Eyebrow, Icon, ICONS, stagger } from "@/components/ui";
import { num, plural, shortDate } from "@/lib/format";
import { useDeck, usePoints, type PlannedTrip } from "@/lib/store";

function savedStatus(r: TripResult, requested: boolean): { label: string; cls: string } {
  if (!r.ok) return { label: `Saving up · ${num(r.gap)} to go`, cls: "bg-near-bg text-near" };
  if (requested) return { label: "Checking seats", cls: "bg-sky/10 text-sky" };
  return { label: "Watching for seats", cls: "bg-ok-bg text-ok" };
}

const dates = (p: PlannedTrip) =>
  `${shortDate(p.depart)}${p.ret ? ` – ${shortDate(p.ret)}` : " · one way"}${p.flexible ? " ± 3 days" : ""}`;

export default function TripsPage() {
  const { state, update } = usePoints();
  const { input } = useDeck();
  const all = useMemo(() => evalAll(input), [input]);
  const saved = state.saved.map((id) => all.find((r) => r.trip.id === id)).filter((r): r is TripResult => !!r);
  const watching = state.planned
    .map((p) => ({ p, r: evalAll({ ...input, travelers: p.travelers }).find((x) => x.trip.id === p.tripId) }))
    .filter((x): x is { p: PlannedTrip; r: TripResult } => !!x.r);

  return (
    <div className="flex flex-col gap-5 px-4 pt-5 pb-12">
      <div className="px-1">
        <h1 className="text-[30px] leading-tight font-extrabold tracking-[-0.02em]">My trips</h1>
        <p className="text-[15px] leading-snug text-muted">We watch these and tell you when seats open or a bonus makes them cheaper.</p>
      </div>

      <Link
        href="/plan"
        className="rise relative flex min-h-[132px] flex-col justify-end overflow-hidden rounded-[28px] p-5 text-white shadow-[0_12px_30px_rgba(124,58,237,0.25)] active:scale-[0.99]"
      >
        <TripThumb city="Santorini" code="" className="kenburns absolute inset-0" showCode={false} />
        <span className="absolute inset-0 bg-gradient-to-tr from-violet/90 via-trace-pink/60 to-transparent" />
        <span className="relative flex items-center gap-2 text-[22px] font-extrabold">
          <Icon d={ICONS.search} size={22} stroke={2.4} /> Plan a trip
        </span>
        <span className="relative text-[14px] font-medium text-white/90">Search a place and dates. We&apos;ll price it in your points and watch for seats.</span>
      </Link>

      {state.requests.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <Eyebrow className="px-1">Requested · {state.requests.length}</Eyebrow>
          {state.requests.map((r) => (
            <RequestStatus key={r.id} r={r} onRemove={() => update((s) => ({ requests: s.requests.filter((x) => x.id !== r.id) }))} />
          ))}
        </section>
      )}

      {watching.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <Eyebrow className="px-1">Watching · {watching.length}</Eyebrow>
          {watching.map(({ p, r }, i) => (
            <article key={p.id} className="rise overflow-hidden rounded-[24px] bg-white shadow-[0_8px_24px_rgba(15,23,48,0.08)]" style={stagger(i)}>
              <div className="flex items-center gap-3 p-3">
                <Link href={`/trip/${r.trip.id}`} className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-2xl">
                  <TripThumb city={r.trip.city} code={r.trip.code} className="absolute inset-0" showCode={false} />
                </Link>
                <Link href={`/trip/${r.trip.id}`} className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[16.5px] font-extrabold">{r.trip.city}</span>
                    <CabinBadge business={r.isBusiness} label={cabinLabel(r)} />
                  </span>
                  <span className="nums flex items-center gap-1.5 text-[13px] font-semibold text-muted">
                    <Icon d={ICONS.calendar} size={14} /> {dates(p)}
                  </span>
                  <span className={cx("text-[12.5px] font-bold", r.ok ? "text-ok" : "text-near")}>
                    {num(r.need)} pts for {plural(p.travelers, "traveler")} · {r.ok ? "covered" : `${num(r.gap)} short`}
                  </span>
                </Link>
                <button
                  type="button"
                  aria-label={`Stop watching ${r.trip.city}`}
                  onClick={() => update((s) => ({ planned: s.planned.filter((x) => x.id !== p.id) }))}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted active:bg-soft"
                >
                  <Icon d={ICONS.close} size={16} stroke={2.4} />
                </button>
              </div>
              <div className="flex items-center gap-2 border-t border-line px-4 py-2.5 text-[12.5px] font-semibold text-muted">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-sky" />
                </span>
                Watching for seats on your dates
              </div>
              {!r.ok && r.suggestion && <CardOfferLink compact suggestion={r.suggestion} gap={r.gap} trip={r.trip.id} where="trips" />}
            </article>
          ))}
        </section>
      )}

      <section className="flex flex-col gap-2.5">
        <Eyebrow className="px-1">Saved · {saved.length}</Eyebrow>
        {saved.length === 0 && (
          <div className="rounded-3xl bg-soft p-5 text-[15px] leading-snug">
            Nothing saved yet. Tap the heart on any destination in{" "}
            <Link href="/discover" className="font-bold text-trace-pink">Discover</Link>.
          </div>
        )}
        <div className="grid grid-cols-2 gap-2.5">
          {saved.map((r, i) => {
            const st = savedStatus(r, !!state.checks[`${r.trip.id}:seats-requested`]);
            return (
              <Link
                key={r.trip.id}
                href={`/trip/${r.trip.id}`}
                className="rise relative flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-[24px] p-3 text-white active:scale-[0.98]"
                style={stagger(i)}
              >
                <TripThumb city={r.trip.city} code={r.trip.code} className="absolute inset-0" showCode={false} />
                <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
                <span className="absolute top-2.5 left-2.5"><CabinBadge business={r.isBusiness} label={cabinLabel(r)} /></span>
                <span className="relative text-[18px] leading-tight font-extrabold">{r.trip.city}</span>
                <span className="nums relative text-[12.5px] text-white/85">{num(r.need)} pts · {r.trip.route}</span>
                <span className={cx("relative mt-1.5 self-start rounded-full px-2 py-0.5 text-[11px] font-extrabold", st.cls)}>{st.label}</span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
