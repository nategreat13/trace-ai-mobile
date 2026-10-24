"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics";
import { groupDestinations } from "@/lib/destinations";
import { money } from "@/lib/format";
import { hasTrial, TRIAL_DAYS } from "@/lib/payments";
import { useDeck, usePoints } from "@/lib/store";
import { PlanPicker } from "./PlanPicker";
import type { PayReason } from "./results/ResultsView";
import { TripThumb } from "./TripThumb";
import { Icon, ICONS, PrimaryButton, stagger } from "./ui";

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
  const trial = hasTrial(state.plan);

  // Everything, prices included, fits one phone screen: no scrolling to find the button.
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="relative h-[min(330px,40dvh)] shrink-0 overflow-hidden text-white">
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

      <div className="-mt-10 flex flex-1 flex-col gap-4 px-5 pb-safe">
        <h1 className="rise text-center text-[29px] leading-[1.06] font-extrabold tracking-[-0.02em]">{head}</h1>

        <ul className="flex flex-col gap-2.5 self-center">
          {[
            ["📅", "Exact dates with open seats"],
            ["🔔", "Alerts when seats open"],
            ["🙋", "We help you book"],
          ].map(([emoji, t], i) => (
            <li key={t} className="rise flex items-center gap-3 text-[16px] font-bold" style={stagger(i + 1, 60)}>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-soft text-[17px]">{emoji}</span>
              {t}
            </li>
          ))}
        </ul>

        <div className="flex-1" />

        <div className="pt-1">
          <PlanPicker />
        </div>

        <PrimaryButton className="text-[18px]" onClick={onStart}>
          Continue
        </PrimaryButton>
        <div className="-mt-2 text-center text-[13px] font-medium text-muted">
          {trial ? `${TRIAL_DAYS} days free · ` : ""}No commitment · Cancel anytime
        </div>
      </div>
    </div>
  );
}
