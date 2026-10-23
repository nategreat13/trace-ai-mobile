"use client";

import type { TripResult } from "@/engine/types";
import { money, num } from "@/lib/format";
import { statusText, tripLabel } from "@/lib/tripText";
import { TripThumb } from "../TripThumb";
import { cx, HeartIcon, LockIcon, Status } from "../ui";

export function TripList({
  ok,
  near,
  picks,
  isLocked,
  saved,
  showHearts,
  onOpen,
  onToggleSave,
}: {
  ok: TripResult[];
  near: TripResult[];
  picks: string[];
  isLocked: (r: TripResult) => boolean;
  saved: string[];
  showHearts: boolean;
  onOpen: (r: TripResult) => void;
  onToggleSave: (r: TripResult) => void;
}) {
  if (!ok.length && !near.length) {
    return <p className="py-10 text-center text-[15px] text-muted">No trips match this filter yet.</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      {ok.length > 0 && <SectionHead ok label="You can book now" count={ok.length} />}
      {ok.map((r) => (
        <Row key={r.trip.id} r={r} picked={picks.includes(r.trip.city)} locked={isLocked(r)} saved={saved.includes(r.trip.id)} showHeart={showHearts} onOpen={onOpen} onToggleSave={onToggleSave} />
      ))}
      {near.length > 0 && <SectionHead ok={false} label="Almost there" count={near.length} />}
      {near.map((r) => (
        <Row key={r.trip.id} r={r} picked={picks.includes(r.trip.city)} locked={isLocked(r)} saved={saved.includes(r.trip.id)} showHeart={showHearts} onOpen={onOpen} onToggleSave={onToggleSave} />
      ))}
    </div>
  );
}

function SectionHead({ ok, label, count }: { ok: boolean; label: string; count: number }) {
  return (
    <div className="flex items-baseline justify-between px-0.5 pt-3">
      <span className={cx("flex items-center gap-2 text-[12px] font-extrabold tracking-[0.06em] uppercase", ok ? "text-ok" : "text-near")}>
        <span className={cx("h-2 w-2 rounded-full", ok ? "bg-trace-green" : "bg-[#F59E0B]")} />
        {label}
      </span>
      <span className="text-[12px] text-muted">{count}</span>
    </div>
  );
}

function Row({
  r,
  picked,
  locked,
  saved,
  showHeart,
  onOpen,
  onToggleSave,
}: {
  r: TripResult;
  picked: boolean;
  locked: boolean;
  saved: boolean;
  showHeart: boolean;
  onOpen: (r: TripResult) => void;
  onToggleSave: (r: TripResult) => void;
}) {
  const blur = locked ? "blur-[5px] select-none" : "";
  return (
    <div className="flex items-center gap-1 rounded-2xl border border-line bg-white p-2 pr-1">
      <button
        type="button"
        onClick={() => onOpen(r)}
        aria-label={locked ? `Locked trip, ${statusText(r)}. Unlock to see it.` : `${r.trip.city}, ${tripLabel(r)}`}
        className="flex min-h-[56px] min-w-0 flex-1 items-center gap-3 text-left"
      >
        <TripThumb city={r.trip.city} code={r.trip.code} blur={locked} className="h-14 w-14 shrink-0 rounded-xl" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={cx("flex items-center gap-1.5 text-[16px] font-extrabold", blur)}>
            <span className="truncate">{r.trip.city}</span>
            {picked && !locked && (
              <span className="shrink-0 rounded-full bg-trace-red px-1.5 py-0.5 text-[10px] font-extrabold text-white">YOUR PICK</span>
            )}
          </span>
          <span className={cx("truncate text-[12.5px] text-muted", locked && "blur-[3px] select-none")}>
            {tripLabel(r)} · {money(r.cashTotal)} value
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-0.5 pr-1">
          <span className={cx("font-mono text-[14px] font-bold", blur)}>{num(r.need)}</span>
          <Status ok={r.ok} className="flex items-center gap-1 text-[11.5px]">
            {locked && <LockIcon size={11} />}
            {statusText(r)}
          </Status>
        </span>
      </button>
      {showHeart && (
        <button
          type="button"
          onClick={() => onToggleSave(r)}
          aria-label={saved ? `Remove ${r.trip.city} from saved` : `Save ${r.trip.city}`}
          aria-pressed={saved}
          className={cx("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", saved ? "text-trace-pink" : "text-[#A3A3A3]")}
        >
          <HeartIcon filled={saved} />
        </button>
      )}
    </div>
  );
}
