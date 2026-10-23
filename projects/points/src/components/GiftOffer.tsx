"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics";
import { giftDiscount, planPrice, TRIAL_DAYS } from "@/lib/payments";
import { usePoints } from "@/lib/store";
import { Confetti, Icon, ICONS, PrimaryButton } from "./ui";

/**
 * The one-time gift for people who reach the payment page and back out:
 * a year for $59.99 instead of $99, with the same free week. Once they
 * answer it (claim or no thanks), it doesn't show again.
 */
export function GiftOffer({ where, onClaim, onDecline }: { where: "checkout" | "results"; onClaim: () => void; onDecline: () => void }) {
  const { update } = usePoints();
  const gift = planPrice("annual", true);
  useEffect(() => {
    track("gift_shown", { where });
  }, [where]);

  return (
    <div className="fixed inset-0 z-[60] mx-auto flex max-w-[480px] flex-col justify-end" role="dialog" aria-modal="true" aria-label="A gift for you">
      <div className="fade absolute inset-0 bg-midnight/60" />
      <div className="sheet-up pb-safe-lg relative flex flex-col items-center gap-3 overflow-hidden rounded-t-[32px] bg-surface px-6 pt-8 text-center">
        <Confetti count={40} />
        <span className="bg-trace flex h-16 w-16 items-center justify-center rounded-3xl text-white shadow-[0_12px_30px_rgba(253,41,123,0.35)]">
          <Icon d={ICONS.gift} size={30} stroke={2} />
        </span>
        <span className="text-[13px] font-extrabold tracking-[0.08em] text-trace-pink uppercase">Wait, a gift before you go</span>
        <h2 className="text-[28px] leading-[1.08] font-black tracking-[-0.02em]">A full year of Trace for {gift.amount}</h2>
        <div className="flex items-baseline gap-2">
          <span className="nums text-[20px] font-semibold text-muted line-through">$99</span>
          <span className="nums text-[34px] font-black">{gift.amount}</span>
          <span className="rounded-full bg-trace-green px-2 py-0.5 text-[12px] font-extrabold text-white">{giftDiscount()}% OFF</span>
        </div>
        <p className="max-w-[320px] text-[15px] leading-snug text-muted">
          Still free for {TRIAL_DAYS} days, and still cancel anytime. That&apos;s {gift.week} a week for every deal your points can book.
        </p>
        <PrimaryButton
          className="mt-2"
          onClick={() => {
            track("gift_claimed", { where });
            update({ gift: true, plan: "annual", giftOffered: true });
            onClaim();
          }}
        >
          Claim my gift
        </PrimaryButton>
        <button
          type="button"
          onClick={() => {
            track("gift_declined", { where });
            update({ giftOffered: true });
            onDecline();
          }}
          className="min-h-[44px] text-[14.5px] font-bold text-muted"
        >
          No thanks
        </button>
      </div>
    </div>
  );
}
