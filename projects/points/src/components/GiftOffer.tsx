"use client";

import { useEffect, useState } from "react";
import { track } from "@/lib/analytics";
import { yearlyOff } from "@/lib/payments";
import { useDeck, usePoints } from "@/lib/store";
import { TripThumb } from "./TripThumb";
import { Confetti, Icon, ICONS, PrimaryButton } from "./ui";

/**
 * The one-time gift for people who close the paywall, built for people who
 * don't read: a wiggling present to tap, then a picture of the app, the
 * discount, and Continue (back to the paywall with the gift price applied:
 * $49.99 a year, 40% off the $84 list price, same 3-day trial). The popup
 * pops up once on its own; after that GiftButton (floating on results) and
 * the paywall's GiftPill bring it back. The payment page never shows it.
 * Reopened from GiftButton it starts already unwrapped.
 */
export function GiftOffer({
  where,
  startOpen = false,
  onClaim,
  onDecline,
}: {
  where: "paywall" | "results_button";
  startOpen?: boolean;
  onClaim: () => void;
  onDecline: () => void;
}) {
  const { update } = usePoints();
  const { deck } = useDeck();
  const [open, setOpen] = useState(startOpen);
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
 * The gift, never lost once it's been offered: a round present floating over
 * results that wiggles now and then. Unclaimed, it reopens the offer (already
 * unwrapped); claimed, it goes straight to the paywall with the price on.
 */
export function GiftButton({ onPaywall }: { onPaywall: () => void }) {
  const { state, ready } = usePoints();
  const [sheet, setSheet] = useState(false);
  if (!ready || !state.giftOffered || state.member) return null;
  return (
    <>
      <button
        type="button"
        aria-label={state.gift ? "Your 40% off gift is applied" : "Open your 40% off gift"}
        onClick={() => {
          track("gift_button_tap", { claimed: state.gift });
          if (state.gift) onPaywall();
          else setSheet(true);
        }}
        className="wiggle bg-trace fixed right-4 bottom-[118px] z-30 flex h-16 w-16 items-center justify-center rounded-[22px] text-white shadow-[0_12px_30px_rgba(253,41,123,0.45)] active:scale-95 min-[480px]:right-[calc(50%-224px)]"
      >
        <Icon d={ICONS.gift} size={30} stroke={2} />
        <span className="absolute -top-2 -left-2 rounded-full bg-trace-green px-1.5 py-0.5 text-[11px] font-black text-white shadow">
          {yearlyOff(true)}%
        </span>
      </button>
      {sheet && (
        <GiftOffer
          where="results_button"
          startOpen
          onClaim={() => {
            setSheet(false);
            onPaywall();
          }}
          onDecline={() => setSheet(false)}
        />
      )}
    </>
  );
}

/**
 * The gift on paywall page 1: "40% off applied" once claimed, or one tap to
 * claim it if they passed on the popup. Nothing before it's been offered.
 */
export function GiftPill() {
  const { state, update, ready } = usePoints();
  if (!ready || !state.giftOffered || state.member) return null;
  if (state.gift) {
    return (
      <span className="pop flex items-center gap-1.5 self-center rounded-full bg-trace-green px-3 py-1 text-[13px] font-extrabold text-white">
        <Icon d={ICONS.gift} size={14} stroke={2.4} /> {yearlyOff(true)}% off applied
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => {
        track("gift_claimed", { where: "paywall_pill" });
        update({ gift: true, plan: "annual" });
      }}
      className="wiggle bg-trace flex items-center gap-1.5 self-center rounded-full px-3.5 py-1.5 text-[13.5px] font-extrabold text-white shadow-[0_8px_20px_rgba(253,41,123,0.35)] active:scale-95"
    >
      <Icon d={ICONS.gift} size={15} stroke={2.4} /> Tap for {yearlyOff(true)}% off
    </button>
  );
}
