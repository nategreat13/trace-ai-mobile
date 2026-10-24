"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { track } from "@/lib/analytics";
import { creditFor, photoFor } from "@/lib/images";
import { planPrice } from "@/lib/payments";
import { usePoints } from "@/lib/store";
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

/**
 * A framed window onto the trip: the photos zoom slowly inside a rounded
 * frame, like looking out the plane window, with the headline below.
 */
export function Landing({ onStart }: { onStart: () => void }) {
  const [i, setI] = useState(0);
  const { state } = usePoints();
  const gift = state.gift && !state.member;
  useEffect(() => {
    track("landing_view");
    const t = window.setInterval(() => setI((x) => (x + 1) % SLIDES.length), INTERVAL);
    return () => window.clearInterval(t);
  }, []);
  const s = SLIDES[i];
  const credit = creditFor(s.city);

  return (
    <div className="trace-wash flex min-h-dvh flex-col px-5 pt-5">
      <div className="flex items-center justify-between">
        <Logo className="h-[22px]" />
        {gift ? (
          <span className="flex items-center gap-1.5 rounded-full bg-trace px-3 py-1 text-[12px] font-extrabold text-white shadow-sm">
            <Icon d={ICONS.gift} size={13} stroke={2.4} /> Gift applied: {planPrice("annual", true).each}/wk
          </span>
        ) : null}
      </div>

      <div className="relative mt-5 flex max-h-[440px] min-h-[190px] flex-1 flex-col">
        <div className="relative flex-1 overflow-hidden rounded-[36px] bg-midnight shadow-[0_24px_60px_rgba(15,23,48,0.22)] ring-[6px] ring-surface">
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
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/40" />
          {credit && (
            <a href={credit.page} target="_blank" rel="noopener noreferrer" className="absolute top-12 left-5 text-[10px] text-white/75">
              Photo: {credit.author}, {credit.license}
            </a>
          )}
          <div className="absolute top-4 right-4 left-4 flex items-center justify-between">
            <span key={s.city} className="fade rounded-full bg-black/30 px-3 py-1 text-[12.5px] font-bold text-white backdrop-blur-md">
              {s.city}
            </span>
            <div className="flex gap-1.5" aria-hidden="true">
              {SLIDES.map((sl, k) => (
                <span key={sl.city} className={cx("h-1.5 rounded-full bg-white transition-all duration-500", k === i ? "w-5 opacity-100" : "w-1.5 opacity-50")} />
              ))}
            </div>
          </div>
        </div>

        <div
          key={s.city}
          className="rise absolute -bottom-7 left-1/2 flex w-[86%] -translate-x-1/2 items-center gap-3 rounded-2xl bg-surface p-3 shadow-[0_14px_36px_rgba(15,23,48,0.18)]"
        >
          <span className="bg-trace flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white">
            <Icon d={ICONS.plane} size={22} stroke={1.6} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="nums text-[19px] font-extrabold">{s.points} points</span>
            <span className="truncate text-[13.5px] font-medium text-muted">{s.what}</span>
          </span>
        </div>
      </div>

      <div className="mt-12 flex flex-col gap-2.5">
        <h1 className="text-[38px] leading-[1.02] font-extrabold tracking-[-0.025em]">
          You&apos;re sitting on a <span className="text-gradient">free flight.</span>
        </h1>
        <p className="text-[17px] leading-snug font-medium text-muted">See where your points can take you.</p>
      </div>

      <div className="flex flex-col gap-2.5 pt-5 pb-safe">
        <PrimaryButton onClick={onStart}>See my free flights</PrimaryButton>
        <div className="text-center text-[13px] font-medium text-muted">Takes 60 seconds</div>
        <div className="flex items-center justify-between pt-0.5 text-[12.5px] text-muted">
          <span>
            Already a member?{" "}
            <Link href="/signin" className="font-bold text-ink underline-offset-2 hover:underline">
              Sign in
            </Link>
          </span>
          <span>
            <Link href="/privacy" className="underline-offset-2 hover:underline">Privacy</Link> ·{" "}
            <Link href="/terms" className="underline-offset-2 hover:underline">Terms</Link>
          </span>
        </div>
      </div>
    </div>
  );
}
