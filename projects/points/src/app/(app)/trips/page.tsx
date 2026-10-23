"use client";

import Link from "next/link";
import { useState } from "react";
import { evalAll } from "@/engine/engine";
import type { TripResult } from "@/engine/types";
import { num } from "@/lib/format";
import { useDeck, usePoints } from "@/lib/store";
import { tripLabel } from "@/lib/tripText";
import { TripThumb } from "@/components/TripThumb";
import { cx, Icon, ICONS, PrimaryButton } from "@/components/ui";

function tripStatus(r: TripResult, requested: boolean): { label: string; cls: string } {
  if (!r.ok) return { label: `Saving up · ${num(r.gap)} to go`, cls: "bg-near-bg text-near" };
  if (requested) return { label: "Checking seats", cls: "bg-[#DBEAFE] text-[#1E40AF]" };
  return { label: "Watching for seats", cls: "bg-ok-bg text-ok" };
}

/** The next twelve months, as "Mar 2027" style choices. */
function months(): string[] {
  const out: string[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 1; i <= 12; i++) {
    const m = new Date(d.getFullYear(), d.getMonth() + i, 1);
    out.push(m.toLocaleString("en-US", { month: "short", year: "numeric" }));
  }
  return out;
}

export default function TripsPage() {
  const { state, update } = usePoints();
  const { input } = useDeck();
  const all = evalAll(input);
  const saved = state.saved.map((id) => all.find((r) => r.trip.id === id)).filter((r): r is TripResult => !!r);
  const [planning, setPlanning] = useState(false);
  const cities = [...new Set(all.map((r) => r.trip.city))];
  const [city, setCity] = useState(cities[0]);
  const [when, setWhen] = useState(months()[2]);

  return (
    <div className="flex flex-col gap-4 px-5 pt-5 pb-10">
      <div>
        <h1 className="text-[28px] font-black">My trips</h1>
        <p className="text-[14.5px] text-muted">We watch these and tell you when seats open or a bonus makes them cheaper.</p>
      </div>

      {saved.length === 0 && (
        <div className="rounded-2xl bg-soft p-5 text-[15px]">
          Nothing saved yet. Tap the heart on any trip in{" "}
          <Link href="/discover" className="font-bold text-trace-red">Discover</Link>.
        </div>
      )}

      {saved.map((r) => {
        const st = tripStatus(r, !!state.checks[`${r.trip.id}:seats-requested`]);
        return (
          <Link key={r.trip.id} href={`/trip/${r.trip.id}`} className="flex min-h-[84px] items-center gap-3.5 rounded-2xl border border-line p-3">
            <TripThumb city={r.trip.city} code={r.trip.code} className="h-16 w-16 shrink-0 rounded-xl" />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="text-[16px] font-extrabold">{r.trip.city}</div>
              <div className="truncate text-[13px] text-muted">{tripLabel(r)} · {num(r.need)} pts</div>
              <span className={cx("self-start rounded-full px-2.5 py-0.5 text-[12px] font-bold", st.cls)}>{st.label}</span>
            </div>
            <span className="text-muted"><Icon d={ICONS.chevron} size={18} /></span>
          </Link>
        );
      })}

      {state.planned.length > 0 && (
        <>
          <h2 className="pt-2 text-[18px] font-extrabold">Planned</h2>
          {state.planned.map((p) => (
            <div key={p.id} className="flex items-center gap-3.5 rounded-2xl border border-line p-3">
              <TripThumb city={p.city} code={all.find((r) => r.trip.city === p.city)?.trip.code ?? ""} className="h-12 w-12 shrink-0 rounded-xl" />
              <div className="flex flex-1 flex-col">
                <span className="font-extrabold">{p.city}</span>
                <span className="text-[13px] text-muted">Around {p.when} · Watching for seats</span>
              </div>
              <button
                type="button"
                aria-label={`Remove ${p.city} plan`}
                onClick={() => update((s) => ({ planned: s.planned.filter((x) => x.id !== p.id) }))}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-muted"
              >
                <Icon d={ICONS.close} size={16} />
              </button>
            </div>
          ))}
        </>
      )}

      {planning ? (
        <form
          className="flex flex-col gap-3 rounded-2xl border border-line p-4"
          onSubmit={(e) => {
            e.preventDefault();
            update((s) => ({ planned: [...s.planned, { id: `${city}-${when}-${Date.now()}`, city, when }] }));
            setPlanning(false);
          }}
        >
          <div className="font-extrabold">Plan a specific trip</div>
          <label className="flex flex-col gap-1 text-[13px] font-bold text-muted">
            Where
            <select value={city} onChange={(e) => setCity(e.target.value)} className="min-h-[48px] rounded-xl border border-line bg-white px-3 text-[16px] font-semibold text-ink">
              {cities.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[13px] font-bold text-muted">
            Roughly when
            <select value={when} onChange={(e) => setWhen(e.target.value)} className="min-h-[48px] rounded-xl border border-line bg-white px-3 text-[16px] font-semibold text-ink">
              {months().map((m) => <option key={m}>{m}</option>)}
            </select>
          </label>
          <PrimaryButton type="submit">Watch this trip</PrimaryButton>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setPlanning(true)}
          className="flex flex-col gap-1 rounded-2xl border border-dashed border-line p-4 text-left"
        >
          <span className="flex items-center gap-2 font-extrabold"><Icon d={ICONS.plus} size={18} /> Plan a specific trip</span>
          <span className="text-[14px] text-muted">Tell us where and roughly when. We&apos;ll price it in your points and watch for seats.</span>
        </button>
      )}
    </div>
  );
}
