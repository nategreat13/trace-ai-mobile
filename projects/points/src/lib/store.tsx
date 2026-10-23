"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { PROGRAMS } from "@/engine/data";
import { buildDeck, pointValues } from "@/engine/engine";
import type { Balances, PointsInput, ProgramId, TripResult } from "@/engine/types";
import { todayIso } from "./format";

export type FunnelStep =
  | "land" | "progs" | "bal" | "air" | "trav" | "picks" | "load" | "email" | "results" | "pay" | "done";

export interface PlannedTrip {
  id: string;
  city: string;
  when: string;
}

export interface PointsState {
  step: FunnelStep;
  progs: ProgramId[];
  /** Typed balances; "" while the field is empty. */
  balances: Partial<Record<ProgramId, number | "">>;
  /** Programs using the "Not sure" estimate. */
  estimated: Partial<Record<ProgramId, boolean>>;
  airport: string | null;
  travelers: number;
  picks: string[];
  email: string;
  outOfRegionEmail: string;
  saved: string[];
  /** Booking checklist ticks, keyed `${tripId}:${step}`. */
  checks: Record<string, boolean>;
  watching: Record<string, boolean>;
  planned: PlannedTrip[];
  plan: "annual" | "monthly";
  /** Set by the paywall's test unlock until Stripe is connected. */
  member: null | { plan: "annual" | "monthly"; startedAt: string; testMode: true };
  alertsReadAt: string | null;
  /** The dollar value counts up only on the first look at results. */
  resultsSeen: boolean;
}

export const INITIAL: PointsState = {
  step: "land",
  progs: [],
  balances: {},
  estimated: {},
  airport: null,
  travelers: 1,
  picks: [],
  email: "",
  outOfRegionEmail: "",
  saved: [],
  checks: {},
  watching: {},
  planned: [],
  plan: "annual",
  member: null,
  alertsReadAt: null,
  resultsSeen: false,
};

const KEY = "trace-points:v1";

type Update = (patch: Partial<PointsState> | ((s: PointsState) => Partial<PointsState>)) => void;

const Ctx = createContext<{ state: PointsState; update: Update; reset: () => void; ready: boolean } | null>(null);

export function PointsProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PointsState>(INITIAL);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const saved = { ...INITIAL, ...JSON.parse(raw) } as PointsState;
        // A reload mid-animation picks up where the animation would have ended.
        if (saved.step === "load") saved.step = "email";
        setState(saved);
      }
    } catch {
      // Private mode or corrupt data: start fresh.
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // Storage full or blocked; the session still works.
    }
  }, [state, ready]);

  const update = useCallback<Update>((patch) => {
    setState((s) => ({ ...s, ...(typeof patch === "function" ? patch(s) : patch) }));
  }, []);
  const reset = useCallback(() => setState(INITIAL), []);

  const value = useMemo(() => ({ state, update, reset, ready }), [state, update, reset, ready]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePoints() {
  const c = useContext(Ctx);
  if (!c) throw new Error("usePoints outside PointsProvider");
  return c;
}

/** Balances the engine sees: estimates swapped in for "Not sure". */
export function effectiveBalances(s: PointsState): Balances {
  const out: Balances = {};
  for (const id of s.progs) {
    out[id] = s.estimated[id] ? PROGRAMS[id].typical : Number(s.balances[id]) || 0;
  }
  return out;
}

export function pointsInput(s: PointsState): PointsInput {
  return {
    balances: effectiveBalances(s),
    origin: s.airport ?? "LAX",
    travelers: s.travelers,
    picks: s.picks,
    asOf: todayIso(),
  };
}

export function useDeck(): {
  deck: TripResult[];
  ok: TripResult[];
  near: TripResult[];
  values: ReturnType<typeof pointValues>;
  input: PointsInput;
} {
  const { state } = usePoints();
  return useMemo(() => {
    const input = pointsInput(state);
    const deck = state.airport && state.progs.length ? buildDeck(input) : [];
    return {
      deck,
      ok: deck.filter((r) => r.ok),
      near: deck.filter((r) => !r.ok),
      values: pointValues(input.balances),
      input,
    };
  }, [state]);
}
