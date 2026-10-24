"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { track } from "@/lib/analytics";
import { listWeekly, planPrice, TRIAL_DAYS, yearlyOff } from "@/lib/payments";
import { useDeck, usePoints } from "@/lib/store";
import { TripThumb } from "./TripThumb";
import { Confetti, cx, Icon, ICONS, PrimaryButton } from "./ui";

/**
 * The one-time gift for people who close the paywall, built for people who
 * don't read: a wiggling present to tap, then a picture of the app, the
 * discount, and Continue (back to the paywall with the gift price applied:
 * $49.99 a year, 40% off the $84 list price, same 3-day trial). The popup
 * shows once; after "No thanks" the offer stays reachable through
 * GiftReminder. The payment page never shows it.
 */
export function GiftOffer({ where, onClaim, onDecline }: { where: "paywall"; onClaim: () => void; onDecline: () => void }) {
  const { update } = usePoints();
  const { deck } = useDeck();
  const [open, setOpen] = useState(false);
  const top = deck.find((r) => r.ok) ?? deck[0];
  useEffect(() => {
    track("gift_shown", { where });
  }, [where]);
  const decline = () => {
    track("gift_declined", { where });
    update({ giftOffered: true });
    onDecline();
  };

  return (
    <div className="fixed inset-0 z-[60] mx-auto flex max-w-[480px] flex-col justify-end" role="dialog" aria-modal="true" aria-label="A gift for you">
      <div className="fade absolute inset-0 bg-midnight/70" />
      <div className="sheet-up pb-safe-lg relative flex min-h-[460px] flex-col items-center justify-center gap-4 overflow-hidden rounded-t-[32px] bg-surface px-6 pt-8 text-center">
        {!open ? (
          <>
            <button
              type="button"
              aria-label="Open your gift"
              onClick={() => {
                track("gift_opened", { where });
                setOpen(true);
              }}
              className="wiggle bg-trace flex h-36 w-36 items-center justify-center rounded-[40px] text-white shadow-[0_20px_50px_rgba(253,41,123,0.45)] active:scale-95"
            >
              <Icon d={ICONS.gift} size={72} stroke={1.6} />
            </button>
            <span className="text-[22px] font-black">Tap to open 🎁</span>
            <button type="button" onClick={decline} className="min-h-[44px] text-[14px] font-bold text-muted">
              No thanks
            </button>
          </>
        ) : (
          <>
            <Confetti count={60} />
            {/* The app, not a description of it: a phone showing their best trip. */}
            <div className="pop relative h-[200px] w-[118px] overflow-hidden rounded-[26px] bg-midnight shadow-[0_18px_40px_rgba(15,23,48,0.3)] ring-[5px] ring-black">
              {top && <TripThumb city={top.trip.city} code={top.trip.code} className="absolute inset-0" showCode={false} />}
              <span className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
              <span className="absolute inset-x-2 bottom-2 rounded-xl bg-white/95 px-2 py-1.5 text-left text-[#0F1730]">
                <span className="block truncate text-[11px] font-extrabold">{top?.trip.city ?? "Your trip"}</span>
                <span className="block text-[9px] font-bold text-[#0E9F6E]">Ready to book</span>
              </span>
            </div>
            <h2 className="rise text-[32px] leading-[1.05] font-black tracking-[-0.02em]">
              Try Trace for
              <br />
              <span className="text-gradient">{yearlyOff(true)}% OFF</span>
            </h2>
            <p className="text-[14px] font-bold text-muted">No commitment · Cancel anytime</p>
            <PrimaryButton
              onClick={() => {
                track("gift_claimed", { where });
                update({ gift: true, plan: "annual", giftOffered: true });
                onClaim();
              }}
            >
              Continue
            </PrimaryButton>
            <button type="button" onClick={decline} className="-mt-1 min-h-[40px] text-[13.5px] font-bold text-muted">
              No thanks
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * The gift after its popup was turned down, so it's never lost. "banner" sits
 * on the free results and goes to checkout with the gift applied; "inline"
 * sits under the plan picker and applies it in place.
 */
export function GiftReminder({ variant }: { variant: "banner" | "inline" }) {
  const { state, update, ready } = usePoints();
  const router = useRouter();
  if (!ready || state.member) return null;
  // Already claimed (from the popup or the ad link): the banner says so and goes straight to checkout.
  if (state.gift && variant === "banner") return <GiftApplied onClick={() => router.push("/checkout")} />;
  if (!state.giftOffered || state.gift) return null;
  const gift = planPrice("annual", true);
  const claim = () => {
    track("gift_claimed", { where: variant === "banner" ? "results_banner" : "plan_picker" });
    update({ gift: true, plan: "annual" });
    if (variant === "banner") router.push("/checkout");
  };
  return (
    <button
      type="button"
      onClick={claim}
      className={cx(
        "flex w-full items-center gap-3 rounded-2xl text-left active:scale-[0.98]",
        variant === "banner" ? "bg-trace px-4 py-3 text-white shadow-[0_10px_24px_rgba(253,41,123,0.25)]" : "border-2 border-dashed border-trace-pink/50 bg-trace-pink/5 px-3.5 py-2.5",
      )}
    >
      <span className={cx("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", variant === "banner" ? "bg-white/20" : "bg-trace text-white")}>
        <Icon d={ICONS.gift} size={18} stroke={2} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="text-[14.5px] font-extrabold">Your gift is still here</span>
        <span className={cx("text-[12.5px]", variant === "banner" ? "text-white/85" : "text-muted")}>
          Just {gift.each}/wk <span className="line-through">{listWeekly()}</span> · {TRIAL_DAYS} days free
        </span>
        <span className={cx("text-[11px]", variant === "banner" ? "text-white/70" : "text-muted/80")}>{gift.amount} billed yearly</span>
      </span>
      <span className={cx("shrink-0 rounded-full px-3 py-1.5 text-[13px] font-extrabold", variant === "banner" ? "bg-white text-trace-pink" : "bg-trace text-white")}>
        {variant === "banner" ? "Claim" : "Use it"}
      </span>
    </button>
  );
}

/** The gift is on: a reminder of the price with one tap to checkout. */
export function GiftApplied({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl bg-trace px-4 py-3 text-left text-white shadow-[0_10px_24px_rgba(253,41,123,0.25)] active:scale-[0.98]"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/20">
        <Icon d={ICONS.gift} size={18} stroke={2} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="text-[14.5px] font-extrabold">Your gift is applied</span>
        <span className="text-[12.5px] text-white/85">
          Trace for {planPrice("annual", true).each}/wk <span className="line-through">{listWeekly()}</span> · {TRIAL_DAYS} days free
        </span>
        <span className="text-[11px] text-white/70">{planPrice("annual", true).amount} billed yearly</span>
      </span>
      {onClick && <span className="shrink-0 rounded-full bg-white px-3 py-1.5 text-[13px] font-extrabold text-trace-pink">Start</span>}
    </button>
  );
}
