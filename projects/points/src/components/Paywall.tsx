"use client";

import { useEffect } from "react";
import { activeBonuses } from "@/engine/engine";
import { PROGRAMS } from "@/engine/data";
import { track } from "@/lib/analytics";
import { money, plural, shortDate } from "@/lib/format";
import { useDeck, usePoints } from "@/lib/store";
import { Check, cx, Icon, ICONS, PrimaryButton } from "./ui";

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
  const best = [...ok].sort((a, b) => b.cashTotal - a.cashTotal)[0];
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
      : `Unlock all ${plural(deck.length, "trip")}`;

  const pick = (plan: "annual" | "monthly") => {
    track("plan_selected", { plan });
    update({ plan });
  };

  return (
    <div className="rise flex min-h-dvh flex-col gap-4 px-5 pt-3 pb-safe">
      <div className="flex justify-end">
        <button type="button" aria-label="Close" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-xl text-muted">
          <Icon d={ICONS.close} size={20} />
        </button>
      </div>
      <div className="-mt-4 flex items-center gap-2 self-center rounded-full border border-line bg-white py-1 pr-3 pl-1 shadow-sm">
        <span className="flex">
          {["#FF655B", "#FD297B", "#00D665"].map((c, i) => (
            <span key={c} className="h-5 w-5 rounded-full border-2 border-white" style={{ background: c, marginLeft: i ? -7 : 0 }} />
          ))}
        </span>
        <span className="text-[12.5px] font-bold">Join 30,000+ travelers who get Trace deals</span>
      </div>

      <div className="flex flex-col gap-1.5 text-center">
        <h1 className="text-[31px] leading-[1.08] font-black">{head}</h1>
        <p className="text-[16px] text-muted">Try everything free for 7 days.</p>
      </div>

      <div className="flex items-center justify-between rounded-2xl bg-soft px-5 py-4">
        <div className="flex flex-col">
          <span className="text-[12px] font-semibold text-muted">Your points</span>
          <span className="bg-gradient-to-r from-trace-red to-trace-pink bg-clip-text text-[30px] leading-tight font-black text-transparent">{money(values.flights)}</span>
          <span className="text-[12px] text-muted">in flights</span>
        </div>
        <span className="text-[13px] font-extrabold text-muted">vs</span>
        <div className="flex flex-col text-right">
          <span className="text-[12px] font-semibold text-muted">Trace</span>
          <span className="text-[30px] leading-tight font-black">{PRICES[state.plan].week}</span>
          <span className="text-[12px] text-muted">a week</span>
        </div>
      </div>

      <ul className="flex flex-col gap-2.5 px-1">
        {[
          `All ${plural(deck.length, "trip")} with exact dates`,
          "Instant alerts when seats open",
          "Transfer bonus and new program alerts",
          "Card bonuses picked to close your gap",
          "Step-by-step booking help",
        ].map((t) => (
          <li key={t} className="flex items-center gap-3 text-[15.5px] font-bold">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-trace-green text-white">
              <Check size={13} />
            </span>
            {t}
          </li>
        ))}
      </ul>

      {urgency && (
        <div className="flex items-center gap-2 rounded-xl bg-near-bg px-3 py-2.5 text-[13.5px] font-bold text-[#5A3A00]">
          <Icon d={ICONS.clock} size={16} />
          {urgency}
        </div>
      )}

      <div className="flex-1" />

      <div className="grid grid-cols-2 gap-2.5">
        {(["annual", "monthly"] as const).map((plan) => (
          <button
            key={plan}
            type="button"
            aria-pressed={state.plan === plan}
            onClick={() => pick(plan)}
            className={cx(
              "relative flex min-h-[70px] flex-col items-start justify-center rounded-[14px] px-3.5 text-left",
              state.plan === plan ? "border-2 border-trace-red bg-trace-red/5" : "border border-line bg-white",
            )}
          >
            {plan === "annual" && (
              <span className="absolute -top-2.5 right-2.5 rounded-full bg-trace-red px-2 py-0.5 text-[11px] font-extrabold text-white">SAVE 31%</span>
            )}
            <span className="text-[15px] font-extrabold">{PRICES[plan].label}</span>
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
      <div className="-mt-2 text-center text-[13px] text-muted">$0 today · Cancel anytime · Money-back guarantee</div>
      <div className="rounded-lg border border-dashed border-line px-3 py-2 text-center text-[11.5px] text-muted">
        Test mode: no card is collected yet. Payments connect later.
      </div>
    </div>
  );
}
