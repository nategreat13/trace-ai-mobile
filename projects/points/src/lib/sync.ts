import type { Membership, PointsState } from "./store";

/**
 * The parts of a user's state that follow them across devices. Funnel
 * position, theme and per-visit flags stay on the device; membership comes
 * from Stripe through the server, never from the client.
 */
export const SYNC_KEYS = [
  "progs",
  "balances",
  "estimated",
  "airport",
  "travelers",
  "picks",
  "email",
  "saved",
  "checks",
  "watching",
  "planned",
  "requests",
  "plan",
  "alertsReadAt",
] as const satisfies readonly (keyof PointsState)[];

export type SyncedState = Partial<Pick<PointsState, (typeof SYNC_KEYS)[number]>>;

export function pickSynced(s: Partial<PointsState>): SyncedState {
  const out: Record<string, unknown> = {};
  for (const k of SYNC_KEYS) if (s[k] !== undefined) out[k] = s[k];
  return out as SyncedState;
}

/** What GET /api/me returns. email is null when signed out. */
export interface MeResponse {
  email: string | null;
  /** Signed in with Google or an email link (not only the checkout email). */
  verified?: boolean;
  /** Has a Points password (password.ts), so they can sign in anywhere. */
  hasPassword?: boolean;
  member: Membership | null;
  state: SyncedState | null;
}

/** Stripe statuses that keep access on. past_due gets Stripe's retry window as grace. */
export const ACTIVE_STATUSES = ["trialing", "active", "past_due"];
