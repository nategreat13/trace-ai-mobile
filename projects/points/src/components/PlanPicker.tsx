"use client";

import { track } from "@/lib/analytics";
import { annualSavings, giftDiscount, giftMonthly, planPrice } from "@/lib/payments";
import { usePoints } from "@/lib/store";
import { GiftReminder } from "./GiftOffer";
import { cx } from "./ui";

/**
 * Yearly vs monthly. With the exit gift claimed, yearly shows $5/mo over the
 * struck-out $8.25/mo, billed yearly at $59.99; turned down earlier, it's
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
          const gift = plan === "annual" && state.gift;
          return (
            <button
              key={plan}
              type="button"
              aria-pressed={on}
              onClick={() => pick(plan)}
              className={cx(
                "relative flex min-h-[76px] flex-col items-start justify-center rounded-2xl px-4 text-left transition active:scale-[0.98]",
                on ? "bg-surface shadow-[0_0_0_2.5px_#FD297B,0_10px_24px_rgba(253,41,123,0.15)]" : "bg-soft",
              )}
            >
              {plan === "annual" && (
                <span className={cx("absolute -top-2.5 right-3 rounded-full px-2 py-0.5 text-[11px] font-extrabold text-white", gift ? "bg-trace-green" : "bg-trace")}>
                  {gift ? `GIFT · ${giftDiscount()}% OFF` : `SAVE ${annualSavings()}%`}
                </span>
              )}
              <span className="nums text-[15.5px] font-extrabold whitespace-nowrap">{p.label}</span>
              <span className="text-[12.5px] text-muted">
                {gift && <span className="mr-1 line-through">{giftMonthly().regular}/mo</span>}
                {p.sub}
              </span>
            </button>
          );
        })}
      </div>
      <GiftReminder variant="inline" />
    </div>
  );
}
