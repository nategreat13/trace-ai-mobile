"use client";

import { PROGRAMS } from "@/engine/data";
import type { ProgramId } from "@/engine/types";
import { num } from "@/lib/format";
import { GUESS, usePoints } from "@/lib/store";
import { milesFor, tierFor } from "@/lib/tiers";
import { cx, ProgramBadge } from "../ui";

/**
 * The slider spends most of its track on everyday balances: the first 60%
 * covers 0 to 50,000 in 1,000s, then it ramps quickly up to the program's max.
 */
const EASY = 50_000;
const SPLIT = 0.6;
const STEPS = 1000;
const toPoints = (pos: number, max: number) => {
  const t = pos / STEPS;
  if (max <= EASY) return Math.round((t * max) / 1000) * 1000;
  if (t <= SPLIT) return Math.round(((t / SPLIT) * EASY) / 1000) * 1000;
  const ramp = ((t - SPLIT) / (1 - SPLIT)) ** 2;
  return Math.round((EASY + ramp * (max - EASY)) / 5000) * 5000;
};
/** One tap instead of dragging, for people who only know roughly. */
const QUICK = [10_000, 20_000, 50_000, 100_000];
const toPos = (points: number, max: number) => {
  const v = Math.min(points, max);
  if (max <= EASY) return (v / max) * STEPS;
  if (v <= EASY) return (v / EASY) * SPLIT * STEPS;
  return (SPLIT + Math.sqrt((v - EASY) / (max - EASY)) * (1 - SPLIT)) * STEPS;
};

/**
 * Number input, a slider and quick amounts, with a "Not sure" guess.
 * Controlled, so the funnel can write straight to the store while Account
 * edits a draft and saves on purpose. The card warms up as the balance grows.
 */
export function BalanceCard({
  id,
  value,
  estimated,
  onValue,
  onEstimated,
}: {
  id: ProgramId;
  value: number | "";
  estimated: boolean;
  onValue: (v: number | "") => void;
  onEstimated: (on: boolean) => void;
}) {
  const p = PROGRAMS[id];
  const shown = estimated ? GUESS : value;
  const numeric = Number(shown) || 0;
  const unit = p.kind === "airline" ? "miles" : "points";
  const tier = tierFor(milesFor(id, numeric));
  const set = (v: string) => {
    const clean = v.replace(/[^\d]/g, "");
    onValue(clean === "" ? "" : Math.min(9_999_999, Number(clean)));
  };

  return (
    <div
      className={cx("flex flex-col gap-3 rounded-3xl bg-surface p-4 shadow-[0_6px_20px_rgba(15,23,48,0.07)] transition-shadow duration-500", numeric ? "ring-2" : "ring-1 ring-line")}
      style={numeric ? ({ "--tw-ring-color": tier.color } as React.CSSProperties) : undefined}
    >
      <div className="flex items-center gap-3">
        <ProgramBadge id={id} size={40} />
        <label htmlFor={`bal-${id}`} className="flex-1 text-[15px] leading-tight font-bold">
          {p.name}
        </label>
        <button
          type="button"
          aria-pressed={estimated}
          onClick={() => onEstimated(!estimated)}
          className={cx("min-h-[34px] shrink-0 rounded-full px-3 text-[12.5px] font-bold", estimated ? "bg-trace text-white" : "bg-soft text-muted")}
        >
          {estimated ? "Estimated" : "Not sure"}
        </button>
      </div>
      <div className="flex items-center gap-2.5">
        <input
          id={`bal-${id}`}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="0"
          value={shown === "" ? "" : num(Number(shown))}
          onChange={(e) => set(e.target.value)}
          className="nums min-h-[54px] min-w-0 flex-1 rounded-2xl bg-soft px-4 text-[22px] font-extrabold outline-none transition-colors duration-500 focus:bg-surface focus:ring-2 focus:ring-trace-pink"
          style={{ color: numeric ? tier.color : undefined }}
        />
        <span className="text-[13px] text-muted">{unit}</span>
      </div>
      <input
        type="range"
        aria-label={`${p.name} slider`}
        min={0}
        max={STEPS}
        step={1}
        value={toPos(numeric, p.sliderMax)}
        onChange={(e) => set(String(toPoints(Number(e.target.value), p.sliderMax)))}
        style={{ accentColor: numeric ? tier.color : undefined }}
      />
      <div className="grid grid-cols-4 gap-1.5">
        {QUICK.map((q) => {
          const on = !estimated && numeric === q;
          return (
            <button
              key={q}
              type="button"
              aria-pressed={on}
              onClick={() => set(String(q))}
              className={cx("nums min-h-[38px] rounded-xl text-[13.5px] font-extrabold active:scale-95", on ? "bg-ink text-surface" : "bg-soft text-ink")}
            >
              {q / 1000}k{q === QUICK[QUICK.length - 1] ? "+" : ""}
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-2 text-[12.5px] text-muted">
        <span className="truncate">{estimated ? `Our guess: ${num(GUESS)}. Tap to change.` : `Exact number is in your ${p.short} app`}</span>
        {numeric > 0 && (
          <span key={tier.level} className="pop shrink-0 rounded-full px-2.5 py-0.5 text-[11.5px] font-extrabold text-white" style={{ background: tier.gradient }}>
            {tier.label}
          </span>
        )}
      </div>
    </div>
  );
}

/** The funnel's version: edits go straight into the store. */
export function StoreBalanceCard({ id }: { id: ProgramId }) {
  const { state, update } = usePoints();
  return (
    <BalanceCard
      id={id}
      value={state.balances[id] ?? ""}
      estimated={!!state.estimated[id]}
      onValue={(v) => update((s) => ({ balances: { ...s.balances, [id]: v }, estimated: { ...s.estimated, [id]: false } }))}
      onEstimated={(on) => update((s) => ({ estimated: { ...s.estimated, [id]: on } }))}
    />
  );
}
