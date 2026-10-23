"use client";

import { useEffect, useState } from "react";
import type { CashDeal } from "@/app/api/cash-deals/route";

export type { CashDeal };

/** Trace's cheapest cash fare per city from the home airport, for trips they're short on points for. */
export function useCashDeals(origin: string | null, cities: string[]): Record<string, CashDeal> {
  const [deals, setDeals] = useState<Record<string, CashDeal>>({});
  const key = cities.slice().sort().join(",");
  useEffect(() => {
    if (!origin || !key) return;
    let live = true;
    fetch(`/api/cash-deals?origin=${origin}&cities=${encodeURIComponent(key)}`)
      .then((r) => r.json())
      .then((j: { deals: Record<string, CashDeal> }) => live && setDeals(j.deals ?? {}))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [origin, key]);
  return deals;
}
