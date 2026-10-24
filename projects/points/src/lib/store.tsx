"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { OFFERED_IDS } from "@/engine/data";
import { buildDeck, pointValues } from "@/engine/engine";
import type { Balances, PointsInput, ProgramId, TripResult } from "@/engine/types";
import { track } from "./analytics";
import { todayIso } from "./format";

export type FunnelStep =
  | "land" | "progs" | "bal" | "air" | "trav" | "picks" | "load" | "email" | "results" | "pay" | "reviews" | "done";

/** A trip the user searched for and asked us to watch. */
export interface PlannedTrip {
  id: string;
  /** The priced trip being watched. */
  tripId: string;
  city: string;
  /** YYYY-MM-DD. */
  depart: string;
  /** YYYY-MM-DD, or "" for one way. */
  ret: string;
  flexible: boolean;
  travelers: number;
  cabin: "any" | "economy" | "business";
  addedAt: string;
}

/**
 * A trip the user asked for that Trace doesn't price yet (or not in that
 * cabin). Phase 1 these feed the manual verification queue; until there's a
 * backend they live on the device and fire a `trip_request` event.
 */
export interface TripRequest {
  id: string;
  /** What they typed or picked, e.g. "Lisbon" or "Iceland". */
  destination: string;
  depart: string;
  ret: string;
  flexible: boolean;
  travelers: number;
  cabin: "any" | "economy" | "business";
  note: string;
  createdAt: string;
}

/**
 * A started trial or subscription. Test mode (no Stripe keys yet) creates it
 * on the device; with Stripe it's created after Checkout succeeds and the
 * session is verified server-side.
 */
export interface Membership {
  plan: "annual" | "monthly";
  /** "gift" when they took the $59.99 annual exit offer. */
  offer?: string;
  startedAt: string;
  /** When the free week ends and billing starts, ISO. */
  trialEndsAt: string;
  testMode: boolean;
  /** Stripe subscription status (trialing, active, past_due). */
  status?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
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
  requests: TripRequest[];
  plan: "annual" | "monthly";
  /** Claimed the exit gift: annual at $59.99, still with the free week. */
  gift: boolean;
  /** The gift shows once; after that, leaving checkout just leaves. */
  giftOffered: boolean;
  /** Reached the payment page, so backing out of it can trigger the gift. */
  checkoutVisited: boolean;
  member: null | Membership;
  alertsReadAt: string | null;
  /** The dollar value counts up only on the first look at results. */
  resultsSeen: boolean;
  /**
   * Tapped "I don't have points yet": results show what one card's sign-up
   * bonus (STARTER below) would book, labeled as such.
   */
  starter: boolean;
}

/** The "no points yet" scenario: the Chase Sapphire Preferred's sign-up bonus. */
export const STARTER = { program: "chase" as const, points: 75000, card: "Chase Sapphire Preferred" };

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
  requests: [],
  plan: "annual",
  gift: false,
  giftOffered: false,
  checkoutVisited: false,
  member: null,
  alertsReadAt: null,
  resultsSeen: false,
  starter: false,
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
        // Plans from the first build had no dates; drop them rather than show broken rows.
        saved.planned = (saved.planned ?? []).filter((p) => p.tripId && p.depart);
        // A reload mid-animation picks up where the animation would have ended.
        if (saved.step === "load") saved.step = "results";
        // Steps from older builds that no longer exist.
        if (saved.step === "trav") saved.step = "picks";
        if (saved.step === "email") saved.step = "results";
        // Programs no longer offered (Wells Fargo, Marriott) drop out of the answers.
        saved.progs = (saved.progs ?? []).filter((id) => OFFERED_IDS.includes(id));
        setState(saved);
      }
    } catch {
      // Private mode or corrupt data: start fresh.
    }
    // The retargeting ad links to ?offer=gift: the $5/mo gift is on from the first screen.
    const url = new URL(window.location.href);
    if (url.searchParams.get("offer") === "gift") {
      setState((s) => {
        if (s.member) return s;
        if (!s.gift) track("gift_claimed", { where: "ad_link" });
        return { ...s, gift: true, plan: "annual", giftOffered: true };
      });
      url.searchParams.delete("offer");
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
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

/**
 * What "Not sure" counts as, and where every balance starts in the funnel. Low
 * on purpose: most people have at least this, so results don't oversell.
 */
export const GUESS = 20_000;

/** Balances the engine sees: the guess swapped in for "Not sure". */
export function effectiveBalances(s: PointsState): Balances {
  const out: Balances = {};
  for (const id of s.progs) {
    out[id] = s.estimated[id] ? GUESS : Number(s.balances[id]) || 0;
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
