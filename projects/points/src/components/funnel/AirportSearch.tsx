"use client";

import { useState } from "react";
import { searchAirports, type LaunchAirport } from "@/lib/airports";
import { track } from "@/lib/analytics";
import { usePoints } from "@/lib/store";
import { Icon, ICONS } from "../ui";

export function AirportSearch({ onPick }: { onPick: (a: LaunchAirport) => void }) {
  const { state, update } = usePoints();
  const [q, setQ] = useState("");
  const [email, setEmail] = useState(state.outOfRegionEmail);
  const [sent, setSent] = useState(!!state.outOfRegionEmail);
  const matches = searchAirports(q);
  const none = q.trim().length >= 2 && matches.length === 0;
  const emailOk = /.+@.+\..+/.test(email);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <label htmlFor="air-search" className="sr-only">Search airports</label>
        <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted">
          <Icon d={ICONS.search} size={20} />
        </span>
        <input
          id="air-search"
          type="search"
          autoComplete="off"
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="City, state, zip or airport code"
          className="min-h-[58px] w-full rounded-[14px] border border-line bg-soft pr-4 pl-12 text-[17px] outline-none focus:border-trace-red focus:bg-white"
        />
      </div>

      {matches.length > 0 && (
        <ul className="overflow-hidden rounded-[14px] border border-line" role="listbox" aria-label="Airports">
          {matches.map(({ airport: a, detail }) => (
            <li key={a.code} className="border-b border-line last:border-b-0">
              <button
                type="button"
                role="option"
                aria-selected={state.airport === a.code}
                onClick={() => onPick(a)}
                className="flex min-h-[60px] w-full items-center gap-4 px-4 text-left active:bg-soft"
              >
                <span className="w-12 font-mono text-[17px] font-bold text-trace-red">{a.code}</span>
                <span className="flex flex-col">
                  <span className="text-[16px] font-bold">{a.city}</span>
                  <span className="text-[12.5px] text-muted">{detail}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {none && (
        <div className="flex flex-col gap-3 rounded-[14px] border border-line p-4">
          <p className="text-[15px] font-bold">We&apos;re starting with western US airports. More soon.</p>
          {sent ? (
            <p className="text-[14px] text-muted">Thanks. We&apos;ll email you when Trace Points reaches your airport.</p>
          ) : (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!emailOk) return;
                update({ outOfRegionEmail: email });
                track("out_of_region_email", { query: q });
                setSent(true);
              }}
            >
              <label htmlFor="oor-email" className="sr-only">Email</label>
              <input
                id="oor-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="min-h-[48px] min-w-0 flex-1 rounded-xl border border-line px-3 text-[16px] outline-none focus:border-trace-red"
              />
              <button type="submit" disabled={!emailOk} className="min-h-[48px] rounded-xl bg-ink px-4 text-[15px] font-bold text-white disabled:bg-line disabled:text-muted">
                Notify me
              </button>
            </form>
          )}
        </div>
      )}

      {!q && <p className="text-[14px] text-muted">Try &ldquo;Utah&rdquo;, &ldquo;84101&rdquo; or &ldquo;bay area&rdquo;.</p>}
    </div>
  );
}
