"use client";

import { track } from "@/lib/analytics";
import { listWeekly, planPrice, TRIAL_DAYS, yearlyOff } from "@/lib/payments";
import { usePoints } from "@/lib/store";
import { GiftReminder } from "./GiftOffer";
import { cx } from "./ui";

/**
 * Yearly vs monthly. Yearly reads per week against the struck-out $1.62/wk
 * list price ($0.96 with the exit gift) and is the only plan with the free
 * trial; monthly is $7.99, charged today. A gift turned down earlier is
 * offered again underneath.
 */
export function PlanPicker() {
  const { state, update } = usePoints();
  const pick = (plan: "annual" | "monthly") => {
    track("plan_selected", { plan, offer: plan === "annual" && state.gift ? "gift" : undefined });
    update({ plan });
  };
  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-2 gap-2.5">
        {(["annual", "monthly"] as const).map((plan) => {
          const p = planPrice(plan, state.gift);
          const on = state.plan === plan;
          const yearly = plan === "annual";
          const gift = yearly && state.gift;
          return (
            <button
              key={plan}
              type="button"
              aria-pressed={on}
              onClick={() => pick(plan)}
              className={cx(
                "relative flex min-h-[92px] flex-col items-start justify-center gap-0.5 rounded-2xl px-4 text-left transition active:scale-[0.98]",
                on ? "bg-surface shadow-[0_0_0_2.5px_#FD297B,0_10px_24px_rgba(253,41,123,0.15)]" : "bg-soft",
              )}
            >
              {yearly && (
                <span className={cx("absolute -top-2.5 right-3 rounded-full px-2 py-0.5 text-[11px] font-extrabold text-white", gift ? "bg-trace-green" : "bg-trace")}>
                  {gift ? "GIFT · " : "SAVE "}
                  {yearlyOff(gift)}%{gift ? " OFF" : ""}
                </span>
              )}
              <span className="text-[13px] font-bold text-muted">{yearly ? "Yearly" : "Monthly"}</span>
              <span className="nums flex items-baseline gap-1.5 whitespace-nowrap">
                {yearly && <span className="text-[13px] font-semibold text-muted line-through">{listWeekly()}</span>}
                <span className="text-[20px] leading-none font-extrabold">{p.each}</span>
                <span className="text-[13px] font-bold text-muted">/{p.per === "week" ? "wk" : "mo"}</span>
              </span>
              <span className="text-[11.5px] text-muted">{yearly ? `${p.amount}/yr · ${TRIAL_DAYS} days free` : "No free trial"}</span>
            </button>
          );
        })}
      </div>
      <GiftReminder variant="inline" />
    </div>
  );
}
