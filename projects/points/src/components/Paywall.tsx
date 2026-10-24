"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics";
import { groupDestinations } from "@/lib/destinations";
import { money } from "@/lib/format";
import { shownReviews } from "@/lib/reviews";
import { useDeck, usePoints } from "@/lib/store";
import type { PayReason } from "./results/ResultsView";
import { TripThumb } from "./TripThumb";
import { Icon, ICONS, PrimaryButton, stagger } from "./ui";

/**
 * Page 1 of the paywall: what they get, at a glance, with Continue. No
 * prices here (the plan is picked on the pay page) and no scrolling.
 */
export function Paywall({ reason = "cta", onClose, onStart }: { reason?: PayReason; onClose: () => void; onStart: () => void }) {
  const { state } = usePoints();
  const { deck, values } = useDeck();
  const destinations = groupDestinations(deck);
  const mosaic = destinations.slice(0, 4);
  const saved = state.saved.length;

  useEffect(() => {
    track("paywall_view", { trips: deck.length, saved });
    // Once per open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Short enough to read at a glance; the headline follows why they're here.
  const head =
    reason === "filters"
      ? "Filter every deal"
      : reason === "search"
        ? "Search every deal"
        : values.flights
          ? `Unlock your ${money(values.flights)} in flights`
          : "Unlock your free flights";

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="relative h-[min(300px,36dvh)] shrink-0 overflow-hidden text-white">
        <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-0.5">
          {mosaic.map((d) => (
            <div key={d.city} className="relative overflow-hidden">
              <TripThumb city={d.city} code={d.code} className="kenburns absolute inset-0" showCode={false} />
            </div>
          ))}
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-surface" />
        <button type="button" aria-label="Close" onClick={onClose} className="absolute top-4 right-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-black/30 backdrop-blur-md active:scale-95">
          <Icon d={ICONS.close} size={20} stroke={2.4} />
        </button>
      </div>

      <div className="-mt-12 flex flex-1 flex-col gap-4 px-5 pb-safe">
        <SocialProof />
        <h1 className="rise text-center text-[29px] leading-[1.06] font-extrabold tracking-[-0.02em]">{head}</h1>

        <ul className="flex flex-col gap-2.5 self-center">
          {[
            ["📅", "Exact dates with open seats"],
            ["🔔", "Alerts when seats open"],
            ["💸", "Transfer bonus alerts"],
            ["🙋", "We help you book"],
          ].map(([emoji, t], i) => (
            <li key={t} className="rise flex items-center gap-3 text-[16px] font-bold" style={stagger(i + 1, 60)}>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-soft text-[17px]">{emoji}</span>
              {t}
            </li>
          ))}
        </ul>

        <div className="flex-1" />
        <ContinueBar onContinue={onStart} />
      </div>
    </div>
  );
}

/** The travelers-count badge, shared by both paywall pages. */
export function SocialProof() {
  return (
    <div className="rise flex items-center gap-2 self-center rounded-full bg-surface py-1 pr-3 pl-1 text-ink shadow-[0_6px_18px_rgba(15,23,48,0.12)]">
      <span className="flex">
        {["#FF655B", "#FD297B", "#0EA5E9"].map((c, i) => (
          <span key={c} className="h-5 w-5 rounded-full border-2 border-surface" style={{ background: c, marginLeft: i ? -7 : 0 }} />
        ))}
      </span>
      <span className="text-[12px] font-bold">Join 30,000+ travelers who get Trace deals</span>
    </div>
  );
}

/** The big Continue with the no-commitment line under it, on every paywall page. */
export function ContinueBar({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="flex flex-col gap-2">
      <PrimaryButton className="text-[18px]" onClick={onContinue}>
        Continue
      </PrimaryButton>
      <div className="text-center text-[13.5px] font-semibold text-muted">No commitment · Cancel anytime</div>
    </div>
  );
}

/** Page 2: reviews, then the same Continue. Only shown when there are reviews this build can show. */
export function ReviewsPage({ onBack, onContinue }: { onBack: () => void; onContinue: () => void }) {
  const reviews = shownReviews();
  useEffect(() => {
    track("reviews_view", { count: reviews.length });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="sticky top-0 z-20 flex items-center gap-3 bg-surface/90 px-5 pt-4 pb-3 backdrop-blur">
        <button type="button" aria-label="Back" onClick={onBack} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-soft active:scale-95">
          <Icon d={ICONS.back} size={18} stroke={2.4} />
        </button>
      </div>
      <div className="flex flex-col items-center gap-2 px-5 pb-4 text-center">
        <Stars size={26} />
        <h1 className="text-[29px] leading-[1.06] font-extrabold tracking-[-0.02em]">Travelers love Trace</h1>
      </div>
      <ul className="flex flex-col gap-3 px-5 pb-6">
        {reviews.map((r, i) => (
          <li key={r.name} className="rise flex flex-col gap-2 rounded-3xl bg-soft p-4" style={stagger(Math.min(i, 6), 50)}>
            <div className="flex items-center justify-between gap-2">
              <Stars size={15} />
              {r.trip && <span className="truncate rounded-full bg-surface px-2.5 py-0.5 text-[11.5px] font-bold text-muted">✈️ {r.trip}</span>}
            </div>
            <p className="text-[15px] leading-snug font-medium">&ldquo;{r.text}&rdquo;</p>
            <span className="text-[13px] font-bold text-muted">
              {r.name}
              {r.sample && <span className="ml-2 rounded bg-[#FBBF24] px-1.5 py-0.5 text-[10px] font-extrabold text-black">SAMPLE · DEV ONLY</span>}
            </span>
          </li>
        ))}
      </ul>
      <div className="pb-safe sticky bottom-0 z-20 mt-auto bg-gradient-to-t from-surface from-70% to-surface/0 px-5 pt-6">
        <ContinueBar onContinue={onContinue} />
      </div>
    </div>
  );
}

const Stars = ({ size }: { size: number }) => (
  <span className="flex gap-0.5 text-[#FBBF24]" aria-label="5 stars" style={{ fontSize: size, lineHeight: 1 }}>
    {"★★★★★"}
  </span>
);
