"use client";

import { PROGRAMS } from "@/engine/data";
import type { ProgramId } from "@/engine/types";
import { num } from "@/lib/format";
import { usePoints } from "@/lib/store";
import { cx, ProgramBadge } from "../ui";

/** Number input plus a slider that starts at 0, with a "Not sure" estimate. */
export function BalanceCard({ id }: { id: ProgramId }) {
  const { state, update } = usePoints();
  const p = PROGRAMS[id];
  const est = !!state.estimated[id];
  const raw = state.balances[id];
  const value = est ? p.typical : raw ?? "";
  const numeric = Number(value) || 0;
  const unit = p.kind === "airline" ? "miles" : "points";

  const set = (v: string) => {
    const clean = v.replace(/[^\d]/g, "");
    update((s) => ({
      balances: { ...s.balances, [id]: clean === "" ? "" : Math.min(9_999_999, Number(clean)) },
      estimated: { ...s.estimated, [id]: false },
    }));
  };

  return (
    <div className={cx("flex flex-col gap-3 rounded-3xl bg-surface p-4 shadow-[0_6px_20px_rgba(15,23,48,0.07)] transition-shadow", est ? "ring-2 ring-trace-pink" : "ring-1 ring-line")}>
      <div className="flex items-center gap-3">
        <ProgramBadge id={id} size={40} />
        <label htmlFor={`bal-${id}`} className="flex-1 text-[15px] leading-tight font-bold">
          {p.name}
        </label>
        <button
          type="button"
          aria-pressed={est}
          onClick={() => update((s) => ({ estimated: { ...s.estimated, [id]: !est } }))}
          className={cx(
            "min-h-[34px] shrink-0 rounded-full px-3 text-[12.5px] font-bold",
            est ? "bg-trace text-white" : "bg-soft text-muted",
          )}
        >
          {est ? "Estimated" : "Not sure"}
        </button>
      </div>
      <div className="flex items-center gap-2.5">
        <input
          id={`bal-${id}`}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="0"
          value={value === "" ? "" : num(Number(value))}
          onChange={(e) => set(e.target.value)}
          className="nums min-h-[54px] min-w-0 flex-1 rounded-2xl bg-soft px-4 text-[22px] font-extrabold outline-none focus:bg-surface focus:ring-2 focus:ring-trace-pink"
        />
        <span className="text-[13px] text-muted">{unit}</span>
      </div>
      <input
        type="range"
        aria-label={`${p.name} slider`}
        min={0}
        max={p.sliderMax}
        step={1000}
        value={Math.min(numeric, p.sliderMax)}
        onChange={(e) => set(e.target.value)}
      />
      <div className="text-[12.5px] text-muted">
        {est ? `Using a typical ${num(p.typical)} for now` : `Find it in your ${p.short} app · ${p.earnedOn}`}
      </div>
    </div>
  );
}
