"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { evalAll } from "@/engine/engine";
import type { Region, TripResult } from "@/engine/types";
import { CardOfferLink } from "@/components/CardOffer";
import { RequestStatus, cabinText, useSubmitRequest, type RequestDraft } from "@/components/TripRequest";
import { cabinLabel } from "@/components/results/DestinationCard";
import { TripThumb } from "@/components/TripThumb";
import { CabinBadge, Check, cx, Eyebrow, Icon, ICONS, PrimaryButton, stagger } from "@/components/ui";
import { track } from "@/lib/analytics";
import { sendToTeam } from "@/lib/teamRequests";
import { REGION_COLOR } from "@/lib/destinations";
import { fuzzyIncludes } from "@/lib/fuzzy";
import type { WorldAirport } from "@/lib/worldAirports";
import { coordsFor, miles, placeLabel, searchWorld, type WorldPlace } from "@/lib/worldSearch";
import { num, plural, shortDate, todayIso } from "@/lib/format";
import { useDeck, usePoints, type PlannedTrip, type TripRequest } from "@/lib/store";

type Where =
  /** `via` is what they typed when it flies into a city we price (Kyoto → Osaka). */
  | { kind: "city"; city: string; region: Region; via?: string }
  | { kind: "region"; region: Region }
  | { kind: "beach" }
  | { kind: "anywhere" }
  /** Somewhere Trace doesn't price yet; searching it leads to a request. */
  | { kind: "custom"; text: string; place?: WorldPlace };

const whereLabel = (w: Where) =>
  w.kind === "city"
    ? w.city
    : w.kind === "region"
      ? w.region
      : w.kind === "beach"
        ? "Anywhere with a beach"
        : w.kind === "custom"
          ? w.text
          : "Anywhere";

const titleCase = (t: string) => t.replace(/\b\p{L}/gu, (c) => c.toUpperCase());

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
  // Arriving from a Discover search with no match: start with that search open.
  useEffect(() => {
    const pre = new URLSearchParams(window.location.search).get("q");
    if (pre) {
      setQ(pre);
      setFocus(true);
    }
  }, []);
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

  // The world airport list loads the first time someone types a destination.
  const [world, setWorld] = useState<WorldAirport[] | null>(null);
  useEffect(() => {
    if (focus && !world) import("@/lib/worldAirports").then((m) => setWorld(m.WORLD_AIRPORTS));
  }, [focus, world]);
  const priced = useMemo(() => {
    if (!world) return [];
    const codes = new Map<string, string>();
    for (const r of all) codes.set(r.trip.city, r.trip.code);
    return cities
      .map((c) => ({ ...c, code: codes.get(c.city)!, at: coordsFor(world, codes.get(c.city)!) }))
      .filter((c): c is typeof c & { at: [number, number] } => !!c.at);
  }, [world, all, cities]);
  /** The closest destination we price, if it's a reasonable alternative. */
  const nearestPriced = (p: WorldPlace) => {
    let best: { city: string; region: Region; mi: number } | null = null;
    for (const c of priced) {
      const mi = miles(p.lat, p.lng, c.at[0], c.at[1]);
      if (mi < 500 && (!best || mi < best.mi)) best = { city: c.city, region: c.region, mi: Math.round(mi / 5) * 5 };
    }
    return best;
  };

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
    const exact = cities.some((c) => c.city.toLowerCase() === t);
    const list = out.slice(0, 6);
    // Real places from the world airport list that we don't price yet.
    const pricedCodes = new Set(priced.map((c) => c.code));
    const pricedCities = new Set(cities.map((c) => c.city.toLowerCase()));
    const found = world ? searchWorld(world, q, 6).filter((p) => !pricedCities.has(p.city.toLowerCase())) : [];
    const placesFound: WorldPlace[] = [];
    for (const p of found) {
      // A place that flies into one of our destinations becomes that destination.
      const via = priced.find((c) => p.codes.includes(c.code));
      if (via) {
        if (!list.some((w) => w.kind === "city" && w.city === via.city)) list.unshift({ kind: "city", city: via.city, region: via.region, via: p.city });
      } else placesFound.push(p);
    }
    for (const p of placesFound.slice(0, 5)) list.push({ kind: "custom", text: placeLabel(p), place: p });
    // Anything else can still be requested as typed.
    if (t.length >= 2 && !exact && !found.length) list.push({ kind: "custom", text: titleCase(q.trim()) });
    return list;
  }, [q, cities, regions, world, priced]);

  const match = (w: Where, c: PlannedTrip["cabin"], n: number): TripResult[] =>
    evalAll({ ...input, travelers: n })
      .filter((r) =>
        w.kind === "city"
          ? r.trip.city === w.city
          : w.kind === "region"
            ? r.trip.region === w.region
            : w.kind === "beach"
              ? r.trip.kind === "beach"
              : w.kind === "anywhere",
      )
      .filter((r) => (c === "any" ? true : c === "business" ? r.isBusiness : !r.isBusiness))
      .sort((a, b) => Number(b.ok) - Number(a.ok) || (a.ok ? b.cashTotal - a.cashTotal : a.gap - b.gap));

  const results: TripResult[] = searched ? match(searched.where, searched.cabin, searched.travelers) : [];

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
    sendToTeam("watch", `${r.trip.city}, ${state.airport} → ${r.trip.code}`, [
      `${shortDate(plan.depart)}${plan.ret ? ` – ${shortDate(plan.ret)}` : " · one way"}${plan.flexible ? " ± 3 days" : ""}`,
      `${plural(plan.travelers, "traveler")} · ${plan.cabin === "any" ? "any cabin" : plan.cabin}`,
      `${num(r.need)} points · ${r.ok ? "they have enough" : `short ${num(r.gap)}`}`,
    ], state);
    update((s) => ({ planned: [...s.planned, plan] }));
  };

  // One card, three states: search, request (nothing priced, or they asked to), and sent.
  const { find, submit } = useSubmitRequest();
  const [wantRequest, setWantRequest] = useState(false);
  const [note, setNote] = useState("");
  const [sent, setSent] = useState<TripRequest | null>(null);
  const liveCount = where ? match(where, cabin, travelers).length : -1;
  const requesting = !!where && (liveCount === 0 || wantRequest);
  const reason = where?.kind === "custom" ? "unpriced" : liveCount === 0 ? "cabin" : "more";
  const draft: RequestDraft | null = where
    ? { destination: where.kind === "custom" && where.place ? `${whereLabel(where)} (${where.place.codes.join("/")})` : whereLabel(where), depart, ret: oneWay ? "" : ret, flexible, travelers, cabin }
    : null;
  const already = draft ? find(draft) : undefined;
  const chooseWhere = (w: Where | null) => {
    setWhere(w);
    setWantRequest(false);
    setSearched(null);
  };
  const startOver = () => {
    setSent(null);
    setNote("");
    setQ("");
    chooseWhere(null);
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

      {sent ? (
        <div className="rise mx-4 flex flex-col gap-4 rounded-[28px] bg-surface p-5 shadow-[0_10px_30px_rgba(15,23,48,0.10)]" aria-live="polite">
          <div className="flex items-center gap-3">
            <span className="check-in flex h-11 w-11 items-center justify-center rounded-2xl bg-trace-green text-white">
              <Check size={20} />
            </span>
            <div className="flex flex-col leading-tight">
              <span className="text-[19px] font-extrabold">Request sent</span>
              <span className="text-[13.5px] text-muted">We&apos;ll price it in your points and let you know.</span>
            </div>
          </div>
          <RequestStatus r={sent} bare />
          <div className="grid grid-cols-2 gap-2">
            <Link href="/trips" className="flex min-h-[50px] items-center justify-center rounded-2xl bg-soft text-[14.5px] font-bold">
              My trips
            </Link>
            <button type="button" onClick={startOver} className="bg-trace min-h-[50px] rounded-2xl text-[14.5px] font-extrabold text-white">
              Plan another trip
            </button>
          </div>
        </div>
      ) : (
        <form
          className="mx-4 flex flex-col gap-4 rounded-[28px] bg-surface p-4 shadow-[0_10px_30px_rgba(15,23,48,0.10)]"
          onSubmit={(e) => {
            e.preventDefault();
            if (!canSearch || !where || !draft) return;
            if (requesting) {
              if (already) return;
              setSent(submit(draft, note, reason));
              setNote("");
              return;
            }
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
                  chooseWhere(null);
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
                    className="min-h-[54px] w-full rounded-2xl bg-soft pr-4 pl-11 text-[16.5px] outline-none focus:bg-surface focus:ring-2 focus:ring-trace-pink"
                  />
                </div>
                {focus && (
                  <ul className="absolute inset-x-0 z-20 mt-2 max-h-[320px] overflow-auto rounded-2xl border border-line bg-surface p-1.5 shadow-[0_16px_40px_rgba(15,23,48,0.16)]" role="listbox">
                    {suggestions.map((s) => (
                      <li key={whereLabel(s)}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={false}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            chooseWhere(s);
                            setFocus(false);
                          }}
                          className="flex min-h-[50px] w-full items-center gap-3 rounded-xl px-3 text-left active:bg-soft"
                        >
                          {s.kind === "city" ? (
                            <TripThumb city={s.city} code="" className="h-9 w-9 shrink-0 rounded-lg" showCode={false} />
                          ) : s.kind === "custom" && s.place ? (
                            <span className="nums flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-soft text-[11px] font-extrabold text-muted">
                              {s.place.codes[0]}
                            </span>
                          ) : (
                            <span
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
                              style={{ background: s.kind === "region" ? REGION_COLOR[s.region] : s.kind === "beach" ? "#14B8A6" : s.kind === "custom" ? "#7C3AED" : "#FD297B" }}
                            >
                              <Icon d={s.kind === "anywhere" ? ICONS.sparkle : s.kind === "custom" ? ICONS.plus : ICONS.compass} size={17} />
                            </span>
                          )}
                          <span className="flex flex-col leading-tight">
                            <span className="text-[15px] font-bold">{s.kind === "custom" && !s.place ? `Request “${s.text}”` : whereLabel(s)}</span>
                            <span className="text-[12px] text-muted">
                              {s.kind === "city"
                              ? s.via
                                ? `For ${s.via} · ${s.region}`
                                : s.region
                                : s.kind === "region"
                                  ? `${plural(cities.filter((c) => c.region === s.region).length, "destination")}`
                                  : s.kind === "custom"
                                    ? s.place
                                      ? (() => {
                                          const n = nearestPriced(s.place);
                                          return n ? `Not priced yet · ${n.city} is ${n.mi} mi away` : `${s.place.codes.join(" · ")} · Not priced yet, request it`;
                                        })()
                                      : "Not priced yet. Ask Trace to find it"
                                    : "Show me the best options"}
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
                  <button key={String(v)} type="button" aria-pressed={oneWay === v} onClick={() => setOneWay(v as boolean)} className={cx("rounded-full px-3 py-1.5", oneWay === v ? "bg-surface shadow-sm" : "text-muted")}>
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
              <span className={cx("flex h-7 w-12 shrink-0 rounded-full p-0.5 transition", flexible ? "justify-end bg-trace-pink" : "justify-start bg-line")}>
                <span className="h-6 w-6 rounded-full bg-white shadow" />
              </span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <span className="text-[12px] font-extrabold tracking-[0.06em] text-muted uppercase">Travelers</span>
              <div className="flex min-h-[50px] items-center justify-between rounded-2xl bg-soft px-1.5">
                <button type="button" aria-label="Fewer travelers" disabled={travelers <= 1} onClick={() => setTravelers(travelers - 1)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface disabled:opacity-40">
                  <Icon d={ICONS.minus} size={16} stroke={2.6} />
                </button>
                <span className="nums text-[17px] font-extrabold" aria-live="polite">{travelers}</span>
                <button type="button" aria-label="More travelers" disabled={travelers >= 6} onClick={() => setTravelers(travelers + 1)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface disabled:opacity-40">
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

          {requesting && (
            <div className="rise flex flex-col gap-3 rounded-3xl bg-gradient-to-br from-[#F3EEFF] via-[#FFF0F6] to-[#FFF4E5] p-4 dark:from-[#1E1A3A] dark:via-[#2A1630] dark:to-[#2A2014]">
              <div className="flex items-start gap-3">
                <span className="bg-trace flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white">
                  <Icon d={ICONS.sparkle} size={20} stroke={2.2} />
                </span>
                <div className="flex flex-col">
                  <span className="text-[16px] leading-tight font-extrabold">
                    {reason === "unpriced"
                      ? `We don't price ${whereLabel(where!)} yet`
                      : reason === "cabin"
                        ? `No ${cabinText(cabin)} options for ${whereLabel(where!)} yet`
                        : `Request ${whereLabel(where!)}`}
                  </span>
                  <span className="pt-0.5 text-[13.5px] leading-snug text-muted">
                    Request it and a Trace analyst prices it in your points, then watches for seats on your dates. Usually within 24 hours.
                  </span>
                </div>
              </div>
              {where?.kind === "custom" && where.place && (() => {
                const n = nearestPriced(where.place);
                return n ? (
                  <button
                    type="button"
                    onClick={() => chooseWhere({ kind: "city", city: n.city, region: n.region })}
                    className="flex min-h-[52px] items-center gap-3 rounded-2xl bg-surface px-3 text-left active:scale-[0.99]"
                  >
                    <TripThumb city={n.city} code="" className="h-9 w-9 shrink-0 rounded-lg" showCode={false} />
                    <span className="flex min-w-0 flex-1 flex-col leading-tight">
                      <span className="text-[14px] font-bold">Or fly into {n.city}, {n.mi} mi away</span>
                      <span className="text-[12px] text-muted">We price that one now</span>
                    </span>
                    <Icon d={ICONS.chevron} size={16} stroke={2.4} className="text-muted" />
                  </button>
                ) : null;
              })()}
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-extrabold tracking-[0.06em] text-muted uppercase">Anything else? (optional)</span>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  maxLength={280}
                  placeholder="Nonstop only, a specific airline, use my Amex first…"
                  className="resize-none rounded-2xl bg-surface px-4 py-3 text-[15px] outline-none focus:ring-2 focus:ring-trace-pink"
                />
              </label>
            </div>
          )}

          <PrimaryButton type="submit" disabled={!canSearch || (requesting && !!already)}>
            {!where ? "Choose where to go" : requesting ? (already ? "Already requested" : "Request this trip") : `Search ${whereLabel(where)}`}
          </PrimaryButton>
          {where && liveCount > 0 && (
            <button
              type="button"
              onClick={() => setWantRequest(!wantRequest)}
              className="-mt-1 min-h-[40px] text-[14px] font-bold text-muted"
            >
              {wantRequest ? "Back to search" : "Can't find what you want? Request it"}
            </button>
          )}
          {requesting && already && (
            <Link href="/trips" className="-mt-1 text-center text-[14px] font-bold text-trace-pink">See your request in My trips</Link>
          )}
        </form>
      )}

      {searched && !requesting && !sent && results.length > 0 && (
        <section className="flex flex-col gap-3 px-4" aria-live="polite">
          <div className="flex items-baseline justify-between px-1">
            <h2 className="text-[19px] font-extrabold">{plural(results.length, "option")}</h2>
            <span className="text-[12.5px] font-semibold text-muted">
              {shortDate(depart)}{oneWay ? "" : ` – ${shortDate(ret)}`}{flexible ? " ± 3 days" : ""} · {plural(searched.travelers, "traveler")}
            </span>
          </div>
          {results.map((r, i) => {
            const on = !!watchingId(r.trip.id);
            return (
              <article key={r.trip.id} className="rise overflow-hidden rounded-[24px] bg-surface shadow-[0_8px_24px_rgba(15,23,48,0.08)]" style={stagger(i, 40)}>
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
                          on ? "bg-ok-bg text-ok" : "bg-ink text-surface",
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
          <p className="px-1 text-[12px] leading-snug text-muted">
            Prices are typical saver awards, not live availability. Watching a trip asks Trace to check real seats on your dates.
          </p>
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
                  setSent(null);
                  chooseWhere({ kind: "city", city: c, region });
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
    <label className="flex min-h-[54px] flex-col justify-center rounded-2xl bg-soft px-4 py-1.5 focus-within:bg-surface focus-within:ring-2 focus-within:ring-trace-pink">
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
