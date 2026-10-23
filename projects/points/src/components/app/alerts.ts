"use client";

import { useMemo } from "react";
import { CARD_OFFERS, PROGRAMS } from "@/engine/data";
import { activeBonuses } from "@/engine/engine";
import { money, num, shortDate } from "@/lib/format";
import { useDeck, usePoints } from "@/lib/store";
import { ICONS } from "../ui";

export interface Alert {
  id: string;
  icon: string;
  tone: "live" | "soon" | "info";
  tag: string;
  title: string;
  body: string;
  action?: { label: string; href: string };
}

/**
 * The alert feed, built from what the user holds and the current seed data.
 * Seat drops need real availability, so they wait for the verification queue.
 */
export function useAlerts(): { alerts: Alert[]; unread: number } {
  const { state } = usePoints();
  const { deck, near, values, input } = useDeck();
  return useMemo(() => {
    const held = new Set(state.progs);
    const out: Alert[] = [];
    const tripUsing = (program: string) => deck.find((r) => r.best.option.program === program);

    for (const b of activeBonuses(input.asOf)) {
      if (!held.has(b.from)) continue;
      const t = tripUsing(b.to);
      out.push({
        id: `bonus-${b.from}-${b.to}`,
        icon: ICONS.bonus,
        tone: "live",
        tag: "Live now",
        title: `${PROGRAMS[b.from].short} → ${b.toName} +${b.pct}%`,
        body: `Through ${shortDate(b.endsOn)}. Every 1,000 ${PROGRAMS[b.from].short} points becomes ${num(1000 * (1 + b.pct / 100))} miles.`,
        action: t ? { label: `See ${t.trip.city}`, href: `/trip/${t.trip.id}` } : undefined,
      });
    }

    if (state.airport === "SEA" && input.asOf <= "2026-10-31") {
      out.push({
        id: "sea-fb-promo",
        icon: ICONS.star,
        tone: "live",
        tag: "Live now",
        title: "Seattle → Paris business from 45,000",
        body: "Flying Blue promo pricing. Book by Oct 31.",
        action: { label: "See Paris", href: "/trip/paris-j" },
      });
    }

    for (const r of near.filter((x) => x.suggestion?.closesGap).slice(0, 2)) {
      const c = r.suggestion!.card;
      out.push({
        id: `gap-${r.trip.id}`,
        icon: ICONS.wallet,
        tone: "info",
        tag: "Close the gap",
        title: `${num(r.gap)} points from ${r.trip.city}`,
        body: `${c.name} pays ${c.upTo ? "up to " : ""}${num(c.bonus)} after ${c.spend}. That covers it.`,
        action: { label: "See trip", href: `/trip/${r.trip.id}` },
      });
    }

    for (const c of CARD_OFFERS.filter((o) => held.has(o.currency) && o.tag?.startsWith("Ends"))) {
      out.push({
        id: `offer-${c.id}`,
        icon: ICONS.clock,
        tone: "soon",
        tag: c.tag!,
        title: `${c.name}: ${c.upTo ? "up to " : ""}${num(c.bonus)} bonus`,
        body: `After ${c.spend}. Card offers change often.`,
      });
    }

    if (held.has("sw")) {
      out.push({
        id: "sw-companion-2027",
        icon: ICONS.shield,
        tone: "info",
        tag: "Heads up",
        title: "Southwest Companion Pass rules change Jan 1, 2027",
        body: "Plan bookings that depend on it before then.",
      });
    }

    for (const r of state.requests) {
      out.push({
        id: `request-${r.id}`,
        icon: ICONS.pin,
        tone: "info",
        tag: "Requested",
        title: `We're pricing ${r.destination} for you`,
        body: "A Trace analyst is checking it in your points. You'll hear back here, usually within 24 hours.",
        action: { label: "See request", href: "/trips" },
      });
    }

    if (values.bankCash > 0) {
      out.push({
        id: "dont-cash-out",
        icon: ICONS.shield,
        tone: "info",
        tag: "Tip",
        title: "Don't cash out",
        body: `Your card points are worth about ${money(values.bankCash)} as cash, or about ${money(values.bankFlights)} as flights.`,
      });
    }

    // After the first visit, only requests made since then count as new.
    const readAt = state.alertsReadAt;
    const unread = readAt ? state.requests.filter((r) => r.createdAt > readAt).length : out.length;
    return { alerts: out, unread };
  }, [state.progs, state.airport, state.alertsReadAt, state.requests, deck, near, values, input.asOf]);
}
