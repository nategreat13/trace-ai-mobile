"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AirportSearch } from "@/components/funnel/AirportSearch";
import { BalanceCard } from "@/components/funnel/BalanceCard";
import { PRICES } from "@/components/Paywall";
import { Card, Chip, Eyebrow, Icon, ICONS, SecondaryButton } from "@/components/ui";
import { AIRLINE_IDS, BANK_IDS, PROGRAMS } from "@/engine/data";
import { airportByCode } from "@/lib/airports";
import { usePoints } from "@/lib/store";

const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

export default function AccountPage() {
  const { state, update, reset } = usePoints();
  const router = useRouter();
  const [airport, setAirport] = useState(false);
  const member = state.member!;
  const started = new Date(member.startedAt);
  const trialEnds = new Date(started.getTime() + 7 * 86400000);
  const home = state.airport ? airportByCode(state.airport) : undefined;

  return (
    <div className="flex flex-col gap-5 px-5 pt-5 pb-12">
      <h1 className="text-[28px] font-black">Account and settings</h1>

      <section className="flex flex-col gap-2">
        <Eyebrow>Plan</Eyebrow>
        <Card className="flex flex-col gap-1 p-4">
          <div className="text-[16px] font-extrabold">{PRICES[member.plan].label} · free trial</div>
          <div className="text-[14px] text-muted">
            Started {fmt(started)}. Trial ends {fmt(trialEnds)}.
          </div>
          <div className="pt-1 text-[12px] text-muted">Test mode: no card on file. Billing connects later.</div>
        </Card>
      </section>

      <section className="flex flex-col gap-2">
        <Eyebrow>Email</Eyebrow>
        <input
          type="email"
          aria-label="Email"
          value={state.email}
          onChange={(e) => update({ email: e.target.value })}
          placeholder="you@example.com"
          className="min-h-[50px] rounded-xl border border-line px-3.5 text-[16px] outline-none focus:border-trace-red"
        />
      </section>

      <section className="flex flex-col gap-2">
        <Eyebrow>Home airport</Eyebrow>
        {airport ? (
          <AirportSearch
            onPick={(a) => {
              update({ airport: a.code });
              setAirport(false);
            }}
          />
        ) : (
          <Card className="flex items-center justify-between gap-3 p-4">
            <span className="flex items-center gap-3">
              <span className="nums text-[17px] font-bold text-trace-red">{state.airport}</span>
              <span className="font-bold">{home?.city}</span>
            </span>
            <button type="button" onClick={() => setAirport(true)} className="min-h-[40px] rounded-xl bg-soft px-3 text-[14px] font-bold">
              Change
            </button>
          </Card>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <Eyebrow>Travelers</Eyebrow>
        <Card className="flex items-center justify-between p-3">
          <button
            type="button"
            aria-label="Fewer travelers"
            disabled={state.travelers <= 1}
            onClick={() => update((s) => ({ travelers: Math.max(1, s.travelers - 1) }))}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-line disabled:opacity-40"
          >
            <Icon d={ICONS.minus} size={20} />
          </button>
          <span className="text-[17px] font-extrabold" aria-live="polite">
            {state.travelers} {state.travelers === 1 ? "traveler" : "travelers"}
          </span>
          <button
            type="button"
            aria-label="More travelers"
            disabled={state.travelers >= 6}
            onClick={() => update((s) => ({ travelers: Math.min(6, s.travelers + 1) }))}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-line disabled:opacity-40"
          >
            <Icon d={ICONS.plus} size={20} />
          </button>
        </Card>
      </section>

      <section className="flex flex-col gap-2">
        <Eyebrow>Programs and balances</Eyebrow>
        <div className="flex flex-wrap gap-2">
          {[...BANK_IDS, ...AIRLINE_IDS].map((id) => {
            const on = state.progs.includes(id);
            return (
              <Chip
                key={id}
                on={on}
                onClick={() => update((s) => ({ progs: on ? s.progs.filter((x) => x !== id) : [...s.progs, id] }))}
              >
                {PROGRAMS[id].short}
              </Chip>
            );
          })}
        </div>
        <div className="flex flex-col gap-3 pt-1">
          {state.progs.map((id) => (
            <BalanceCard key={id} id={id} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2 pt-2">
        <SecondaryButton
          onClick={() => {
            update({ member: null, step: "results" });
            router.replace("/");
          }}
        >
          Cancel free trial
        </SecondaryButton>
        <button
          type="button"
          onClick={() => {
            reset();
            router.replace("/");
          }}
          className="min-h-[44px] text-[14px] font-semibold text-muted"
        >
          Start over and clear my data
        </button>
      </section>
    </div>
  );
}
