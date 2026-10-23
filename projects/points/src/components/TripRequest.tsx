"use client";

import Link from "next/link";
import { track } from "@/lib/analytics";
import { plural, shortDate } from "@/lib/format";
import { usePoints, type TripRequest } from "@/lib/store";
import { sendToTeam } from "@/lib/teamRequests";
import { Check, cx, Icon, ICONS } from "./ui";

export type RequestDraft = Omit<TripRequest, "id" | "note" | "createdAt">;

export const cabinText = (c: TripRequest["cabin"]) => (c === "any" ? "any cabin" : c);
const capFirst = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

export const requestDates = (r: Pick<TripRequest, "depart" | "ret" | "flexible">) =>
  `${shortDate(r.depart)}${r.ret ? ` – ${shortDate(r.ret)}` : " · one way"}${r.flexible ? " ± 3 days" : ""}`;

/**
 * Saves a request for a trip Trace doesn't price yet (or not in that cabin).
 * Saved on the device and sent to the team (Slack + pointsRequests), who
 * price it and reply by email.
 */
export function useSubmitRequest() {
  const { state, update } = usePoints();
  const find = (d: RequestDraft) =>
    state.requests.find(
      (r) => r.destination.toLowerCase() === d.destination.toLowerCase() && r.depart === d.depart && r.ret === d.ret && r.cabin === d.cabin,
    );
  const submit = (d: RequestDraft, note: string, reason: "unpriced" | "cabin" | "more"): TripRequest => {
    const req: TripRequest = { ...d, id: `req-${Date.now()}`, note: note.trim(), createdAt: new Date().toISOString() };
    track("trip_request", { destination: req.destination, depart: req.depart, ret: req.ret, flexible: req.flexible, travelers: req.travelers, cabin: req.cabin, reason });
    sendToTeam("trip", req.destination, [
      requestDates(req),
      `${plural(req.travelers, "traveler")} · ${capFirst(cabinText(req.cabin))}`,
      reason === "unpriced" ? "We don't price this place yet" : reason === "cabin" ? "Not priced in this cabin" : "Wants more options",
      req.note && `Note: "${req.note}"`,
    ].filter(Boolean), state);
    update((s) => ({ requests: [req, ...s.requests] }));
    return req;
  };
  return { find, submit };
}

/** Where a request stands. Three steps, honest about what's still pending. */
export function RequestStatus({ r, fresh, bare, onRemove }: { r: TripRequest; fresh?: boolean; bare?: boolean; onRemove?: () => void }) {
  const steps = [
    { label: "Requested", sub: new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }), state: "done" as const },
    { label: "Trace prices it in your points", sub: "Usually within 24 hours", state: "active" as const },
    { label: "We watch for seats on your dates", sub: "We'll email you when they open", state: "next" as const },
  ];
  return (
    <div className={cx("flex flex-col gap-4", !bare && "rounded-[24px] bg-surface p-4 shadow-[0_8px_24px_rgba(15,23,48,0.08)]", fresh && "rise")}>
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
