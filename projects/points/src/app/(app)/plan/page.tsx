"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { evalAll } from "@/engine/engine";
import type { Region, TripResult } from "@/engine/types";
import { CardOfferLink } from "@/components/CardOffer";
import { cabinLabel } from "@/components/results/DestinationCard";
import { TripThumb } from "@/components/TripThumb";
import { CabinBadge, Check, cx, Eyebrow, Icon, ICONS, PrimaryButton, stagger } from "@/components/ui";
import { track } from "@/lib/analytics";
import { REGION_COLOR } from "@/lib/destinations";
import { fuzzyIncludes } from "@/lib/fuzzy";
import { num, plural, shortDate, todayIso } from "@/lib/format";
import { useDeck, usePoints, type PlannedTrip } from "@/lib/store";

type Where =
  | { kind: "city"; city: string; region: Region }
  | { kind: "region"; region: Region }
  | { kind: "beach" }
  | { kind: "anywhere" };

const whereLabel = (w: Where) =>
  w.kind === "city" ? w.city : w.kind === "region" ? w.region : w.kind === "beach" ? "Anywhere with a beach" : "Anywhere";

const addDays = (iso: string, d: number) => {
  const t = new Date(`${iso}T12:00:00`);
  t.setDate(t.getDate() + d);
  return t.toISOString().slice(0, 10);
};

/**
 * Plan a specific trip: where, when, who and which cabin. Results are priced
 * in the user's own points, and any of them can go on the watch list.
 */
export default function PlanPage() {
  const { state, update } = usePoints();
  const { input } = useDeck();
  const all = useMemo(() => evalAll(input), [input]);

  const [q, setQ] = useState("");
  const [focus, setFocus] = useState(false);
  const [where, setWhere] = useState<Where | null>(null);
  const [depart, setDepart] = useState(addDays(todayIso(), 60));
  const [ret, setRet] = useState(addDays(todayIso(), 67));
  const [oneWay, setOneWay] = useState(false);
  const [flexible, setFlexible] = useState(true);
  const [travelers, setTravelers] = useState(state.travelers);
  const [cabin, setCabin] = useState<PlannedTrip["cabin"]>("any");
  const [searched, setSearched] = useState<null | { where: Where; travelers: number; cabin: PlannedTrip["cabin"] }>(null);

  const cities = useMemo(() => {
    const m = new Map<string, Region>();
    for (const r of all) m.set(r.trip.city, r.trip.region);
    return [...m.entries()].map(([city, region]) => ({ city, region }));
  }, [all]);
  const regions = useMemo(() => [...new Set(cities.map((c) => c.region))], [cities]);

  const suggestions: Where[] = useMemo(() => {
    const t = q.toLowerCase().trim();
    const out: Where[] = [];
    if (!t) return [{ kind: "anywhere" }, { kind: "beach" }, ...regions.map((region) => ({ kind: "region" as const, region }))];
    const words = t.split(/\s+/);
    for (const r of regions) if (words.every((w) => fuzzyIncludes(r.toLowerCase().split(/[\s&]+/), w))) out.push({ kind: "region", region: r });
    for (const c of cities) {
      if (c.city.toLowerCase().includes(t) || words.every((w) => fuzzyIncludes(c.city.toLowerCase().split(/[\s,]+/), w))) {
        out.push({ kind: "city", city: c.city, region: c.region });
      }
    }
    if ("beach".startsWith(t) || "beaches".startsWith(t)) out.push({ kind: "beach" });
    if ("anywhere".startsWith(t)) out.push({ kind: "anywhere" });
    return out.slice(0, 8);
  }, [q, cities, regions]);

  const results: TripResult[] = useMemo(() => {
    if (!searched) return [];
    const w = searched.where;
    const n = searched.travelers;
    return evalAll({ ...input, travelers: n })
      .filter((r) =>
        w.kind === "city" ? r.trip.city === w.city : w.kind === "region" ? r.trip.region === w.region : w.kind === "beach" ? r.trip.kind === "beach" : true,
      )
      .filter((r) => (searched.cabin === "any" ? true : searched.cabin === "business" ? r.isBusiness : !r.isBusiness))
      .sort((a, b) => Number(b.ok) - Number(a.ok) || (a.ok ? b.cashTotal - a.cashTotal : a.gap - b.gap));
  }, [searched, input]);

  const watchingId = (tripId: string) =>
    state.planned.find((p) => p.tripId === tripId && p.depart === depart && p.ret === (oneWay ? "" : ret));

  const toggleWatch = (r: TripResult) => {
    const existing = watchingId(r.trip.id);
    if (existing) {
      update((s) => ({ planned: s.planned.filter((p) => p.id !== existing.id) }));
      return;
    }
    const plan: PlannedTrip = {
      id: `${r.trip.id}-${depart}-${Date.now()}`,
      tripId: r.trip.id,
      city: r.trip.city,
      depart,
      ret: oneWay ? "" : ret,
      flexible,
      travelers: searched?.travelers ?? travelers,
      cabin: searched?.cabin ?? cabin,
      addedAt: new Date().toISOString(),
    };
    track("watch_added", { trip: r.trip.id, depart, flexible });
    update((s) => ({ planned: [...s.planned, plan] }));
  };

  const datesOk = !!depart && (oneWay || (!!ret && ret >= depart));
  const canSearch = !!where && datesOk;

  return (
    <div className="flex flex-col gap-5 pb-12">
      <header className="relative overflow-hidden px-5 pt-5">
        <div aria-hidden="true" className="absolute -top-20 -right-16 h-56 w-56 rounded-full bg-violet/15 blur-3xl" />
        <h1 className="relative text-[30px] leading-tight font-extrabold tracking-[-0.02em]">Plan a trip</h1>
        <p className="relative text-[15px] leading-snug text-muted">Pick a place and dates. We&apos;ll price it in your points and watch for open seats.</p>
      </header>

      <form
        className="mx-4 flex flex-col gap-4 rounded-[28px] bg-white p-4 shadow-[0_10px_30px_rgba(15,23,48,0.10)]"
        onSubmit={(e) => {
          e.preventDefault();
          if (!canSearch || !where) return;
          setSearched({ where, travelers, cabin });
          track("plan_search", { where: whereLabel(where), cabin, travelers, flexible });
        }}
      >
        <div className="relative">
          <label htmlFor="plan-where" className="text-[12px] font-extrabold tracking-[0.06em] text-muted uppercase">Where</label>
          {where && !focus ? (
            <button
              type="button"
              onClick={() => {
                setWhere(null);
                setQ("");
                setFocus(true);
              }}
              className="mt-1.5 flex min-h-[54px] w-full items-center gap-3 rounded-2xl bg-soft px-4 text-left"
            >
              <Icon d={ICONS.pin} size={18} className="text-trace-pink" />
              <span className="flex-1 text-[16.5px] font-bold">{whereLabel(where)}</span>
              <span className="text-[13px] font-bold text-muted">Change</span>
            </button>
          ) : (
            <>
              <div className="relative mt-1.5">
                <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted"><Icon d={ICONS.search} size={18} /></span>
                <input
                  id="plan-where"
                  type="search"
                  autoComplete="off"
                  value={q}
                  onFocus={() => setFocus(true)}
                  onBlur={() => window.setTimeout(() => setFocus(false), 150)}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="City, region, or anywhere"
                  className="min-h-[54px] w-full rounded-2xl bg-soft pr-4 pl-11 text-[16.5px] outline-none focus:bg-white focus:ring-2 focus:ring-trace-pink"
                />
              </div>
              {focus && (
                <ul className="absolute inset-x-0 z-20 mt-2 max-h-[320px] overflow-auto rounded-2xl border border-line bg-white p-1.5 shadow-[0_16px_40px_rgba(15,23,48,0.16)]" role="listbox">
                  {suggestions.length === 0 && <li className="px-3 py-3 text-[14px] text-muted">We don&apos;t price that destination yet.</li>}
                  {suggestions.map((s) => (
                    <li key={whereLabel(s)}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={false}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setWhere(s);
                          setFocus(false);
                        }}
                        className="flex min-h-[50px] w-full items-center gap-3 rounded-xl px-3 text-left active:bg-soft"
                      >
                        {s.kind === "city" ? (
                          <TripThumb city={s.city} code="" className="h-9 w-9 shrink-0 rounded-lg" showCode={false} />
                        ) : (
                          <span
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
                            style={{ background: s.kind === "region" ? REGION_COLOR[s.region] : s.kind === "beach" ? "#14B8A6" : "#FD297B" }}
                          >
                            <Icon d={s.kind === "anywhere" ? ICONS.sparkle : ICONS.compass} size={17} />
                          </span>
                        )}
                        <span className="flex flex-col leading-tight">
                          <span className="text-[15px] font-bold">{whereLabel(s)}</span>
                          <span className="text-[12px] text-muted">
                            {s.kind === "city" ? s.region : s.kind === "region" ? `${plural(cities.filter((c) => c.region === s.region).length, "destination")}` : "Show me the best options"}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-extrabold tracking-[0.06em] text-muted uppercase">When</span>
            <div className="flex rounded-full bg-soft p-0.5 text-[12.5px] font-bold">
              {[
                [false, "Round trip"],
                [true, "One way"],
              ].map(([v, l]) => (
                <button key={String(v)} type="button" aria-pressed={oneWay === v} onClick={() => setOneWay(v as boolean)} className={cx("rounded-full px-3 py-1.5", oneWay === v ? "bg-white shadow-sm" : "text-muted")}>
                  {l as string}
                </button>
              ))}
            </div>
          </div>
          <div className={cx("grid gap-2", oneWay ? "grid-cols-1" : "grid-cols-2")}>
            <DateField label="Depart" value={depart} min={todayIso()} onChange={(v) => {
              setDepart(v);
              if (ret && v > ret) setRet(addDays(v, 7));
            }} />
            {!oneWay && <DateField label="Return" value={ret} min={depart} onChange={setRet} />}
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={flexible}
            onClick={() => setFlexible(!flexible)}
            className="mt-1 flex items-center justify-between rounded-2xl bg-soft px-4 py-3 text-left"
          >
            <span className="flex flex-col leading-tight">
              <span className="text-[14.5px] font-bold">Flexible dates</span>
              <span className="text-[12.5px] text-muted">Look 3 days either side. Award seats are easier to find.</span>
            </span>
            <span className={cx("flex h-7 w-12 shrink-0 rounded-full p-0.5 transition", flexible ? "justify-end bg-trace-pink" : "justify-start bg-[#D5D8E0]")}>
              <span className="h-6 w-6 rounded-full bg-white shadow" />
            </span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1.5">
            <span className="text-[12px] font-extrabold tracking-[0.06em] text-muted uppercase">Travelers</span>
            <div className="flex min-h-[50px] items-center justify-between rounded-2xl bg-soft px-1.5">
              <button type="button" aria-label="Fewer travelers" disabled={travelers <= 1} onClick={() => setTravelers(travelers - 1)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-white disabled:opacity-40">
                <Icon d={ICONS.minus} size={16} stroke={2.6} />
              </button>
              <span className="nums text-[17px] font-extrabold" aria-live="polite">{travelers}</span>
              <button type="button" aria-label="More travelers" disabled={travelers >= 6} onClick={() => setTravelers(travelers + 1)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-white disabled:opacity-40">
                <Icon d={ICONS.plus} size={16} stroke={2.6} />
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[12px] font-extrabold tracking-[0.06em] text-muted uppercase">Cabin</span>
            <select
              aria-label="Cabin"
              value={cabin}
              onChange={(e) => setCabin(e.target.value as PlannedTrip["cabin"])}
              className="min-h-[50px] rounded-2xl bg-soft px-3 text-[15px] font-bold outline-none"
            >
              <option value="any">Any cabin</option>
              <option value="economy">Economy</option>
              <option value="business">Business</option>
            </select>
          </div>
        </div>

        <PrimaryButton type="submit" disabled={!canSearch}>
          {where ? `Search ${whereLabel(where)}` : "Choose where to go"}
        </PrimaryButton>
      </form>

      {searched && (
        <section className="flex flex-col gap-3 px-4" aria-live="polite">
          <div className="flex items-baseline justify-between px-1">
            <h2 className="text-[19px] font-extrabold">{plural(results.length, "option")}</h2>
            <span className="text-[12.5px] font-semibold text-muted">
              {shortDate(depart)}{oneWay ? "" : ` – ${shortDate(ret)}`}{flexible ? " ± 3 days" : ""} · {plural(searched.travelers, "traveler")}
            </span>
          </div>
          {results.length === 0 && (
            <div className="rounded-3xl bg-soft p-5 text-[14.5px] text-muted">
              Nothing in that cabin yet. Try &ldquo;Any cabin&rdquo;, or a nearby region.
            </div>
          )}
          {results.map((r, i) => {
            const on = !!watchingId(r.trip.id);
            return (
              <article key={r.trip.id} className="rise overflow-hidden rounded-[24px] bg-white shadow-[0_8px_24px_rgba(15,23,48,0.08)]" style={stagger(i, 40)}>
                <div className="flex gap-3 p-3">
                  <Link href={`/trip/${r.trip.id}`} className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl">
                    <TripThumb city={r.trip.city} code={r.trip.code} className="absolute inset-0" showCode={false} />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <Link href={`/trip/${r.trip.id}`} className="truncate text-[17px] font-extrabold">{r.trip.city}</Link>
                    <div className="flex items-center gap-2">
                      <CabinBadge business={r.isBusiness} label={cabinLabel(r)} />
                      <span className="text-[12.5px] text-muted">{r.trip.route}</span>
                    </div>
                    <div className="mt-auto flex items-end justify-between gap-2">
                      <span className="flex flex-col leading-tight">
                        <span className="nums text-[18px] font-extrabold">{num(r.need)}</span>
                        <span className={cx("text-[12px] font-bold", r.ok ? "text-ok" : "text-near")}>{r.ok ? "Your points cover it" : `${num(r.gap)} short`}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleWatch(r)}
                        aria-pressed={on}
                        className={cx(
                          "flex min-h-[40px] items-center gap-1.5 rounded-xl px-3 text-[13.5px] font-extrabold transition active:scale-95",
                          on ? "bg-ok-bg text-ok" : "bg-ink text-white",
                        )}
                      >
                        {on ? <><Check size={13} /> Watching</> : <><Icon d={ICONS.eye} size={15} /> Watch</>}
                      </button>
                    </div>
                  </div>
                </div>
                {!r.ok && r.suggestion && <CardOfferLink compact suggestion={r.suggestion} gap={r.gap} trip={r.trip.id} where="plan" />}
              </article>
            );
          })}
          {results.length > 0 && (
            <p className="px-1 text-[12px] leading-snug text-muted">
              Prices are typical saver awards, not live availability. Watching a trip asks Trace to check real seats on your dates.
            </p>
          )}
        </section>
      )}

      {!searched && state.planned.length > 0 && (
        <Link href="/trips" className="mx-4 flex items-center justify-between rounded-2xl bg-soft px-4 py-3.5 text-[14.5px] font-bold">
          <span>You&apos;re watching {plural(state.planned.length, "trip")}</span>
          <Icon d={ICONS.chevron} size={16} stroke={2.4} />
        </Link>
      )}

      <div className="px-5">
        <Eyebrow className="pb-2">Popular right now</Eyebrow>
        <div className="no-scrollbar -mx-5 flex gap-2.5 overflow-x-auto px-5 pb-1">
          {["Tokyo", "London", "Maui", "Cancún", "Paris", "Banff", "Bali", "Reykjavík"].map((c) => {
            const region = cities.find((x) => x.city === c)?.region;
            if (!region) return null;
            return (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setWhere({ kind: "city", city: c, region });
                  setQ("");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="relative h-28 w-24 shrink-0 overflow-hidden rounded-2xl text-left text-white active:scale-95"
              >
                <TripThumb city={c} code="" className="absolute inset-0" showCode={false} />
                <span className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <span className="absolute bottom-2 left-2 text-[13px] font-extrabold">{c}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DateField({ label, value, min, onChange }: { label: string; value: string; min: string; onChange: (v: string) => void }) {
  return (
    <label className="flex min-h-[54px] flex-col justify-center rounded-2xl bg-soft px-4 py-1.5 focus-within:bg-white focus-within:ring-2 focus-within:ring-trace-pink">
      <span className="text-[11px] font-bold text-muted">{label}</span>
      <input
        type="date"
        value={value}
        min={min}
        onChange={(e) => onChange(e.target.value)}
        className="nums w-full bg-transparent text-[15.5px] font-bold outline-none"
      />
    </label>
  );
}
