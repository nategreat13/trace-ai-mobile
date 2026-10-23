"use client";

import { useEffect } from "react";
import { activeBonuses } from "@/engine/engine";
import { PROGRAMS } from "@/engine/data";
import { track } from "@/lib/analytics";
import { groupDestinations } from "@/lib/destinations";
import { money, plural, shortDate } from "@/lib/format";
import { useDeck, usePoints } from "@/lib/store";
import { TripThumb } from "./TripThumb";
import { Check, cx, Icon, ICONS, PrimaryButton, stagger } from "./ui";

export const PRICES = {
  annual: { label: "Yearly · $99", sub: "Just $1.90 a week", week: "$1.90" },
  monthly: { label: "Monthly · $12", sub: "Cancel anytime", week: "$2.77" },
} as const;

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

export function Paywall({ onClose, onStart }: { onClose: () => void; onStart: () => void }) {
  const { state, update } = usePoints();
  const { deck, ok, values } = useDeck();
  const urgency = useUrgency();
  const destinations = groupDestinations(deck);
  const savedTrip = deck.find((r) => state.saved.includes(r.trip.id));
  const best = [...ok].sort((a, b) => b.cashTotal - a.cashTotal)[0];
  const hero = savedTrip ?? best ?? deck[0];
  const saved = state.saved.length;

  useEffect(() => {
    track("paywall_view", { trips: deck.length, saved });
    // Once per open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const head = saved
    ? `Get alerts for your ${plural(saved, "saved trip")}`
    : best
      ? `Fly to ${best.trip.city} on points you already have`
      : `Unlock all ${plural(destinations.length, "destination")}`;

  const pick = (plan: "annual" | "monthly") => {
    track("plan_selected", { plan });
    update({ plan });
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="relative h-[230px] overflow-hidden text-white">
        {hero && <TripThumb city={hero.trip.city} code={hero.trip.code} className="kenburns absolute inset-0" showCode={false} />}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/10 to-white" />
        <button type="button" aria-label="Close" onClick={onClose} className="absolute top-4 right-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-black/30 backdrop-blur-md active:scale-95">
          <Icon d={ICONS.close} size={20} stroke={2.4} />
        </button>
      </div>

      <div className="-mt-16 flex flex-1 flex-col gap-4 px-5 pb-safe">
        <div className="rise flex items-center gap-2 self-center rounded-full bg-white py-1 pr-3 pl-1 text-ink shadow-[0_6px_18px_rgba(15,23,48,0.12)]">
          <span className="flex">
            {["#FF655B", "#FD297B", "#0EA5E9"].map((c, i) => (
              <span key={c} className="h-5 w-5 rounded-full border-2 border-white" style={{ background: c, marginLeft: i ? -7 : 0 }} />
            ))}
          </span>
          <span className="text-[12px] font-bold">Join 30,000+ travelers who get Trace deals</span>
        </div>
        <div className="rise flex flex-col gap-1.5 text-center">
          <h1 className="text-[31px] leading-[1.06] font-extrabold tracking-[-0.02em]">{head}</h1>
          <p className="text-[16px] font-medium text-muted">Try everything free for 7 days.</p>
        </div>

        <div className="rise bg-premium flex items-center justify-between rounded-3xl px-5 py-4 text-white" style={stagger(1)}>
          <div className="flex flex-col">
            <span className="text-[12px] font-semibold text-white/60">Your points</span>
            <span className="text-gradient nums text-[32px] leading-tight font-extrabold">{money(values.flights)}</span>
            <span className="text-[12px] text-white/60">in flights</span>
          </div>
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-[12px] font-extrabold text-white/70">vs</span>
          <div className="flex flex-col text-right">
            <span className="text-[12px] font-semibold text-white/60">Trace</span>
            <span className="nums text-[32px] leading-tight font-extrabold text-gold">{PRICES[state.plan].week}</span>
            <span className="text-[12px] text-white/60">a week</span>
          </div>
        </div>

        <ul className="flex flex-col gap-2.5 px-1">
          {[
            `All ${plural(destinations.length, "destination")} with exact dates`,
            "Instant alerts when seats open",
            "Transfer bonus and new program alerts",
            "Card bonuses picked to close your gap",
            "Step-by-step booking help",
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
          <div className="flex items-center gap-2 rounded-2xl bg-near-bg px-3.5 py-3 text-[13.5px] font-bold text-[#5A3A00]">
            <span className="pulse-soft"><Icon d={ICONS.clock} size={16} /></span>
            {urgency}
          </div>
        )}

        <div className="flex-1" />

        <div className="grid grid-cols-2 gap-2.5 pt-2">
          {(["annual", "monthly"] as const).map((plan) => (
            <button
              key={plan}
              type="button"
              aria-pressed={state.plan === plan}
              onClick={() => pick(plan)}
              className={cx(
                "relative flex min-h-[76px] flex-col items-start justify-center rounded-2xl px-4 text-left transition active:scale-[0.98]",
                state.plan === plan ? "bg-white shadow-[0_0_0_2.5px_#FD297B,0_10px_24px_rgba(253,41,123,0.15)]" : "bg-soft",
              )}
            >
              {plan === "annual" && (
                <span className="bg-trace absolute -top-2.5 right-3 rounded-full px-2 py-0.5 text-[11px] font-extrabold text-white">SAVE 31%</span>
              )}
              <span className="text-[15.5px] font-extrabold">{PRICES[plan].label}</span>
              <span className="text-[12.5px] text-muted">{PRICES[plan].sub}</span>
            </button>
          ))}
        </div>

        <PrimaryButton
          className="text-[18px]"
          onClick={() => {
            track("trial_started", { plan: state.plan, test_mode: true });
            update({ member: { plan: state.plan, startedAt: new Date().toISOString(), testMode: true } });
            onStart();
          }}
        >
          Start my free week
        </PrimaryButton>
        <div className="-mt-2 text-center text-[13px] font-medium text-muted">$0 today · Cancel anytime · Money-back guarantee</div>
        <div className="rounded-xl border border-dashed border-line px-3 py-2 text-center text-[11.5px] text-muted">
          Test mode: no card is collected yet. Payments connect later.
        </div>
      </div>
    </div>
  );
}
