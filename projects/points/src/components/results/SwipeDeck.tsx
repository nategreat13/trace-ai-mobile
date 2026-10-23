"use client";

import { useRef, useState } from "react";
import type { TripResult } from "@/engine/types";
import { money, num, plural } from "@/lib/format";
import { tripLabel } from "@/lib/tripText";
import { TripThumb } from "../TripThumb";
import { HeartIcon, Icon, ICONS, LockIcon, StatusPill } from "../ui";

const THRESHOLD = 90;

/**
 * Dating-app deck: drag right to save, left to skip. With `freeCount` set,
 * the card after the free ones is blurred and sends the user to the paywall.
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
  cards: TripResult[];
  freeCount: number | null;
  origin: string;
  travelers: number;
  onSave: (r: TripResult) => void;
  onSkip: (r: TripResult) => void;
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
  const restOk = rest.filter((r) => r.ok).length;

  if (!cur) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <div className="text-[26px] font-black">That&apos;s all {plural(cards.length, "trip")}.</div>
        <p className="text-[15px] text-muted">Your saved trips are in My trips.</p>
        <button type="button" onClick={onDone} className="min-h-[44px] rounded-xl border border-line px-4 font-bold">
          See the list
        </button>
      </div>
    );
  }

  const advance = (right: boolean) => {
    if (locked) return onLocked();
    setDx(right ? 600 : -600);
    window.setTimeout(() => {
      if (right) onSave(cur);
      else onSkip(cur);
      setDragging(true);
      setDx(0);
      setIdx((i) => i + 1);
      requestAnimationFrame(() => setDragging(false));
    }, 200);
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

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="relative h-[min(62dvh,520px)] min-h-[380px]">
        {cards[idx + 1] && <div className="absolute inset-x-4 top-3 -bottom-2 rounded-[22px] bg-soft" />}
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="absolute inset-0 flex touch-none flex-col overflow-hidden rounded-[22px] border border-line bg-white shadow-[0_12px_32px_rgba(0,0,0,0.10)] select-none"
          style={{
            transform: `translateX(${dx}px) rotate(${dx / 18}deg)`,
            transition: dragging ? "none" : "transform .2s ease",
            cursor: locked ? "pointer" : "grab",
          }}
        >
          <Stamp side="left" opacity={Math.min(1, Math.max(0, dx / THRESHOLD))} label="SAVE" color="#15803D" />
          <Stamp side="right" opacity={Math.min(1, Math.max(0, -dx / THRESHOLD))} label="SKIP" color="#E84E3A" />
          <div className={locked ? "flex flex-1 flex-col blur-md" : "flex flex-1 flex-col"}>
            <div className="relative flex-1">
              <TripThumb city={cur.trip.city} code={cur.trip.code} className="absolute inset-0" showCode={false} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 p-5 text-white">
                <div className="font-mono text-[15px] font-bold opacity-90">{origin} → {cur.trip.code}</div>
                <div className="text-[40px] leading-none font-black">{cur.trip.city}</div>
                <div className="text-[15px] opacity-95">{tripLabel(cur)}{travelers > 1 ? ` · ${travelers} people` : ""}</div>
              </div>
            </div>
            <div className="flex items-end justify-between px-5 pt-4 pb-2">
              <div>
                <div className="text-[11px] font-extrabold tracking-[0.06em] text-muted">{travelers > 1 ? `POINTS FOR ${travelers}` : "POINTS"}</div>
                <div className="font-mono text-[28px] font-bold">{num(cur.need)}</div>
              </div>
              <div className="text-right">
                <div className="text-[11px] font-extrabold tracking-[0.06em] text-muted">CASH FARE</div>
                <div className="font-mono text-[18px] text-muted line-through">{money(cur.cashTotal)}</div>
              </div>
            </div>
            <div className="px-5 pb-5">
              <StatusPill ok={cur.ok}>{cur.ok ? "You can book this now" : `You're ${num(cur.gap)} points away`}</StatusPill>
            </div>
          </div>
          {locked && (
            <button
              type="button"
              onClick={onLocked}
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white/40 p-7 text-center"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-ink text-white">
                <LockIcon size={22} />
              </span>
              <span className="text-[26px] leading-tight font-black">{plural(rest.length, "more trip")} waiting</span>
              <span className="text-[15px] font-semibold text-ink/80">
                {restOk ? `Including ${restOk} you can book today` : "Including trips you're close to"}
              </span>
              <span className="mt-1 rounded-xl bg-gradient-to-r from-trace-red to-trace-pink px-5 py-3 text-[15px] font-extrabold text-white">
                Unlock dates free for 7 days
              </span>
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center justify-center gap-5">
        <button type="button" aria-label="Skip" onClick={() => advance(false)} className="flex h-16 w-16 items-center justify-center rounded-full border border-line bg-white text-[#E84E3A] shadow-sm">
          <Icon d={ICONS.close} size={24} stroke={2.6} />
        </button>
        <button
          type="button"
          aria-label="Trip details"
          onClick={() => (locked ? onLocked() : onInfo(cur))}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-line bg-white text-muted shadow-sm"
        >
          <Icon d={ICONS.info} size={20} />
        </button>
        <button
          type="button"
          aria-label="Save trip"
          onClick={() => advance(true)}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-trace-red to-trace-pink text-white shadow-[0_8px_24px_rgba(253,41,123,0.3)]"
        >
          <HeartIcon filled size={26} />
        </button>
      </div>
    </div>
  );
}

function Stamp({ side, opacity, label, color }: { side: "left" | "right"; opacity: number; label: string; color: string }) {
  return (
    <div
      className="pointer-events-none absolute top-5 z-20 rounded-lg border-[3px] bg-white px-2.5 py-1 text-[20px] font-black"
      style={{
        [side]: 18,
        color,
        borderColor: color,
        opacity,
        transform: `rotate(${side === "left" ? -12 : 12}deg)`,
      }}
    >
      {label}
    </div>
  );
}
