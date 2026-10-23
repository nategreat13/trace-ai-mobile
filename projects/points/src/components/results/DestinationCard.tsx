"use client";

import type { TripResult } from "@/engine/types";
import { REGION_COLOR, type Destination } from "@/lib/destinations";
import { kShort, money, num } from "@/lib/format";
import type { CashDeal } from "@/lib/cashDeals";
import { CardOfferLink } from "../CardOffer";
import { CashDealStrip, ValueChip } from "./Insights";
import { TripThumb } from "../TripThumb";
import { CabinBadge, cx, HeartIcon, Icon, ICONS, LockIcon, StatusPill, stagger } from "../ui";

export const cabinLabel = (r: TripResult) =>
  r.trip.cabin === "First/Business" ? "First" : r.trip.cabin === "Lie-flat business" ? "Lie-flat" : r.isBusiness ? "Business" : "Economy";

/** One city, a big photo, and every way to fly there. */
export function DestinationCard({
  d,
  i,
  origin,
  picked,
  locked,
  saved,
  showHeart,
  onOpen,
  onToggleSave,
  cashDeal,
}: {
  d: Destination;
  i: number;
  origin: string;
  picked: boolean;
  locked: boolean;
  saved: boolean;
  showHeart: boolean;
  onOpen: (r: TripResult) => void;
  onToggleSave: (d: Destination) => void;
  cashDeal?: CashDeal;
}) {
  const blur = locked ? "blur-[6px] select-none" : "";
  // Shown even when locked: the gap is already visible, and the card is the way past it.
  const offer = !d.ok ? d.lead.suggestion : null;
  return (
    <article
      className="rise overflow-hidden rounded-[28px] bg-surface shadow-[0_1px_0_rgba(15,23,48,0.04),0_10px_30px_rgba(15,23,48,0.08)]"
      style={stagger(i, 55)}
    >
      <div className="relative h-[176px]">
        <button
          type="button"
          onClick={() => onOpen(d.lead)}
          aria-label={locked ? "Locked trip. Unlock to see it." : `${d.city}, see details`}
          className="absolute inset-0 text-left"
        >
          <TripThumb city={d.city} code={d.code} blur={locked} className="absolute inset-0" showCode={false} />
          <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-black/10" />
          <span className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-black/35 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-md">
            <span className="h-2 w-2 rounded-full" style={{ background: REGION_COLOR[d.region] }} />
            {d.region}
          </span>
          <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-4 text-white">
            <span className="flex min-w-0 flex-col">
              <span className={cx("nums text-[12.5px] font-bold opacity-85", blur)}>{origin} → {d.code}</span>
              <span className={cx("flex items-center gap-2 text-[27px] leading-none font-extrabold tracking-[-0.01em]", blur)}>
                <span className="truncate">{d.city}</span>
              </span>
            </span>
            {picked && !locked && (
              <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-[10.5px] font-extrabold text-trace-pink">YOUR PICK</span>
            )}
          </span>
        </button>
        <span className="pointer-events-none absolute top-3 right-3">
          {locked ? (
            <span className="flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-[12px] font-extrabold text-ink">
              <LockIcon size={12} /> Locked
            </span>
          ) : (
            !showHeart && <StatusPill ok={d.ok} className="bg-surface">{d.ok ? "Can book now" : `${kShort(d.gap)} away`}</StatusPill>
          )}
        </span>
        {showHeart && (
          <button
            type="button"
            onClick={() => onToggleSave(d)}
            aria-label={saved ? `Remove ${d.city} from saved` : `Save ${d.city}`}
            aria-pressed={saved}
            className={cx(
              "absolute top-2.5 right-2.5 flex h-11 w-11 items-center justify-center rounded-full backdrop-blur-md transition active:scale-90",
              saved ? "bg-surface text-trace-pink" : "bg-black/30 text-white",
            )}
          >
            <span key={String(saved)} className={saved ? "pop" : ""}>
              <HeartIcon filled={saved} size={21} />
            </span>
          </button>
        )}
      </div>

      <div className="divide-y divide-line">
        {d.options.map((o) => (
          <button
            key={o.trip.id}
            type="button"
            onClick={() => onOpen(o)}
            className={cx(
              "flex min-h-[64px] w-full items-center gap-3 px-4 py-3 text-left active:bg-soft",
              o.isBusiness && "bg-gradient-to-r from-[#F6F1FF] to-surface dark:from-[#1E1A3A]",
            )}
          >
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="flex items-center gap-2">
                <CabinBadge business={o.isBusiness} label={cabinLabel(o)} />
                <span className="text-[13px] font-semibold whitespace-nowrap text-muted">{o.trip.route}</span>
              </span>
              <span className="flex min-w-0 items-center gap-1.5">
                <ValueChip r={o} />
                {/* Locked: the value stays readable (the reason to unlock), the "how" doesn't. */}
                <span className="truncate text-[12.5px] text-muted">
                  <span className={cx(locked && "font-bold text-ink")}>{money(o.cashTotal)} fare</span>
                  <span className={cx(locked && "blur-[3px] select-none")}> · via {o.best.partner.short}</span>
                </span>
              </span>
            </span>
            <span className="flex shrink-0 flex-col items-end gap-0.5">
              <span className={cx("nums text-[17px] font-extrabold", blur)}>{num(o.need)}</span>
              <span className={cx("flex items-center gap-1 text-[12px] font-bold", o.ok ? "text-ok" : "text-near")}>
                {locked && <LockIcon size={11} />}
                {o.ok ? "Can book" : `${num(o.gap)} short`}
              </span>
            </span>
            <span className="text-muted/50"><Icon d={ICONS.chevron} size={16} stroke={2.4} /></span>
          </button>
        ))}
      </div>

      {offer && <CardOfferLink compact suggestion={offer} gap={d.lead.gap} trip={d.lead.trip.id} where="list" />}
      {/* The fare link names the city, so it stays off locked cards. */}
      {cashDeal && !locked && <CashDealStrip deal={cashDeal} city={d.city} />}
    </article>
  );
}
