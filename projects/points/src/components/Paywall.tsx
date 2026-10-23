"use client";

import { useEffect } from "react";
import { activeBonuses } from "@/engine/engine";
import { PROGRAMS } from "@/engine/data";
import { track } from "@/lib/analytics";
import { groupDestinations } from "@/lib/destinations";
import { money, plural, shortDate } from "@/lib/format";
import { planPrice } from "@/lib/payments";
import { useDeck, usePoints } from "@/lib/store";
import { PlanPicker } from "./PlanPicker";
import type { PayReason } from "./results/ResultsView";
import { TripThumb } from "./TripThumb";
import { Check, cx, Icon, ICONS, PrimaryButton, stagger } from "./ui";

/**
 * One urgency line, only when it's real for this user: a live transfer bonus
 * out of a currency they hold, or the Seattle Flying Blue promo.
 */
function useUrgency(): string | null {
  const { state } = usePoints();
  const { input } = useDeck();
  const held = new Set(state.progs);
  const bonus = activeBonuses(input.asOf).find((b) => held.has(b.from));
  if (bonus) return `${PROGRAMS[bonus.from].short} → ${bonus.toName} +${bonus.pct}% ends ${shortDate(bonus.endsOn)}.`;
  if (state.airport === "SEA" && input.asOf <= "2026-10-31") return "Seattle → Paris business from 45,000 Flying Blue miles ends Oct 31.";
  return null;
}

export function Paywall({ reason = "cta", onClose, onStart }: { reason?: PayReason; onClose: () => void; onStart: () => void }) {
  const { state, update } = usePoints();
  const { deck, ok, values } = useDeck();
  const urgency = useUrgency();
  const destinations = groupDestinations(deck);
  const best = [...ok].sort((a, b) => b.cashTotal - a.cashTotal)[0];
  const okDest = destinations.filter((d) => d.ok).length;
  const mosaic = destinations.slice(0, 4);
  const saved = state.saved.length;

  useEffect(() => {
    track("paywall_view", { trips: deck.length, saved });
    // Once per open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The headline follows why they're here: a locked deal, filters, search, or the main button.
  const head =
    reason === "filters"
      ? "Filter every deal your way"
      : reason === "search"
        ? "Search every deal"
      : saved && reason === "cta"
        ? `Get alerts for your ${plural(saved, "saved trip")}`
      : reason === "locked"
        ? `Unlock all ${plural(destinations.length, "destination")}`
        : "Book your first free flight";
  const sub =
    reason === "filters"
      ? "Beaches, business class, fewest points, closest to booking."
      : reason === "search"
        ? `Find any city in your ${plural(destinations.length, "destination")} in a second, and request places we don't price yet.`
      : okDest
        ? `${okDest} trips are within reach${best ? `, like ${best.trip.city}` : ""}. We find the dates with open seats and help you book.`
        : "See exactly how close you are to each one, and how to close the gap.";


  return (
    <div className="flex min-h-dvh flex-col">
      <div className="relative h-[230px] overflow-hidden text-white">
        <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-0.5">
          {mosaic.map((d, i) => (
            <div key={d.city} className="relative overflow-hidden">
              <TripThumb city={d.city} code={d.code} blur={i > 0} className="kenburns absolute inset-0" showCode={false} />
            </div>
          ))}
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/10 to-surface" />
        <button type="button" aria-label="Close" onClick={onClose} className="absolute top-4 right-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-black/30 backdrop-blur-md active:scale-95">
          <Icon d={ICONS.close} size={20} stroke={2.4} />
        </button>
      </div>

      <div className="-mt-16 flex flex-1 flex-col gap-4 px-5 pb-safe">
        <div className="rise flex items-center gap-2 self-center rounded-full bg-surface py-1 pr-3 pl-1 text-ink shadow-[0_6px_18px_rgba(15,23,48,0.12)]">
          <span className="flex">
            {["#FF655B", "#FD297B", "#0EA5E9"].map((c, i) => (
              <span key={c} className="h-5 w-5 rounded-full border-2 border-white" style={{ background: c, marginLeft: i ? -7 : 0 }} />
            ))}
          </span>
          <span className="text-[12px] font-bold">Join 30,000+ travelers who get Trace deals</span>
        </div>
        <div className="rise flex flex-col gap-1.5 text-center">
          <h1 className="text-[31px] leading-[1.06] font-extrabold tracking-[-0.02em]">{head}</h1>
          <p className="text-[16px] font-medium text-muted">{sub}</p>
          <p className="text-[15px] font-extrabold text-trace-pink">Try everything free for 7 days.</p>
        </div>

        <div className="rise bg-premium flex items-center justify-between rounded-3xl px-5 py-4 text-white" style={stagger(1)}>
          <div className="flex flex-col">
            <span className="text-[12px] font-semibold text-white/60">{state.starter ? "One card bonus" : "Your points"}</span>
            <span className="text-gradient nums text-[32px] leading-tight font-extrabold">{money(values.flights)}</span>
            <span className="text-[12px] text-white/60">in flights</span>
          </div>
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-[12px] font-extrabold text-white/70">vs</span>
          <div className="flex flex-col text-right">
            <span className="text-[12px] font-semibold text-white/60">Trace</span>
            <span className="nums text-[32px] leading-tight font-extrabold text-gold">{planPrice(state.plan, state.gift).month}</span>
            <span className="text-[12px] text-white/60">a month</span>
          </div>
        </div>

        <ul className="flex flex-col gap-2.5 px-1">
          {[
            `Exact dates with open seats for all ${plural(destinations.length, "destination")}`,
            "Our team checks seats and helps you book, within 24 hours",
            "Instant alerts the moment seats open",
            "Transfer bonus alerts, so your points go further",
            "Card bonuses picked to close your gap",
          ].map((t, i) => (
            <li key={t} className="rise flex items-center gap-3 text-[15.5px] font-bold" style={stagger(i + 2, 60)}>
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-trace-green text-white">
                <Check size={13} />
              </span>
              {t}
            </li>
          ))}
        </ul>

        {urgency && (
          <div className="flex items-center gap-2 rounded-2xl bg-near-bg px-3.5 py-3 text-[13.5px] font-bold text-[#5A3A00] dark:text-near">
            <span className="pulse-soft"><Icon d={ICONS.clock} size={16} /></span>
            {urgency}
          </div>
        )}

        <div className="flex-1" />

        <div className="pt-2">
          <PlanPicker />
        </div>

        <PrimaryButton className="text-[18px]" onClick={onStart}>
          Start my free week
        </PrimaryButton>
        <div className="-mt-2 text-center text-[13px] font-medium text-muted">$0 today · Cancel anytime · Money-back guarantee</div>
      </div>
    </div>
  );
}
