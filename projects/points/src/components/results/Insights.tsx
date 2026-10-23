"use client";

import { PROGRAMS } from "@/engine/data";
import { activeBonuses } from "@/engine/engine";
import type { TripResult } from "@/engine/types";
import { track } from "@/lib/analytics";
import type { CashDeal } from "@/lib/cashDeals";
import { money, num, shortDate } from "@/lib/format";
import { useDeck, usePoints } from "@/lib/store";
import { centsPerPoint, cppLabel, cppTone } from "@/lib/value";
import { Icon, ICONS, ProgramBadge } from "../ui";

/** "9.0¢/pt": what each point is worth on this trip, colored by how good that is. */
export function ValueChip({ r }: { r: TripResult }) {
  const c = centsPerPoint(r);
  const tone = cppTone(c);
  return (
    <span
      className="nums shrink-0 rounded-full px-2 py-0.5 text-[11px] font-extrabold whitespace-nowrap"
      style={{ background: tone.bg, color: tone.text }}
      title="Value per point compared with the cash fare"
    >
      {cppLabel(c)}/pt
    </span>
  );
}

/**
 * The same bank points, cashed out vs flown. Only shown when they hold bank
 * points, since airline miles can't be cashed out.
 */
export function CashOutCompare() {
  const { values } = useDeck();
  if (values.bankCash <= 0) return null;
  const left = Math.max(0, values.bankFlights - values.bankCash);
  const pct = Math.max(6, Math.round((values.bankCash / values.bankFlights) * 100));
  return (
    <div className="mt-3 flex flex-col gap-1.5 rounded-3xl bg-surface/80 px-4 py-3 ring-1 ring-line backdrop-blur">
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1.5 text-[12.5px] font-semibold">
        <span className="text-muted">Cashed out</span>
        <span className="h-2 overflow-hidden rounded-full bg-soft">
          <span className="block h-full rounded-full bg-muted/50" style={{ width: `${pct}%` }} />
        </span>
        <span className="nums text-right font-extrabold text-muted">{money(values.bankCash)}</span>
        <span>As flights</span>
        <span className="h-2 overflow-hidden rounded-full bg-soft">
          <span className="bg-trace block h-full w-full rounded-full" />
        </span>
        <span className="text-gradient nums text-right font-extrabold">{money(values.bankFlights)}</span>
      </div>
      <p className="text-[13.5px] font-extrabold text-near">Cashing out your card points leaves {money(left)} on the table.</p>
    </div>
  );
}

/**
 * A live transfer bonus on a program they hold, made personal: how many
 * points it saves on one of their trips. Only when a bonus is running.
 */
export function BonusBanner({ onOpen }: { onOpen: (r: TripResult) => void }) {
  const { state } = usePoints();
  const { deck, input } = useDeck();
  const held = new Set(state.progs);
  const bonus = activeBonuses(input.asOf).find((b) => held.has(b.from));
  if (!bonus) return null;
  // A trip that actually uses this bonus, and how many points it saves there.
  const hit = deck
    .map((r) => ({ r, part: r.best.parts.find((p) => p.bonus && p.bonus.from === bonus.from && p.bonus.to === bonus.to) }))
    .filter((x): x is { r: TripResult; part: NonNullable<typeof x.part> } => !!x.part)
    .sort((a, b) => b.part.miles - b.part.spend - (a.part.miles - a.part.spend))[0];
  const src = PROGRAMS[bonus.from].short;
  return (
    <button
      type="button"
      onClick={() => {
        if (!hit) return;
        track("bonus_banner_tap", { trip: hit.r.trip.id, bonus: `${bonus.from}-${bonus.to}` });
        onOpen(hit.r);
      }}
      className="rise relative flex items-center gap-3 overflow-hidden rounded-[24px] bg-gradient-to-r from-sea to-sky p-4 text-left text-white shadow-[0_10px_26px_rgba(14,165,233,0.3)] active:scale-[0.99]"
    >
      <span aria-hidden="true" className="absolute -right-6 -bottom-10 h-28 w-28 rounded-full bg-white/15" />
      <ProgramBadge id={bonus.from} size={42} />
      <span className="relative flex min-w-0 flex-1 flex-col leading-tight">
        <span className="text-[11.5px] font-extrabold tracking-[0.06em] text-white/85 uppercase">Live bonus · ends {shortDate(bonus.endsOn)}</span>
        <span className="text-[15.5px] font-extrabold">
          Your {src} is worth {bonus.pct}% more at {bonus.toName}
        </span>
        {hit && (
          <span className="text-[13px] font-semibold text-white/90">
            That makes {hit.r.trip.city} {num(hit.part.miles - hit.part.spend)} points cheaper for you.
          </span>
        )}
      </span>
      {hit && <Icon d={ICONS.chevron} size={18} stroke={2.6} className="relative shrink-0" />}
    </button>
  );
}

/** For trips they're short on: what Trace's cash-deals feed found for the same city. */
export function CashDealStrip({ deal, city }: { deal: CashDeal; city: string }) {
  return (
    <a
      href={deal.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => track("cash_deal_click", { city, price: deal.price })}
      className="flex min-h-[52px] items-center gap-3 border-t border-line px-4 py-2.5"
    >
      <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg bg-trace text-white">
        <Icon d={ICONS.plane} size={15} stroke={1.8} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="text-[13px] font-extrabold">
          Or pay cash: <span className="nums">{money(deal.price)}</span> round trip
          {deal.normal > deal.price && <span className="nums ml-1 text-[12px] font-semibold text-muted line-through">{money(deal.normal)}</span>}
        </span>
        <span className="truncate text-[12px] text-muted">
          Economy · Trace deal from {deal.origin}{deal.month ? ` · ${deal.month}` : ""}{deal.airlines ? ` · ${deal.airlines}` : ""}
        </span>
      </span>
      <Icon d={ICONS.external} size={14} stroke={2.4} className="shrink-0 text-trace-pink" />
    </a>
  );
}
