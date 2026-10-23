"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useAlerts } from "@/components/app/alerts";
import { cx, Icon, ICONS } from "@/components/ui";
import { plural } from "@/lib/format";
import { usePoints } from "@/lib/store";

const TONE = {
  live: { icon: "bg-gradient-to-br from-trace-red to-trace-pink text-white", tag: "text-trace-red" },
  soon: { icon: "bg-near-bg text-near", tag: "text-near" },
  info: { icon: "bg-soft text-ink", tag: "text-muted" },
};

export default function AlertsPage() {
  const { state, update } = usePoints();
  const { alerts } = useAlerts();
  useEffect(() => {
    update({ alertsReadAt: new Date().toISOString() });
  }, [update]);

  return (
    <div className="flex flex-col gap-3 px-5 pt-5 pb-10">
      <div className="pb-1">
        <h1 className="text-[28px] font-black">Alerts</h1>
        <p className="text-[14.5px] text-muted">Picked for the programs you hold.</p>
      </div>

      {alerts.map((a) => (
        <div key={a.id} className="flex gap-3 rounded-2xl border border-line p-4">
          <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", TONE[a.tone].icon)}>
            <Icon d={a.icon} size={18} stroke={2.2} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex items-start justify-between gap-2">
              <span className="text-[15.5px] leading-snug font-extrabold">{a.title}</span>
              <span className={cx("shrink-0 pt-0.5 text-[11px] font-extrabold", TONE[a.tone].tag)}>{a.tag}</span>
            </div>
            <p className="text-[14px] leading-snug text-muted">{a.body}</p>
            {a.action && (
              <Link href={a.action.href} className="mt-1 inline-flex min-h-[40px] items-center self-start rounded-xl border border-trace-red px-3 text-[13.5px] font-bold text-trace-red">
                {a.action.label}
              </Link>
            )}
          </div>
        </div>
      ))}

      <div className="flex gap-3 rounded-2xl bg-soft p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white">
          <Icon d={ICONS.seat} size={18} />
        </span>
        <p className="text-[14px] leading-snug text-muted">
          Seat alerts for your {plural(state.saved.length, "saved trip")} land here once we confirm real dates. Alerts by email and text are coming next.
        </p>
      </div>
    </div>
  );
}
