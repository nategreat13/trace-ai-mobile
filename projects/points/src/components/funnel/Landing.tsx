"use client";

import { useEffect, useState } from "react";
import { track } from "@/lib/analytics";
import { creditFor, photoFor } from "@/lib/images";
import { cx, Icon, ICONS, Logo, PrimaryButton } from "../ui";

/** Each slide pairs a place with what points typically book there, one way. */
const SLIDES = [
  { city: "Maui", code: "OGG", points: "12,500", what: "Hawaii in economy" },
  { city: "Tokyo", code: "HND", points: "52,500", what: "Tokyo in ANA business" },
  { city: "Santorini", code: "JTR", points: "22,500", what: "The Greek islands" },
  { city: "New York", code: "EWR", points: "22,500", what: "New York in a lie-flat seat" },
  { city: "Punta Cana", code: "PUJ", points: "15,000", what: "The Caribbean in economy" },
];

const INTERVAL = 4500;

export function Landing({ onStart }: { onStart: () => void }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    track("landing_view");
    const t = window.setInterval(() => setI((x) => (x + 1) % SLIDES.length), INTERVAL);
    return () => window.clearInterval(t);
  }, []);
  const s = SLIDES[i];
  const credit = creditFor(s.city);

  return (
    <div className="relative flex h-dvh min-h-[640px] flex-col overflow-hidden bg-midnight text-white">
      {SLIDES.map((sl, k) => (
        <div
          key={sl.city}
          aria-hidden="true"
          className="absolute inset-0 transition-opacity duration-[1200ms] ease-out"
          style={{ opacity: k === i ? 1 : 0 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoFor(sl.city)}
            alt=""
            className={cx("h-full w-full object-cover", k === i && "kenburns")}
            fetchPriority={k === 0 ? "high" : "low"}
          />
        </div>
      ))}
      <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/0 to-black/85" />

      <div className="relative z-10 flex items-center justify-between px-6 pt-6">
        <Logo light className="h-[22px]" />
        <div className="flex gap-1.5" aria-hidden="true">
          {SLIDES.map((sl, k) => (
            <span key={sl.city} className={cx("h-1.5 rounded-full bg-white transition-all duration-500", k === i ? "w-5 opacity-100" : "w-1.5 opacity-50")} />
          ))}
        </div>
      </div>

      <div className="relative z-10 mt-auto flex flex-col gap-5 px-6 pb-safe">
        <div key={s.city} className="rise flex items-center gap-3 self-start rounded-2xl border border-white/25 bg-white/15 py-2.5 pr-4 pl-3 backdrop-blur-md">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-trace-pink">
            <Icon d={ICONS.plane} size={20} stroke={1.6} />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="nums text-[19px] font-extrabold">{s.points} points</span>
            <span className="text-[13.5px] font-medium text-white/85">{s.what}</span>
          </span>
        </div>

        <h1 className="text-[44px] leading-[1.02] font-extrabold tracking-[-0.02em] drop-shadow-[0_2px_12px_rgba(0,0,0,0.35)]">
          You&apos;re sitting on a free flight.
        </h1>
        <p className="-mt-1 max-w-[30ch] text-[17px] leading-snug font-medium text-white/90">
          Your points already book trips most people never find. We&apos;ll show you which ones, from your airport.
        </p>

        <div className="flex flex-col gap-2.5 pt-1">
          <PrimaryButton onClick={onStart}>See what my points can book</PrimaryButton>
          <div className="flex items-center justify-center gap-3 text-[13px] font-medium text-white/80">
            <span>60 seconds</span>
            <span className="h-1 w-1 rounded-full bg-white/60" />
            <span>No card needed</span>
            <span className="h-1 w-1 rounded-full bg-white/60" />
            <span>No logins</span>
          </div>
        </div>
        <div className="-mt-2 flex justify-between text-[10.5px] text-white/55">
          <span>Typical saver prices, one way.</span>
          {credit && (
            <a href={credit.page} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
              Photo: {credit.author}, {credit.license}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
