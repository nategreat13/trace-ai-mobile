"use client";

import Link from "next/link";
import { CARD_OFFERS, CARD_OFFERS_AS_OF, PROGRAMS } from "@/engine/data";
import type { CardOffer } from "@/engine/types";
import { OfferTile } from "@/components/CardOffer";
import { TripThumb } from "@/components/TripThumb";
import { Eyebrow, ProgramBadge, stagger } from "@/components/ui";
import { money, num, shortDate } from "@/lib/format";
import { effectiveBalances, useDeck, usePoints } from "@/lib/store";
import { AFFILIATE } from "@/lib/tripText";

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
    if (seen.has(card.id) || offers.length >= 6) return;
    seen.add(card.id);
    offers.push({ card, why });
  };
  if (goal?.suggestion) add(goal.suggestion.card, `Gets you to ${goal.trip.city}`);
  for (const c of CARD_OFFERS) if (state.progs.includes(c.currency)) add(c, `More ${PROGRAMS[c.currency].short}`);
  for (const c of CARD_OFFERS) if (c.tag) add(c, `Earns ${PROGRAMS[c.currency].short}`);

  return (
    <div className="flex flex-col gap-5 px-4 pt-5 pb-12">
      <h1 className="px-1 text-[30px] leading-tight font-extrabold tracking-[-0.02em]">My points</h1>

      <div className="rise bg-trace relative overflow-hidden rounded-[30px] p-6 text-white shadow-[0_16px_40px_rgba(253,41,123,0.3)]">
        <div aria-hidden="true" className="absolute -right-10 -bottom-16 h-52 w-52 rounded-full bg-white/15" />
        <div aria-hidden="true" className="absolute -top-12 right-16 h-28 w-28 rounded-full bg-violet/40 blur-2xl" />
        <span className="relative text-[13px] font-bold text-white/85">Worth in flights</span>
        <div className="nums relative text-[56px] leading-none font-extrabold tracking-[-0.03em]">{money(values.flights)}</div>
        <div className="relative flex flex-wrap gap-2 pt-4">
          {[`${num(values.total)} pts`, `${state.progs.length} programs`, `${money(values.bankCash)} if cashed out`].map((t) => (
            <span key={t} className="nums rounded-full bg-white/20 px-3 py-1 text-[12.5px] font-bold backdrop-blur">{t}</span>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-[28px] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,48,0.07)]">
        {state.progs.map((id, i) => {
          const v = bal[id] ?? 0;
          return (
            <div key={id} className="rise flex items-center gap-3.5" style={stagger(i)}>
              <ProgramBadge id={id} size={42} />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex justify-between gap-2 text-[14.5px]">
                  <span className="font-bold">{PROGRAMS[id].short}{state.estimated[id] ? " (est.)" : ""}</span>
                  <span className="nums font-extrabold">{num(v)}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-soft">
                  <div
                    className="h-full rounded-full transition-[width] duration-700"
                    style={{ width: `${Math.max(4, (v / max) * 100)}%`, background: `linear-gradient(90deg, ${PROGRAMS[id].badgeColor}, #FD297B)` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
        <Link href="/account" className="self-start text-[14px] font-bold text-trace-pink">Update balances</Link>
      </div>

      {goal ? (
        <Link href={`/trip/${goal.trip.id}`} className="relative flex items-center gap-4 overflow-hidden rounded-[28px] p-5 text-white active:scale-[0.99]">
          <TripThumb city={goal.trip.city} code={goal.trip.code} className="absolute inset-0" showCode={false} />
          <span className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/55 to-black/20" />
          <div
            className="relative flex h-[88px] w-[88px] shrink-0 items-center justify-center rounded-full"
            style={{ background: `conic-gradient(#00D665 ${pct * 3.6}deg, rgba(255,255,255,0.2) 0)` }}
            role="img"
            aria-label={`${pct}% of the way`}
          >
            <span className="nums flex h-[70px] w-[70px] items-center justify-center rounded-full bg-midnight/80 text-[17px] font-extrabold backdrop-blur">{pct}%</span>
          </div>
          <div className="relative flex min-w-0 flex-col gap-0.5">
            <span className="text-[11px] font-extrabold tracking-[0.08em] text-white/70">NEXT GOAL</span>
            <span className="text-[26px] leading-tight font-extrabold">{goal.trip.city}</span>
            <span className="nums text-[14px] font-bold text-gold">{num(goal.gap)} points to go</span>
          </div>
        </Link>
      ) : (
        <div className="rounded-[28px] bg-ok-bg p-5 text-[15px] font-bold text-ok">You can book every trip in your list.</div>
      )}

      <div className="flex items-baseline justify-between px-1 pt-1">
        <h2 className="text-[19px] font-extrabold">Get there faster</h2>
        <Eyebrow className="normal-case tracking-normal">Offers as of {shortDate(CARD_OFFERS_AS_OF)}</Eyebrow>
      </div>
      <div className="no-scrollbar -mx-4 -mt-2 flex gap-3 overflow-x-auto px-4 py-1">
        {offers.map(({ card, why }) => (
          <OfferTile key={card.id} card={card} why={why} />
        ))}
      </div>
      <p className="px-1 text-[11.5px] text-muted">{AFFILIATE} Point values are estimates.</p>
    </div>
  );
}
