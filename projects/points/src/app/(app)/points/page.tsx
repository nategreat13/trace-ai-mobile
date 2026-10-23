"use client";

import Link from "next/link";
import { CARD_OFFERS, CARD_OFFERS_AS_OF, PROGRAMS } from "@/engine/data";
import type { CardOffer } from "@/engine/types";
import { money, num, shortDate } from "@/lib/format";
import { effectiveBalances, useDeck, usePoints } from "@/lib/store";
import { AFFILIATE } from "@/lib/tripText";
import { ProgramBadge } from "@/components/ui";

export default function PointsPage() {
  const { state } = usePoints();
  const { near, values } = useDeck();
  const bal = effectiveBalances(state);
  const max = Math.max(1, ...state.progs.map((id) => bal[id] ?? 0));

  // Next goal: a picked city they're short on, else the closest trip.
  const goal = near.find((r) => state.picks.includes(r.trip.city)) ?? near[0];
  const pct = goal ? Math.min(100, Math.round(((goal.need - goal.gap) / goal.need) * 100)) : 100;

  // The card that closes the goal's gap first, then cards for currencies they hold, then limited-time ones.
  const offers: { card: CardOffer; why: string }[] = [];
  const seen = new Set<string>();
  const add = (card: CardOffer, why: string) => {
    if (seen.has(card.id) || offers.length >= 5) return;
    seen.add(card.id);
    offers.push({ card, why });
  };
  if (goal?.suggestion) add(goal.suggestion.card, `Best fit for ${goal.trip.city}`);
  for (const c of CARD_OFFERS) if (state.progs.includes(c.currency)) add(c, `Earns more ${PROGRAMS[c.currency].short}`);
  for (const c of CARD_OFFERS) if (c.tag) add(c, `Earns ${PROGRAMS[c.currency].short}`);

  return (
    <div className="flex flex-col gap-4 px-5 pt-5 pb-10">
      <h1 className="text-[28px] font-black">My points</h1>

      <div className="flex flex-col gap-1.5 rounded-3xl bg-gradient-to-br from-trace-red to-trace-pink p-5 text-white shadow-[0_12px_32px_rgba(253,41,123,0.25)]">
        <span className="text-[13px] font-bold opacity-90">Worth in flights</span>
        <span className="text-[50px] leading-none font-black">{money(values.flights)}</span>
        <div className="flex flex-wrap gap-2 pt-2">
          {[`${num(values.total)} pts`, `${state.progs.length} programs`, `${money(values.bankCash)} as cash`].map((t) => (
            <span key={t} className="rounded-full bg-white/20 px-2.5 py-1 text-[12px] font-bold">{t}</span>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3.5 rounded-2xl border border-line p-4">
        {state.progs.map((id) => {
          const v = bal[id] ?? 0;
          return (
            <div key={id} className="flex items-center gap-3">
              <ProgramBadge id={id} size={38} />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex justify-between gap-2 text-[14px]">
                  <span className="font-bold">{PROGRAMS[id].short}{state.estimated[id] ? " (est.)" : ""}</span>
                  <span className="font-mono font-bold">{num(v)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-soft">
                  <div className="h-full rounded-full" style={{ width: `${Math.max(4, (v / max) * 100)}%`, background: PROGRAMS[id].badgeColor }} />
                </div>
              </div>
            </div>
          );
        })}
        <Link href="/account" className="self-start text-[13.5px] font-bold text-trace-red">Update balances</Link>
      </div>

      <div className="flex items-center gap-4 rounded-2xl border border-line p-4">
        <div
          className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full"
          style={{ background: `conic-gradient(#FF655B ${pct * 3.6}deg, #F0F0F0 0)` }}
          role="img"
          aria-label={`${pct}% of the way`}
        >
          <span className="flex h-[62px] w-[62px] items-center justify-center rounded-full bg-white font-mono text-[15px] font-bold">{pct}%</span>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[11px] font-extrabold tracking-[0.06em] text-muted">NEXT GOAL</span>
          <span className="text-[22px] leading-tight font-black">{goal ? goal.trip.city : "Everything"}</span>
          <span className="text-[13.5px] font-bold text-trace-red">{goal ? `${num(goal.gap)} points to go` : "You can book every trip in your list"}</span>
        </div>
      </div>

      <div className="flex items-baseline justify-between pt-1">
        <h2 className="text-[17px] font-extrabold">Get there faster</h2>
        <span className="text-[11.5px] text-muted">Offers as of {shortDate(CARD_OFFERS_AS_OF)}</span>
      </div>
      <div className="no-scrollbar -mx-5 -mt-2 flex gap-2.5 overflow-x-auto px-5 py-1">
        {offers.map(({ card, why }) => (
          <div key={card.id} className="flex w-[170px] shrink-0 flex-col gap-1.5 rounded-2xl border border-line p-3.5">
            {card.tag && <span className="self-start rounded-full bg-near-bg px-2 py-0.5 text-[10.5px] font-extrabold text-near">{card.tag}</span>}
            <span className="bg-gradient-to-r from-trace-red to-trace-pink bg-clip-text text-[28px] leading-none font-black text-transparent">
              {card.upTo ? "Up to " : ""}{Math.round(card.bonus / 1000)}k
            </span>
            <span className="text-[13.5px] leading-tight font-bold">{card.name}</span>
            <span className="text-[11.5px] text-muted">after {card.spend}</span>
            <span className="text-[11.5px] text-muted">{why}</span>
          </div>
        ))}
      </div>
      <p className="text-[11.5px] text-muted">{AFFILIATE} Point values are estimates.</p>
    </div>
  );
}
