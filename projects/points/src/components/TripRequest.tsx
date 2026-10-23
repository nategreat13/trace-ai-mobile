"use client";

import Link from "next/link";
import { useState } from "react";
import { track } from "@/lib/analytics";
import { plural, shortDate } from "@/lib/format";
import { usePoints, type TripRequest } from "@/lib/store";
import { Check, cx, Icon, ICONS, PrimaryButton } from "./ui";

export type RequestDraft = Omit<TripRequest, "id" | "note" | "createdAt">;

const cabinText = (c: TripRequest["cabin"]) => (c === "any" ? "any cabin" : c);
const capFirst = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

export const requestDates = (r: Pick<TripRequest, "depart" | "ret" | "flexible">) =>
  `${shortDate(r.depart)}${r.ret ? ` – ${shortDate(r.ret)}` : " · one way"}${r.flexible ? " ± 3 days" : ""}`;

/**
 * When a search comes up empty, the user can still ask for that exact trip.
 * Requests feed the Phase 1 manual verification queue; for now they're saved
 * on the device and fired as a `trip_request` event.
 */
export function RequestPanel({ draft, reason }: { draft: RequestDraft; reason: "unpriced" | "cabin" | "more" }) {
  const { state, update } = usePoints();
  const [note, setNote] = useState("");
  const existing = state.requests.find(
    (r) => r.destination.toLowerCase() === draft.destination.toLowerCase() && r.depart === draft.depart && r.ret === draft.ret && r.cabin === draft.cabin,
  );

  if (existing) return <RequestStatus r={existing} fresh />;

  const head =
    reason === "unpriced"
      ? `We don't price ${draft.destination} yet`
      : reason === "cabin"
        ? `No ${cabinText(draft.cabin)} options for ${draft.destination} yet`
        : "Not what you had in mind?";

  return (
    <div className="rise flex flex-col gap-3 rounded-[28px] bg-gradient-to-br from-[#F3EEFF] via-[#FFF0F6] to-[#FFF4E5] p-5">
      <span className="bg-trace flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-[0_8px_20px_rgba(253,41,123,0.3)]">
        <Icon d={ICONS.sparkle} size={24} stroke={2.2} />
      </span>
      <div>
        <h3 className="text-[20px] leading-tight font-extrabold tracking-[-0.01em]">{head}</h3>
        <p className="pt-1 text-[14.5px] leading-snug text-muted">
          Request it and a Trace analyst prices it in your points, then watches for seats on your dates. Most requests are answered within 24 hours.
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5 text-[12.5px] font-bold">
        <span className="rounded-full bg-white px-2.5 py-1">{draft.destination}</span>
        <span className="nums rounded-full bg-white px-2.5 py-1">{requestDates(draft)}</span>
        <span className="rounded-full bg-white px-2.5 py-1">{plural(draft.travelers, "traveler")}</span>
        <span className="rounded-full bg-white px-2.5 py-1">{capFirst(cabinText(draft.cabin))}</span>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-extrabold tracking-[0.06em] text-muted uppercase">Anything else? (optional)</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={280}
          placeholder="Nonstop only, a specific airline, use my Amex first…"
          className="resize-none rounded-2xl bg-white px-4 py-3 text-[15px] outline-none focus:ring-2 focus:ring-trace-pink"
        />
      </label>
      <PrimaryButton
        onClick={() => {
          const req: TripRequest = { ...draft, id: `req-${Date.now()}`, note: note.trim(), createdAt: new Date().toISOString() };
          track("trip_request", {
            destination: req.destination,
            depart: req.depart,
            ret: req.ret,
            flexible: req.flexible,
            travelers: req.travelers,
            cabin: req.cabin,
            reason,
          });
          update((s) => ({ requests: [req, ...s.requests] }));
        }}
      >
        Request this trip
      </PrimaryButton>
    </div>
  );
}

/** Where a request stands. Three steps, honest about what's still pending. */
export function RequestStatus({ r, fresh, onRemove }: { r: TripRequest; fresh?: boolean; onRemove?: () => void }) {
  const steps = [
    { label: "Requested", sub: new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }), state: "done" as const },
    { label: "Trace prices it in your points", sub: "Usually within 24 hours", state: "active" as const },
    { label: "We watch for seats on your dates", sub: "You'll get an alert when they open", state: "next" as const },
  ];
  return (
    <div className={cx("flex flex-col gap-4 rounded-[24px] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,48,0.08)]", fresh && "rise")}>
      <div className="flex items-start gap-3">
        <span className="bg-premium flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-gold">
          <Icon d={ICONS.pin} size={22} stroke={2} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[17px] font-extrabold">{r.destination}</span>
          <span className="nums text-[13px] font-semibold text-muted">
            {requestDates(r)} · {plural(r.travelers, "traveler")} · {capFirst(cabinText(r.cabin))}
          </span>
          {r.note && <span className="pt-1 text-[13px] text-muted italic">&ldquo;{r.note}&rdquo;</span>}
        </div>
        {onRemove && (
          <button type="button" aria-label={`Cancel request for ${r.destination}`} onClick={onRemove} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted active:bg-soft">
            <Icon d={ICONS.close} size={16} stroke={2.4} />
          </button>
        )}
      </div>
      <ol className="flex flex-col gap-0">
        {steps.map((st, i) => (
          <li key={st.label} className="flex gap-3">
            <span className="flex flex-col items-center">
              <span
                className={cx(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                  st.state === "done" && "bg-trace-green text-white",
                  st.state === "active" && "bg-trace-pink/15 text-trace-pink",
                  st.state === "next" && "border-2 border-line",
                )}
              >
                {st.state === "done" && <Check size={12} />}
                {st.state === "active" && <span className="pulse-soft h-2.5 w-2.5 rounded-full bg-trace-pink" />}
              </span>
              {i < steps.length - 1 && <span className={cx("my-1 w-0.5 flex-1", st.state === "done" ? "bg-trace-green" : "bg-line")} />}
            </span>
            <span className={cx("flex flex-col pb-3", st.state === "next" && "opacity-60")}>
              <span className="text-[14.5px] font-bold">{st.label}</span>
              <span className="text-[12.5px] text-muted">{st.sub}</span>
            </span>
          </li>
        ))}
      </ol>
      {fresh && (
        <Link href="/trips" className="flex items-center justify-between rounded-2xl bg-soft px-4 py-3 text-[14px] font-bold">
          See it in My trips <Icon d={ICONS.chevron} size={16} stroke={2.4} />
        </Link>
      )}
      <p className="text-[11.5px] leading-snug text-muted">Test mode: requests are saved on this device until Trace&apos;s request queue is connected.</p>
    </div>
  );
}
