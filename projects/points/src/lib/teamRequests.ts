"use client";

import { effectiveBalances, type PointsState } from "./store";

/**
 * Sends a seat check, trip request or dated watch to the Trace team (Slack +
 * pointsRequests). Fire-and-forget from the UI's point of view: the request
 * is already saved on the device, and a failed send is logged, not shown.
 */
export function sendToTeam(kind: "seats" | "trip" | "watch", title: string, lines: string[], state: PointsState) {
  fetch("/api/requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      kind,
      title,
      lines,
      email: state.email,
      context: { airport: state.airport, travelers: state.travelers, balances: effectiveBalances(state) },
    }),
  })
    .then((r) => {
      if (!r.ok) console.error("[team request] failed", r.status);
    })
    .catch((e) => console.error("[team request]", e));
}
