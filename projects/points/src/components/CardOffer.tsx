"use client";

import { CARD_OFFERS_AS_OF } from "@/engine/data";
import type { CardOffer, CardSuggestion } from "@/engine/types";
import { track } from "@/lib/analytics";
import { kShort, num, shortDate } from "@/lib/format";
import { AFFILIATE } from "@/lib/tripText";
import { cx, Icon, ICONS, ProgramBadge } from "./ui";

const bonusText = (c: CardOffer) => `${c.upTo ? "Up to " : ""}${kShort(c.bonus)}${c.extra ?? ""}`;

function go(card: CardOffer, where: string, trip?: string) {
  track("card_offer_click", { card: card.id, where, trip });
}

/**
 * The card that closes a gap, as a tappable link to the issuer's page.
 * `compact` is the slim strip under a destination card.
 */
export function CardOfferLink({
  suggestion,
  gap,
  trip,
  where,
  compact,
}: {
  suggestion: CardSuggestion;
  gap: number;
  trip?: string;
  where: string;
  compact?: boolean;
}) {
  const c = suggestion.card;
  const lead = suggestion.closesGap ? `Close the ${kShort(gap)} gap` : `Get ${kShort(c.bonus)} closer`;
  if (compact) {
    return (
      <a
        href={c.applyUrl}
        target="_blank"
        rel="sponsored noopener noreferrer"
        onClick={() => go(c, where, trip)}
        className="flex min-h-[52px] items-center gap-3 bg-gradient-to-r from-[#FFF4E5] to-[#FFF0F6] px-4 py-2.5 dark:from-[#2A2014] dark:to-[#2A1630]"
      >
        <ProgramBadge id={c.currency} size={30} />
        <span className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="text-[13px] font-extrabold text-ink">{lead}</span>
          <span className="truncate text-[12px] text-muted">{c.name} · {bonusText(c)} bonus</span>
        </span>
        <span className="flex items-center gap-1 text-[12.5px] font-extrabold text-trace-pink">
          Apply <Icon d={ICONS.external} size={13} stroke={2.4} />
        </span>
      </a>
    );
  }
  return (
    <div className="flex flex-col gap-3 rounded-3xl bg-gradient-to-br from-[#FFF4E5] via-[#FFF0F6] to-[#F3EEFF] p-5 dark:from-[#2A2014] dark:via-[#2A1630] dark:to-[#1E1A3A]">
      <div className="flex items-center gap-3">
        <ProgramBadge id={c.currency} size={44} />
        <div className="flex flex-col leading-tight">
          <span className="text-[12px] font-extrabold tracking-[0.06em] text-near uppercase">{lead}</span>
          <span className="text-[17px] font-extrabold">{c.name}</span>
        </div>
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-gradient nums text-[34px] leading-none font-extrabold">{bonusText(c)}</span>
          <span className="text-[13px] text-muted">bonus after {c.spend}</span>
        </div>
        {c.tag && <span className="rounded-full bg-surface px-2.5 py-1 text-[11.5px] font-extrabold text-near">{c.tag}</span>}
      </div>
      <a
        href={c.applyUrl}
        target="_blank"
        rel="sponsored noopener noreferrer"
        onClick={() => go(c, where, trip)}
        className="bg-trace flex min-h-[52px] items-center justify-center gap-2 rounded-2xl text-[15.5px] font-extrabold text-white"
      >
        See the {c.name} <Icon d={ICONS.external} size={15} stroke={2.4} />
      </a>
      <p className="text-[11.5px] leading-snug text-muted">
        {suggestion.closesGap ? `That covers the ${num(gap)} points you're missing. ` : ""}Fee {c.fee}. Offer as of {shortDate(CARD_OFFERS_AS_OF)}. {AFFILIATE}
      </p>
    </div>
  );
}

/** Horizontal offer card for the My points carousel. */
export function OfferTile({ card, why, className }: { card: CardOffer; why: string; className?: string }) {
  return (
    <a
      href={card.applyUrl}
      target="_blank"
      rel="sponsored noopener noreferrer"
      onClick={() => go(card, "points")}
      className={cx("flex w-[180px] shrink-0 flex-col gap-2 rounded-3xl border border-line bg-surface p-4 active:scale-[0.98]", className)}
    >
      <div className="flex items-center justify-between">
        <ProgramBadge id={card.currency} size={32} />
        {card.tag && <span className="rounded-full bg-near-bg px-2 py-0.5 text-[10.5px] font-extrabold text-near">{card.tag}</span>}
      </div>
      <span className="text-gradient nums text-[28px] leading-none font-extrabold">{bonusText(card)}</span>
      <span className="text-[13.5px] leading-tight font-bold">{card.name}</span>
      <span className="text-[11.5px] text-muted">after {card.spend}</span>
      <span className="mt-auto flex items-center gap-1 pt-1 text-[12px] font-bold text-trace-pink">
        {why} <Icon d={ICONS.chevron} size={13} stroke={2.4} />
      </span>
    </a>
  );
}
