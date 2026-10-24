"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import { fuzzyIncludes } from "@/lib/fuzzy";
import type { TripResult } from "@/engine/types";
import { track } from "@/lib/analytics";
import { groupDestinations, rankDestinations, type Destination } from "@/lib/destinations";
import { money, num, plural } from "@/lib/format";
import { STARTER, usePoints, useDeck } from "@/lib/store";
import { useBackClose } from "@/lib/useBackClose";
import { Check, Chip, cx, Eyebrow, Icon, ICONS, LockIcon } from "../ui";
import { useCashDeals } from "@/lib/cashDeals";
import { yearlyOff } from "@/lib/payments";
import { DestinationCard } from "./DestinationCard";
import { BonusBanner } from "./Insights";
import { FILTERS, SORTS, filterDestinations, sortDestinations, type FilterId, type SortId } from "./filters";
import { SwipeDeck } from "./SwipeDeck";

export const FREE_DESTINATIONS = 3;

/** Why the paywall opened, so its headline can match. */
export type PayReason = "locked" | "filters" | "search" | "cta";

/**
 * The results experience, shared by the free funnel and the member Discover
 * page. One card per destination, economy and business inside it. Free mode
 * locks everything past the top three destinations; member mode unlocks it
 * all and adds hearts.
 */
export function ResultsView({
  mode,
  onOpen,
  onPaywall,
  countUp = false,
}: {
  mode: "free" | "member";
  onOpen: (r: TripResult) => void;
  onPaywall: (reason: PayReason, r?: TripResult) => void;
  countUp?: boolean;
}) {
  const { state, update } = usePoints();
  const { deck, values } = useDeck();
  const [view, setView] = useState<"list" | "swipe">("list");
  const [filter, setFilter] = useState<FilterId>("all");
  const [sort, setSort] = useState<SortId>("best");
  const [panel, setPanel] = useState(false);
  useBackClose(view === "swipe", () => setView("list"));
  useBackClose(panel, () => setPanel(false));
  const [query, setQuery] = useState("");
  const shown = useCountUp(values.flights, countUp);

  // Read once per visit: saving a trip shouldn't reshuffle the list mid-scroll.
  const [savedCities] = useState(() => [...new Set(deck.filter((r) => state.saved.includes(r.trip.id)).map((r) => r.trip.city))]);
  // Cheapest bookable trip first, then their picks, then what they've shown they like.
  const all = useMemo(
    () => rankDestinations(groupDestinations(deck), { picks: state.picks, saved: savedCities }),
    [deck, state.picks, savedCities],
  );
  const rank = useMemo(() => new Map(all.map((d, i) => [d.city, i])), [all]);
  const freeCities = useMemo(() => new Set(all.slice(0, FREE_DESTINATIONS).map((d) => d.city)), [all]);
  const isLocked = (city: string) => mode === "free" && !freeCities.has(city);

  const matches = (d: Destination) => matchesQuery(d, query);
  const filtered = filterDestinations(deck, filter).filter(matches);
  const shownDest =
    sort === "best" ? filtered.sort((a, b) => (rank.get(a.city) ?? 999) - (rank.get(b.city) ?? 999)) : sortDestinations(filtered, sort, state.picks);
  const okDest = shownDest.filter((d) => d.ok);
  const nearDest = shownDest.filter((d) => !d.ok);
  const filterActive = filter !== "all" || sort !== "best";
  const allOk = all.filter((d) => d.ok).length;
  const allNear = all.length - allOk;

  const isSaved = (d: Destination) => d.options.some((o) => state.saved.includes(o.trip.id));
  const toggleSave = (d: Destination) => {
    if (isLocked(d.city)) return onPaywall("locked", d.lead);
    const ids = d.options.map((o) => o.trip.id);
    update((s) => ({
      saved: ids.some((id) => s.saved.includes(id)) ? s.saved.filter((x) => !ids.includes(x)) : [...s.saved, d.lead.trip.id],
    }));
  };
  const open = (r: TripResult) => {
    if (isLocked(r.trip.city)) {
      track("locked_row_tap", { trip: r.trip.id });
      return onPaywall("locked", r);
    }
    onOpen(r);
  };

  const savedCount = state.saved.length;
  // Cash fares from Trace's deals feed, for the trips they're short on.
  const cashDeals = useCashDeals(state.airport, all.filter((d) => !d.ok).map((d) => d.city));
  const card = (d: Destination, i: number) => (
    <DestinationCard
      key={d.city}
      d={d}
      i={i}
      origin={state.airport ?? ""}
      picked={state.picks.includes(d.city)}
      locked={isLocked(d.city)}
      saved={isSaved(d)}
      showHeart={mode === "member"}
      onOpen={open}
      onToggleSave={toggleSave}
      cashDeal={d.ok ? undefined : cashDeals[d.city]}
    />
  );

  return (
    <div className="flex flex-1 flex-col">
      <header className="relative overflow-hidden px-5 pt-3 pb-5">
        <div aria-hidden="true" className="absolute -top-24 -right-20 h-64 w-64 rounded-full bg-trace-pink/15 blur-3xl" />
        <div aria-hidden="true" className="absolute -top-10 -left-24 h-56 w-56 rounded-full bg-sky/15 blur-3xl" />
        <div className="relative flex flex-col gap-1">
          <Eyebrow className="text-trace-pink">{state.starter ? "One card bonus can cover" : "Your points can cover"}</Eyebrow>
          <div className="flex items-baseline gap-2">
            <span className="text-gradient nums text-[54px] leading-none font-extrabold tracking-[-0.03em]">{money(countUp ? shown : values.flights)}</span>
            <span className="text-[15px] font-bold text-muted">of flights*</span>
          </div>
          <p className="pt-2 text-[19px] leading-snug font-extrabold tracking-[-0.01em]">
            {allOk
              ? <>You can fly free to <span className="text-ok">{plural(allOk, "place")}</span> ✈️</>
              : <><span className="text-near">{plural(allNear, "trip")}</span> need just a few more points</>}
          </p>
          <p className="text-[12px] text-muted">
            {state.starter ? `*With a ${STARTER.card} bonus (${num(STARTER.points)} points). ` : "*"}Estimates, {state.travelers === 1 ? "per ticket" : `for ${plural(state.travelers, "traveler")}`}.
          </p>
        </div>
        <div role="tablist" aria-label="View" className="relative mt-4 grid grid-cols-2 rounded-2xl bg-soft p-1">
          <span
            aria-hidden="true"
            className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-xl bg-surface shadow-sm transition-transform duration-300"
            style={{ transform: view === "swipe" ? "translateX(100%)" : "none" }}
          />
          {(["list", "swipe"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={cx("relative min-h-[42px] text-[15px] font-bold capitalize transition-colors", view === v ? "text-ink" : "text-muted")}
            >
              {v}
            </button>
          ))}
        </div>
      </header>

      <div className="sticky top-0 z-20 flex items-center gap-2 bg-surface/90 px-5 py-3 backdrop-blur-md">
        {mode === "free" ? (
          <button
            type="button"
            onClick={() => onPaywall("search")}
            className="relative flex min-h-[50px] flex-1 items-center gap-2.5 rounded-2xl bg-soft pr-10 pl-3.5 text-left text-[15.5px] text-muted active:scale-[0.99]"
          >
            <Icon d={ICONS.search} size={18} />
            <span className="truncate">Search {plural(all.length, "destination")}</span>
            <span className="bg-trace absolute top-1/2 right-2.5 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-white">
              <LockIcon size={11} />
            </span>
          </button>
        ) : (
        <div className="relative flex-1">
          <label htmlFor="deal-search" className="sr-only">Search your deals</label>
          <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted"><Icon d={ICONS.search} size={18} /></span>
          <input
            id="deal-search"
            type="search"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${plural(all.length, "destination")}`}
            className="min-h-[50px] w-full rounded-2xl bg-soft pr-10 pl-10 text-[15.5px] outline-none focus:bg-surface focus:ring-2 focus:ring-trace-pink [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery("")}
              className="absolute top-1/2 right-2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted active:bg-line"
            >
              <Icon d={ICONS.close} size={14} stroke={2.6} />
            </button>
          )}
        </div>
        )}
        <button
          type="button"
          aria-label="Filter and sort"
          aria-expanded={panel}
          onClick={() => (mode === "free" ? onPaywall("filters") : setPanel(true))}
          className={cx("relative flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-2xl transition active:scale-95", filterActive ? "bg-ink text-surface" : "bg-soft text-ink")}
        >
          <Icon d={ICONS.filter} size={20} stroke={2.4} />
          {filterActive && <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full border-2 border-ink bg-trace-pink" />}
          {mode === "free" && (
            <span className="bg-trace absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full text-white ring-2 ring-surface">
              <LockIcon size={10} />
            </span>
          )}
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-4 px-4 pt-1 pb-8">
        {shownDest.length === 0 ? (
            query ? (
              <div className="rise flex flex-col items-center gap-3 px-4 py-12 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-soft text-muted"><Icon d={ICONS.search} size={22} /></span>
                <div className="text-[18px] font-extrabold">No deals for &ldquo;{query}&rdquo; yet</div>
                <p className="text-[14.5px] leading-snug text-muted">
                  {mode === "member" ? "Search every airport in the world and we'll price it for you." : "Members can request any destination and we'll price it in their points."}
                </p>
                {mode === "member" ? (
                  <Link href={`/plan?q=${encodeURIComponent(query)}`} className="bg-trace mt-1 rounded-2xl px-5 py-3 text-[15px] font-extrabold text-white">
                    Search all airports for &ldquo;{query}&rdquo;
                  </Link>
                ) : (
                  <button type="button" onClick={() => setQuery("")} className="mt-1 rounded-2xl bg-soft px-5 py-3 text-[15px] font-bold">
                    Clear search
                  </button>
                )}
              </div>
            ) : (
              <p className="py-12 text-center text-[15px] text-muted">No trips match this filter yet.</p>
            )
          ) : (
            <>
              {!query && <BonusBanner onOpen={open} />}
              {okDest.length > 0 && <SectionHead ok label="You have enough points" count={okDest.length} />}
              {okDest.map((d, i) => (
                <Fragment key={d.city}>
                  {card(d, i)}
                  {mode === "free" && i === 1 && <EmailListCard />}
                </Fragment>
              ))}
              {nearDest.length > 0 && <SectionHead ok={false} label="Need a few more points" count={nearDest.length} />}
              {nearDest.map((d, i) => card(d, i + okDest.length))}
            </>
          )}
      </div>

      {view === "swipe" && (
        <SwipeLayer count={all.length} onClose={() => setView("list")}>
          <SwipeDeck
            key={`${filter}-${sort}-${query}`}
            cards={mode === "free" ? all.filter(matches) : shownDest}
            freeCount={mode === "free" ? FREE_DESTINATIONS : null}
            origin={state.airport ?? ""}
            travelers={state.travelers}
            onSave={(d) => {
              track("swipe_save", { trip: d.lead.trip.id });
              if (!isSaved(d)) update((s) => ({ saved: [...s.saved, d.lead.trip.id] }));
            }}
            onSkip={(d) => track("swipe_skip", { trip: d.lead.trip.id })}
            onInfo={open}
            onLocked={() => onPaywall("locked")}
            onDone={() => setView("list")}
          />
        </SwipeLayer>
      )}

      {mode === "free" && (
        <div className="pb-safe sticky bottom-0 z-20 bg-gradient-to-t from-surface from-60% to-surface/0 px-5 pt-6">
          <button
            type="button"
            onClick={() => onPaywall("cta")}
            className="bg-trace shimmer min-h-[58px] w-full rounded-2xl px-4 text-[16.5px] font-extrabold text-white shadow-[0_10px_28px_rgba(253,41,123,0.32)] active:scale-[0.98]"
          >
            {state.gift && !state.member
              ? `Unlock with ${yearlyOff(true)}% off 🎁`
              : `Unlock dates ${savedCount ? `for my ${plural(savedCount, "saved trip")}` : `for all ${plural(all.length, "destination")}`}`}
          </button>
          <div className="pt-2 text-center text-[12.5px] font-medium text-muted">Exact dates · Seat alerts · Booking help</div>
        </div>
      )}

      {panel && (
        <FilterSheet
          deck={deck}
          filter={filter}
          sort={sort}
          resultCount={shownDest.length}
          onFilter={setFilter}
          onSort={setSort}
          onReset={() => {
            setFilter("all");
            setSort("best");
          }}
          onClose={() => setPanel(false)}
        />
      )}
    </div>
  );
}

/**
 * Optional email capture that sits in the list instead of blocking it: people
 * see their trips first, and anyone who wants the list (or bonus alerts) can
 * leave an address. Checkout asks again, since an account needs one.
 */
function EmailListCard() {
  const { state, update } = usePoints();
  const { deck } = useDeck();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  if (state.email && !sent) return null;
  const valid = /.+@.+\..+/.test(email);
  return (
    <div className="rise flex flex-col gap-3 rounded-[28px] bg-gradient-to-br from-[#EEF6FF] via-[#F6F1FF] to-[#FFF0F6] p-5 dark:from-[#14203A] dark:via-[#1E1A3A] dark:to-[#2A1630]">
      {sent ? (
        <div className="flex items-center gap-3">
          <span className="check-in flex h-10 w-10 items-center justify-center rounded-2xl bg-trace-green text-white"><Check size={18} /></span>
          <span className="text-[15px] font-bold">Sent to {state.email}. Keep scrolling.</span>
        </div>
      ) : (
        <>
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky text-white">
              <Icon d={ICONS.bell} size={19} stroke={2.2} />
            </span>
            <div>
              <div className="text-[17px] leading-tight font-extrabold">Email me this list 📬</div>
            </div>
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!valid) return;
              update({ email });
              track("email_captured", { where: "results", trips: deck.length });
              setSent(true);
            }}
          >
            <label htmlFor="list-email" className="sr-only">Email</label>
            <input
              id="list-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="min-h-[50px] min-w-0 flex-1 rounded-2xl bg-surface px-4 text-[16px] outline-none focus:ring-2 focus:ring-trace-pink"
            />
            <button type="submit" disabled={!valid} className="min-h-[50px] rounded-2xl bg-ink px-4 text-[15px] font-extrabold text-surface disabled:opacity-40">
              Send
            </button>
          </form>
        </>
      )}
    </div>
  );
}

/** Matches a search against a destination's city, airport, region, kind and cabins. */
function matchesQuery(d: Destination, query: string): boolean {
  const q = query.toLowerCase().trim();
  if (!q) return true;
  const tokens = [
    d.city,
    d.code,
    d.region,
    d.kind === "beach" ? "beach beaches" : d.kind === "nature" ? "nature outdoors mountains" : "city cities",
    d.international ? "international abroad" : "domestic usa",
    ...d.options.map((o) => (o.isBusiness ? "business first lie-flat lieflat premium" : "economy")),
  ]
    .join(" ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[\s,&]+/);
  return q
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/\s+/)
    .every((w) => fuzzyIncludes(tokens, w));
}

function SectionHead({ ok, label, count }: { ok: boolean; label: string; count: number }) {
  return (
    <div className="flex items-center justify-between px-1 pt-3">
      <span className={cx("flex items-center gap-2 text-[13px] font-extrabold tracking-[0.06em] uppercase", ok ? "text-ok" : "text-near")}>
        <span className={cx("relative flex h-2.5 w-2.5")}>
          <span className={cx("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", ok ? "bg-trace-green" : "bg-[#F59E0B]")} />
          <span className={cx("relative inline-flex h-2.5 w-2.5 rounded-full", ok ? "bg-trace-green" : "bg-[#F59E0B]")} />
        </span>
        {label}
      </span>
      <span className="nums rounded-full bg-soft px-2.5 py-0.5 text-[12px] font-bold text-muted">{count}</span>
    </div>
  );
}

function FilterSheet({
  deck,
  filter,
  sort,
  resultCount,
  onFilter,
  onSort,
  onReset,
  onClose,
}: {
  deck: TripResult[];
  filter: FilterId;
  sort: SortId;
  resultCount: number;
  onFilter: (f: FilterId) => void;
  onSort: (s: SortId) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-[480px] flex-col justify-end" role="dialog" aria-modal="true" aria-label="Filter and sort">
      <button type="button" aria-label="Close filters" onClick={onClose} className="fade absolute inset-0 bg-midnight/50" />
      <div className="sheet-up pb-safe relative flex flex-col gap-4 rounded-t-[32px] bg-surface px-5 pt-3">
        <div className="mx-auto h-1.5 w-10 rounded-full bg-line" />
        <div className="text-[20px] font-extrabold">Filter and sort</div>
        <Eyebrow>Show</Eyebrow>
        <div className="-mt-1 flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const n = filterDestinations(deck, f.id).length;
            if (!n && f.id !== "all") return null;
            return (
              <Chip key={f.id} on={filter === f.id} onClick={() => onFilter(f.id)}>
                {f.label} <span className="nums opacity-60">{n}</span>
              </Chip>
            );
          })}
        </div>
        <Eyebrow>Sort by</Eyebrow>
        <div className="-mt-1 flex flex-wrap gap-2">
          {SORTS.map((s) => (
            <Chip key={s.id} on={sort === s.id} onClick={() => onSort(s.id)}>
              {s.label}
            </Chip>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3 pt-2">
          <button type="button" onClick={onReset} className="min-h-[52px] px-3 text-[15px] font-bold text-muted">
            Reset
          </button>
          <button type="button" onClick={onClose} className="bg-trace min-h-[54px] flex-1 rounded-2xl px-4 text-[16px] font-extrabold text-white">
            Show {plural(resultCount, "destination")}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Eases a number up from zero, for the first look at the dollar value. */
function useCountUp(target: number, enabled: boolean): number {
  const [v, setV] = useState(enabled ? 0 : target);
  useEffect(() => {
    if (!enabled) {
      setV(target);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 1400);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, enabled]);
  return v;
}

/**
 * Swipe mode takes the whole screen: cards sized to the phone, buttons
 * underneath, nothing to scroll past, and a clear way back to the list.
 */
function SwipeLayer({ count, onClose, children }: { count: number; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label="Swipe through destinations" className="fade fixed inset-0 z-50 mx-auto flex max-w-[480px] flex-col bg-surface">
      <div className="pt-safe flex items-center justify-between px-4 pb-2">
        <button type="button" onClick={onClose} className="flex min-h-[44px] items-center gap-1.5 rounded-xl px-2 text-[15px] font-bold active:bg-soft">
          <Icon d={ICONS.back} size={18} stroke={2.6} /> List
        </button>
        <span className="text-[13.5px] font-semibold text-muted">{plural(count, "destination")}</span>
      </div>
      <div className="pb-safe flex min-h-0 flex-1 flex-col px-4">{children}</div>
    </div>
  );
}
