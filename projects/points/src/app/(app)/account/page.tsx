"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AirportSearch } from "@/components/funnel/AirportSearch";
import { BalancesEditor } from "@/components/app/BalancesEditor";
import { PRICES } from "@/components/Paywall";
import { Card, Chip, cx, Eyebrow, Icon, ICONS, SecondaryButton } from "@/components/ui";
import { AIRLINE_IDS, BANK_IDS, PROGRAMS } from "@/engine/data";
import { airportByCode } from "@/lib/airports";
import { useAccount } from "@/lib/account";
import { openBillingPortal } from "@/lib/payments";
import { usePoints } from "@/lib/store";
import { useTheme } from "@/lib/theme";

const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

export default function AccountPage() {
  const { state, update, reset } = usePoints();
  const { email: account, signOut } = useAccount();
  const router = useRouter();
  const [airport, setAirport] = useState(false);
  const [theme, setTheme] = useTheme();
  const member = state.member!;
  const started = new Date(member.startedAt);
  const trialEnds = new Date(member.trialEndsAt ?? started.getTime() + 7 * 86400000);
  const home = state.airport ? airportByCode(state.airport) : undefined;
  const trialing = member.testMode || !member.status || member.status === "trialing";
  const billing = async () => {
    const r = await openBillingPortal();
    if (r === "signin") router.push(`/signin?email=${encodeURIComponent(state.email)}`);
    return r;
  };

  return (
    <div className="flex flex-col gap-5 px-5 pt-5 pb-12">
      <h1 className="text-[28px] font-black">Account and settings</h1>

      <section className="flex flex-col gap-2">
        <Eyebrow>Plan</Eyebrow>
        <Card className="flex flex-col gap-1 p-4">
          <div className="text-[16px] font-extrabold">{PRICES[member.plan].label}{trialing ? " · free trial" : ""}</div>
          <div className="text-[14px] text-muted">
            {trialing ? <>Started {fmt(started)}. Trial ends {fmt(trialEnds)}.</> : <>Member since {fmt(started)}.</>}
            {member.status === "past_due" && <span className="block pt-1 font-semibold text-trace-red">Your last payment didn&apos;t go through. Update your card to keep access.</span>}
          </div>
          {member.testMode ? (
            <div className="pt-1 text-[12px] text-muted">Test mode: no card on file. Billing connects when Stripe keys are added.</div>
          ) : (
            <button
              type="button"
              onClick={billing}
              className="mt-2 flex min-h-[44px] items-center justify-center rounded-xl bg-soft text-[14px] font-bold"
            >
              Manage billing
            </button>
          )}
        </Card>
      </section>

      <section className="flex flex-col gap-2">
        <Eyebrow>Appearance</Eyebrow>
        <div role="radiogroup" aria-label="Appearance" className="grid grid-cols-3 gap-1 rounded-2xl bg-soft p-1">
          {(["system", "light", "dark"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={theme === t}
              onClick={() => setTheme(t)}
              className={cx("min-h-[44px] rounded-xl text-[14px] font-bold capitalize transition", theme === t ? "bg-surface shadow-sm" : "text-muted")}
            >
              {t === "system" ? "Automatic" : t}
            </button>
          ))}
        </div>
        <p className="px-1 text-[12.5px] text-muted">Automatic follows your phone, so Trace goes dark at night if your phone does.</p>
      </section>

      <section className="flex flex-col gap-2">
        <Eyebrow>Sign-in</Eyebrow>
        {account ? (
          <Card className="flex items-center gap-3 p-4">
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate text-[15.5px] font-bold">{account}</span>
              <span className="text-[13px] text-muted">Your trips and points sync to every device</span>
            </span>
            <button type="button" onClick={signOut} className="min-h-[40px] shrink-0 rounded-xl bg-soft px-3 text-[13.5px] font-bold">
              Sign out
            </button>
          </Card>
        ) : (
          <Link
            href={`/signin?email=${encodeURIComponent(state.email)}`}
            className="flex min-h-[60px] items-center gap-3 rounded-2xl border border-line px-4 active:bg-soft"
          >
            <span className="bg-trace flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white"><Icon d={ICONS.person} size={17} /></span>
            <span className="flex flex-1 flex-col leading-tight">
              <span className="text-[15.5px] font-bold">Sign in to sync</span>
              <span className="text-[13px] text-muted">Keep your trips and points on every device</span>
            </span>
            <Icon d={ICONS.chevron} size={16} stroke={2.4} className="text-muted" />
          </Link>
        )}
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

      <BalancesEditor />

      <section className="flex flex-col gap-2">
        <Eyebrow>Help</Eyebrow>
        <Link href="/contact?from=account" className="flex min-h-[60px] items-center gap-3 rounded-2xl border border-line px-4 active:bg-soft">
          <span className="bg-trace flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white"><Icon d={ICONS.mail} size={17} /></span>
          <span className="flex flex-1 flex-col leading-tight">
            <span className="text-[15.5px] font-bold">Contact us</span>
            <span className="text-[13px] text-muted">Questions, bugs or ideas. We read everything.</span>
          </span>
          <Icon d={ICONS.chevron} size={16} stroke={2.4} className="text-muted" />
        </Link>
      </section>

      <section className="flex flex-col gap-2 pt-2">
        <SecondaryButton
          onClick={async () => {
            // Real subscriptions cancel in Stripe's portal; test trials just end here.
            if (!member.testMode) {
              if ((await billing()) !== "test") return;
            }
            update({ member: null, step: "results" });
            router.replace("/");
          }}
        >
          {trialing ? "Cancel free trial" : "Cancel membership"}
        </SecondaryButton>
        <button
          type="button"
          onClick={async () => {
            if (account) await signOut();
            reset();
            router.replace("/");
          }}
          className="min-h-[44px] text-[14px] font-semibold text-muted"
        >
          {account ? "Sign out and clear this device" : "Start over and clear my data"}
        </button>
      </section>
    </div>
  );
}
