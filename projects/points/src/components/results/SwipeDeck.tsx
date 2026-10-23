"use client";

import { useRef, useState } from "react";
import type { TripResult } from "@/engine/types";
import { REGION_COLOR, type Destination } from "@/lib/destinations";
import { money, num, plural } from "@/lib/format";
import { TripThumb } from "../TripThumb";
import { CabinBadge, cx, HeartIcon, Icon, ICONS, LockIcon, StatusPill } from "../ui";
import { cabinLabel } from "./DestinationCard";

const THRESHOLD = 90;

/**
 * Dating-app deck of destinations: drag right to save, left to skip. With
 * `freeCount` set, the card after the free ones is blurred and opens the paywall.
 */
export function SwipeDeck({
  cards,
  freeCount,
  origin,
  travelers,
  onSave,
  onSkip,
  onInfo,
  onLocked,
  onDone,
}: {
  cards: Destination[];
  freeCount: number | null;
  origin: string;
  travelers: number;
  onSave: (d: Destination) => void;
  onSkip: (d: Destination) => void;
  onInfo: (r: TripResult) => void;
  onLocked: () => void;
  onDone: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<number | null>(null);

  const cur = cards[idx];
  const locked = freeCount !== null && idx >= freeCount;
  const rest = cards.slice(freeCount ?? 0);
  const restOk = rest.filter((d) => d.ok).length;

  if (!cur) {
    return (
      <div className="rise flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <span className="bg-trace flex h-14 w-14 items-center justify-center rounded-2xl text-white">
          <HeartIcon filled size={26} />
        </span>
        <div className="text-[26px] font-extrabold">That&apos;s all {plural(cards.length, "destination")}.</div>
        <p className="text-[15px] text-muted">Your saved trips are in My trips.</p>
        <button type="button" onClick={onDone} className="min-h-[46px] rounded-2xl bg-ink px-5 font-bold text-surface">
          See the list
        </button>
      </div>
    );
  }

  const advance = (right: boolean) => {
    if (locked) return onLocked();
    setDx(right ? 640 : -640);
    window.setTimeout(() => {
      if (right) onSave(cur);
      else onSkip(cur);
      setDragging(true);
      setDx(0);
      setIdx((i) => i + 1);
      requestAnimationFrame(() => setDragging(false));
    }, 220);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (locked) return;
    start.current = e.clientX;
    setDragging(true);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (start.current === null) return;
    setDx(e.clientX - start.current);
  };
  const onPointerUp = () => {
    if (start.current === null) return;
    start.current = null;
    setDragging(false);
    if (Math.abs(dx) >= THRESHOLD) advance(dx > 0);
    else setDx(0);
  };

  const next = cards[idx + 1];
  return (
    <div className="flex flex-1 flex-col gap-5">
      <div className="relative h-[min(64dvh,560px)] min-h-[440px]">
        {next && (
          <div className="absolute inset-x-3 top-3 -bottom-3 overflow-hidden rounded-[30px] opacity-60">
            <TripThumb city={next.city} code={next.code} blur={freeCount !== null && idx + 1 >= freeCount} className="absolute inset-0" showCode={false} />
          </div>
        )}
        <div
          key={cur.city}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="fade absolute inset-0 flex touch-none flex-col overflow-hidden rounded-[30px] bg-midnight text-white shadow-[0_20px_50px_rgba(15,23,48,0.28)] select-none"
          style={{
            transform: `translateX(${dx}px) rotate(${dx / 18}deg)`,
            transition: dragging ? "none" : "transform .22s ease",
            cursor: locked ? "pointer" : "grab",
          }}
        >
          <TripThumb city={cur.city} code={cur.code} blur={locked} className="kenburns absolute inset-0" showCode={false} />
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/5 to-black/90" />
          <Stamp side="left" opacity={Math.min(1, Math.max(0, dx / THRESHOLD))} label="SAVE" color="#00D665" />
          <Stamp side="right" opacity={Math.min(1, Math.max(0, -dx / THRESHOLD))} label="SKIP" color="#FF655B" />

          <div className={cx("relative flex flex-1 flex-col", locked && "blur-md")}>
            <div className="flex items-center justify-between p-4">
              <span className="flex items-center gap-1.5 rounded-full bg-black/35 px-2.5 py-1 text-[11.5px] font-bold backdrop-blur-md">
                <span className="h-2 w-2 rounded-full" style={{ background: REGION_COLOR[cur.region] }} />
                {cur.region}
              </span>
              <StatusPill ok={cur.ok} className="bg-surface">{cur.ok ? "You can book this" : `${num(cur.gap)} points away`}</StatusPill>
            </div>
            <div className="mt-auto flex flex-col gap-3 p-4">
              <div>
                <div className="nums text-[14px] font-bold opacity-85">{origin} → {cur.code}</div>
                <div className="text-[44px] leading-none font-extrabold tracking-[-0.02em]">{cur.city}</div>
              </div>
              <div className="flex flex-col gap-2">
                {cur.options.slice(0, 3).map((o) => (
                  <div
                    key={o.trip.id}
                    className={cx(
                      "flex items-center gap-3 rounded-2xl px-3 py-2.5 backdrop-blur-md",
                      o.isBusiness ? "bg-premium/80 ring-1 ring-gold/40" : "bg-white/15",
                    )}
                  >
                    <CabinBadge business={o.isBusiness} label={cabinLabel(o)} />
                    <span className="flex min-w-0 flex-1 flex-col leading-tight">
                      <span className="text-[12px] text-white/75">{o.trip.route}{travelers > 1 ? ` · ${travelers} people` : ""}</span>
                      <span className="text-[12px] text-white/60 line-through">{money(o.cashTotal)}</span>
                    </span>
                    <span className="flex flex-col items-end leading-tight">
                      <span className="nums text-[18px] font-extrabold">{num(o.need)}</span>
                      <span className={cx("text-[11.5px] font-bold", o.ok ? "text-trace-green" : "text-[#FBBF24]")}>{o.ok ? "Can book" : `${num(o.gap)} short`}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {locked && (
            <button
              type="button"
              onClick={onLocked}
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-midnight/40 p-7 text-center"
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-surface text-ink">
                <LockIcon size={26} />
              </span>
              <span className="text-[28px] leading-tight font-extrabold">{plural(rest.length, "more destination")} waiting</span>
              <span className="text-[15px] font-semibold text-white/85">
                {restOk ? `Including ${restOk} you can book today` : "Including trips you're close to"}
              </span>
              <span className="bg-trace shimmer mt-1 rounded-2xl px-6 py-3.5 text-[15px] font-extrabold">Unlock dates free for 7 days</span>
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center justify-center gap-5">
        <button type="button" aria-label="Skip" onClick={() => advance(false)} className="flex h-16 w-16 items-center justify-center rounded-full bg-surface text-trace-red shadow-[0_8px_24px_rgba(15,23,48,0.12)] active:scale-90">
          <Icon d={ICONS.close} size={26} stroke={2.8} />
        </button>
        <button
          type="button"
          aria-label="Trip details"
          onClick={() => (locked ? onLocked() : onInfo(cur.lead))}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-surface text-muted shadow-[0_8px_24px_rgba(15,23,48,0.10)] active:scale-90"
        >
          <Icon d={ICONS.info} size={20} />
        </button>
        <button
          type="button"
          aria-label="Save trip"
          onClick={() => advance(true)}
          className="bg-trace flex h-16 w-16 items-center justify-center rounded-full text-white shadow-[0_10px_26px_rgba(253,41,123,0.4)] active:scale-90"
        >
          <HeartIcon filled size={28} />
        </button>
      </div>
    </div>
  );
}

function Stamp({ side, opacity, label, color }: { side: "left" | "right"; opacity: number; label: string; color: string }) {
  return (
    <div
      className="pointer-events-none absolute top-16 z-20 rounded-xl border-[3px] px-3 py-1 text-[24px] font-extrabold"
      style={{
        [side]: 20,
        color,
        borderColor: color,
        opacity,
        background: "rgba(255,255,255,0.92)",
        transform: `rotate(${side === "left" ? -12 : 12}deg)`,
      }}
    >
      {label}
    </div>
  );
}
