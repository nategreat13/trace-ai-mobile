"use client";

import { useEffect, useMemo, useState } from "react";
import type { TripResult } from "@/engine/types";
import { track } from "@/lib/analytics";
import { money, plural } from "@/lib/format";
import { usePoints, useDeck } from "@/lib/store";
import { Chip, cx, Eyebrow, Icon, ICONS } from "../ui";
import { FILTERS, SORTS, sortTrips, type FilterId, type SortId } from "./filters";
import { SwipeDeck } from "./SwipeDeck";
import { TripList } from "./TripList";

export const FREE_TRIPS = 3;

/**
 * The results experience, shared by the free funnel and the member Discover
 * page. Free mode locks everything past the top three trips; member mode
 * unlocks it all and adds hearts.
 */
export function ResultsView({
  mode,
  onOpen,
  onPaywall,
  countUp = false,
}: {
  mode: "free" | "member";
  onOpen: (r: TripResult) => void;
  onPaywall: (r?: TripResult) => void;
  countUp?: boolean;
}) {
  const { state, update } = usePoints();
  const { deck, ok, near, values } = useDeck();
  const [view, setView] = useState<"list" | "swipe">("list");
  const [filter, setFilter] = useState<FilterId>("all");
  const [sort, setSort] = useState<SortId>("best");
  const [panel, setPanel] = useState(false);
  const shown = useCountUp(values.flights, countUp);

  const freeIds = useMemo(() => new Set(deck.slice(0, FREE_TRIPS).map((r) => r.trip.id)), [deck]);
  const isLocked = (r: TripResult) => mode === "free" && !freeIds.has(r.trip.id);

  const active = FILTERS.find((f) => f.id === filter)!;
  const filtered = sortTrips(deck.filter(active.test), sort, state.picks);
  const filterActive = filter !== "all" || sort !== "best";

  const toggleSave = (r: TripResult) => {
    if (isLocked(r)) return onPaywall(r);
    update((s) => ({
      saved: s.saved.includes(r.trip.id) ? s.saved.filter((x) => x !== r.trip.id) : [...s.saved, r.trip.id],
    }));
  };
  const open = (r: TripResult) => {
    if (isLocked(r)) {
      track("locked_row_tap", { trip: r.trip.id });
      return onPaywall(r);
    }
    onOpen(r);
  };

  const travelers = plural(state.travelers, "traveler");
  const savedCount = state.saved.length;

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-col gap-0.5 px-5 pt-4">
        <div className="text-[14px] font-semibold text-muted">Your points are worth</div>
        <div className="bg-gradient-to-r from-trace-red to-trace-pink bg-clip-text text-[48px] leading-none font-black tracking-tight text-transparent">
          {money(countUp ? shown : values.flights)}
        </div>
        <div className="text-[13px] text-muted">in flights · estimate</div>
        <div className="mt-2 text-[17px] font-extrabold">
          {ok.length ? `Your points can book ${plural(ok.length, "trip")}` : `You're close to ${plural(near.length, "trip")}`}
        </div>
        <div className="text-[13px] text-muted">
          From {state.airport} for {travelers}
          {ok.length > 0 && near.length > 0 && ` · ${near.length} more almost in reach`}
        </div>
      </div>

      <div className="sticky top-0 z-20 flex items-center gap-2 bg-white/95 px-5 py-3 backdrop-blur">
        <div role="tablist" aria-label="View" className="grid flex-1 grid-cols-2 gap-1 rounded-xl bg-soft p-1">
          {(["list", "swipe"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={cx("min-h-[40px] rounded-[10px] text-[15px] font-bold capitalize", view === v ? "bg-white text-ink shadow-sm" : "text-muted")}
            >
              {v}
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-label="Filter and sort"
          aria-expanded={panel}
          onClick={() => setPanel(true)}
          className={cx("relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border bg-white", filterActive ? "border-trace-red text-trace-red" : "border-line text-ink")}
        >
          <Icon d={ICONS.filter} size={20} stroke={2.2} />
          {filterActive && <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-trace-red" />}
        </button>
      </div>

      <div className="flex flex-1 flex-col px-5 pb-6">
        {view === "list" ? (
          <TripList
            ok={filtered.filter((r) => r.ok)}
            near={filtered.filter((r) => !r.ok)}
            picks={state.picks}
            isLocked={isLocked}
            saved={state.saved}
            showHearts={mode === "member"}
            onOpen={open}
            onToggleSave={toggleSave}
          />
        ) : (
          <SwipeDeck
            key={`${filter}-${sort}`}
            cards={mode === "free" ? deck : filtered}
            freeCount={mode === "free" ? FREE_TRIPS : null}
            origin={state.airport ?? ""}
            travelers={state.travelers}
            onSave={(r) => {
              track("swipe_save", { trip: r.trip.id });
              update((s) => ({ saved: s.saved.includes(r.trip.id) ? s.saved : [...s.saved, r.trip.id] }));
            }}
            onSkip={(r) => track("swipe_skip", { trip: r.trip.id })}
            onInfo={open}
            onLocked={() => onPaywall()}
            onDone={() => setView("list")}
          />
        )}
      </div>

      {mode === "free" && (
        <div className="pb-safe sticky bottom-0 z-20 border-t border-line bg-white/95 px-5 pt-3 backdrop-blur">
          <button
            type="button"
            onClick={() => onPaywall()}
            className="min-h-[54px] w-full rounded-[14px] bg-gradient-to-r from-trace-red to-trace-pink px-4 text-[16px] font-extrabold text-white shadow-[0_8px_24px_rgba(253,41,123,0.25)]"
          >
            Unlock dates {savedCount ? `for my ${plural(savedCount, "saved trip")}` : `for all ${plural(deck.length, "trip")}`}
          </button>
          <div className="pt-1.5 text-center text-[12px] text-muted">Free for 7 days · Exact dates, seat alerts, booking steps</div>
        </div>
      )}

      {panel && (
        <FilterSheet
          deck={deck}
          filter={filter}
          sort={sort}
          resultCount={filtered.length}
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
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-[480px] flex-col justify-end" role="dialog" aria-modal="true" aria-label="Filter and sort">
      <button type="button" aria-label="Close filters" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div className="rise pb-safe relative flex flex-col gap-4 rounded-t-3xl bg-white px-5 pt-5">
        <div className="mx-auto h-1 w-10 rounded-full bg-line" />
        <Eyebrow>Show</Eyebrow>
        <div className="-mt-1 flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const n = deck.filter(f.test).length;
            if (!n && f.id !== "all") return null;
            return (
              <Chip key={f.id} on={filter === f.id} onClick={() => onFilter(f.id)}>
                {f.label} <span className="opacity-70">{n}</span>
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
        <div className="flex items-center justify-between gap-3 pt-1">
          <button type="button" onClick={onReset} className="min-h-[48px] px-2 text-[15px] font-bold text-muted">
            Reset
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[48px] flex-1 rounded-[14px] bg-ink px-4 text-[15px] font-extrabold text-white"
          >
            Show {plural(resultCount, "trip")}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Eases a number up from zero once, for the first look at the dollar value. */
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
      const p = Math.min(1, (t - start) / 1200);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, enabled]);
  return v;
}
