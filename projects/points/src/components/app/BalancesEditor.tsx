"use client";

import { useMemo, useState } from "react";
import { AIRLINE_IDS, BANK_IDS, HOTEL_IDS, PROGRAMS } from "@/engine/data";
import { buildDeck, pointValues } from "@/engine/engine";
import type { ProgramId } from "@/engine/types";
import { track } from "@/lib/analytics";
import { groupDestinations } from "@/lib/destinations";
import { money, num, plural } from "@/lib/format";
import { effectiveBalances, pointsInput, usePoints, type PointsState } from "@/lib/store";
import { milesTotal, tierFor } from "@/lib/tiers";
import { BalanceCard } from "../funnel/BalanceCard";
import { Check, Chip, Confetti, cx, Eyebrow, Icon, ICONS, PrimaryButton } from "../ui";

type Draft = Pick<PointsState, "progs" | "balances" | "estimated">;

/** What a set of balances adds up to, for the before/after on save. */
function summarize(s: PointsState) {
  const input = pointsInput(s);
  const v = pointValues(input.balances);
  const deck = s.airport ? buildDeck(input) : [];
  return { total: v.total, flights: v.flights, bookable: groupDestinations(deck).filter((d) => d.ok).length };
}

const sign = (n: number, f: (x: number) => string) => (n > 0 ? `+${f(n)}` : n < 0 ? `−${f(-n)}` : "no change");

/**
 * Balances in Account are a draft: nothing changes until Save, and saving
 * says exactly what changed, including how many more trips are now in reach.
 */
export function BalancesEditor() {
  const { state, update } = usePoints();
  const [draft, setDraft] = useState<Draft>(() => ({ progs: state.progs, balances: state.balances, estimated: state.estimated }));
  const [saved, setSaved] = useState<null | { before: ReturnType<typeof summarize>; after: ReturnType<typeof summarize> }>(null);

  const dirty = JSON.stringify(draft) !== JSON.stringify({ progs: state.progs, balances: state.balances, estimated: state.estimated });
  const preview = useMemo(() => summarize({ ...state, ...draft }), [state, draft]);
  const tier = tierFor(milesTotal(effectiveBalances({ ...state, ...draft })));

  const setBalance = (id: ProgramId, v: number | "") => {
    setSaved(null);
    setDraft((d) => ({ ...d, balances: { ...d.balances, [id]: v }, estimated: { ...d.estimated, [id]: false } }));
  };
  const setEstimated = (id: ProgramId, on: boolean) => {
    setSaved(null);
    setDraft((d) => ({ ...d, estimated: { ...d.estimated, [id]: on } }));
  };
  const toggleProgram = (id: ProgramId) => {
    setSaved(null);
    setDraft((d) => ({ ...d, progs: d.progs.includes(id) ? d.progs.filter((x) => x !== id) : [...d.progs, id] }));
  };

  const save = () => {
    const before = summarize(state);
    const after = summarize({ ...state, ...draft });
    update(draft);
    setSaved({ before, after });
    track("balances_entered", { total: after.total, where: "account", change: after.total - before.total });
  };

  const up = saved && saved.after.total > saved.before.total;

  return (
    <section className="flex flex-col gap-3">
      <Eyebrow>Programs and balances</Eyebrow>

      <div className="flex items-center justify-between rounded-3xl px-5 py-4 text-white transition-[background] duration-700" style={{ background: preview.total ? tier.gradient : "#0F1730" }}>
        <span className="flex flex-col leading-tight">
          <span className="text-[13px] font-semibold text-white/80">{dirty ? "Total if you save" : "Your total"}</span>
          <span key={tier.level} className="pop text-[13px] font-extrabold">{tier.label}</span>
        </span>
        <span className="flex flex-col items-end leading-tight">
          <span key={Math.round(preview.total / 10000)} className="pop nums text-[26px] font-extrabold">{num(preview.total)}</span>
          <span className="nums text-[12.5px] font-semibold text-white/85">≈ {money(preview.flights)} in flights</span>
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {[...BANK_IDS, ...AIRLINE_IDS, ...HOTEL_IDS].map((id) => (
          <Chip key={id} on={draft.progs.includes(id)} onClick={() => toggleProgram(id)}>
            {PROGRAMS[id].short}
          </Chip>
        ))}
      </div>
      <div className="flex flex-col gap-3 pt-1">
        {draft.progs.map((id) => (
          <BalanceCard
            key={id}
            id={id}
            value={draft.balances[id] ?? ""}
            estimated={!!draft.estimated[id]}
            onValue={(v) => setBalance(id, v)}
            onEstimated={(on) => setEstimated(id, on)}
          />
        ))}
      </div>

      {saved && !dirty && (
        <div
          role="status"
          className={cx(
            "rise flex flex-col gap-3 rounded-3xl p-5",
            up ? "bg-gradient-to-br from-[#DCFCE7] to-[#E0F2FE] dark:from-[#0F2A22] dark:to-[#0E2235]" : "bg-soft",
          )}
        >
          {up && <Confetti count={50} />}
          <div className="flex items-center gap-3">
            <span className="check-in flex h-10 w-10 items-center justify-center rounded-2xl bg-trace-green text-white"><Check size={18} /></span>
            <span className="text-[18px] font-extrabold">{up ? "Saved. Your points just grew." : "Saved"}</span>
          </div>
          <ul className="flex flex-col gap-1.5 text-[14.5px]">
            <li className="flex justify-between gap-3">
              <span className="text-muted">Points</span>
              <span className="nums font-bold">
                {num(saved.after.total)} <span className={cx("text-[13px]", up ? "text-ok" : "text-muted")}>({sign(saved.after.total - saved.before.total, num)})</span>
              </span>
            </li>
            <li className="flex justify-between gap-3">
              <span className="text-muted">Worth in flights</span>
              <span className="nums font-bold">
                {money(saved.after.flights)} <span className={cx("text-[13px]", up ? "text-ok" : "text-muted")}>({sign(saved.after.flights - saved.before.flights, money)})</span>
              </span>
            </li>
            <li className="flex justify-between gap-3">
              <span className="text-muted">Destinations you can book</span>
              <span className="nums font-bold">
                {saved.after.bookable}{" "}
                <span className={cx("text-[13px]", saved.after.bookable > saved.before.bookable ? "text-ok" : "text-muted")}>
                  ({sign(saved.after.bookable - saved.before.bookable, (x) => String(x))})
                </span>
              </span>
            </li>
          </ul>
          {saved.after.bookable > saved.before.bookable && (
            <p className="text-[14px] font-semibold text-ok">
              {plural(saved.after.bookable - saved.before.bookable, "more destination")} unlocked. They&apos;re in Discover now.
            </p>
          )}
        </div>
      )}

      {dirty && (
        <div className="sheet-up pb-safe sticky bottom-0 z-30 -mx-5 flex items-center gap-2 border-t border-line bg-surface/95 px-5 pt-3 backdrop-blur-md">
          <button
            type="button"
            onClick={() => setDraft({ progs: state.progs, balances: state.balances, estimated: state.estimated })}
            className="min-h-[54px] rounded-2xl px-4 text-[15px] font-bold text-muted"
          >
            Cancel
          </button>
          <PrimaryButton onClick={save} className="flex-1">
            <span className="flex items-center justify-center gap-2">
              <Icon d={ICONS.wallet} size={18} /> Save balances
            </span>
          </PrimaryButton>
        </div>
      )}
    </section>
  );
}
