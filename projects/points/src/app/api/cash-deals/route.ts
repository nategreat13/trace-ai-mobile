import { NextResponse } from "next/server";

/**
 * Trace's cash flight deals for one home airport, from the same public feed
 * the Trace app uses, reduced to the cheapest deal per destination we price.
 * Cached for an hour.
 */
const FEED = "https://api-7l7vojyykq-uc.a.run.app/deals";

/** The feed covers some launch airports; the rest borrow the closest one that's covered. */
const FEED_ORIGIN: Record<string, string> = {
  OAK: "SFO",
  SJC: "SFO",
  SMF: "SFO",
  PDX: "SEA",
  BOI: "SLC",
  ABQ: "DEN",
  TUS: "PHX",
};

/** Our destination names → the feed's, where they differ. */
const FEED_CITY: Record<string, string> = {
  Banff: "Calgary",
  "Costa Rica": "San José",
};

interface FeedDeal {
  destination?: string;
  dealPriceUSD?: number | string;
  normalPriceUSD?: number | string;
  monthType?: string;
  url?: string;
  airlines?: string;
  createdAtMS?: number;
  domesticOrInternational?: string;
}

export interface CashDeal {
  price: number;
  normal: number;
  month: string;
  url: string;
  airlines: string;
  foundAt: number;
  origin: string;
}

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const home = (params.get("origin") ?? "").toUpperCase();
  const cities = (params.get("cities") ?? "").split(",").filter(Boolean);
  if (!/^[A-Z]{3}$/.test(home)) return NextResponse.json({ deals: {} });
  const origin = FEED_ORIGIN[home] ?? home;
  try {
    const r = await fetch(`${FEED}/${origin}?limit=500`, { next: { revalidate: 3600 } });
    const feed = (await r.json()) as FeedDeal[];
    const deals: Record<string, CashDeal> = {};
    for (const city of cities) {
      const name = FEED_CITY[city] ?? city;
      const matches = (Array.isArray(feed) ? feed : []).filter(
        (d) => d.destination === name && (city !== "Costa Rica" || d.domesticOrInternational === "International"),
      );
      const best = matches.sort((a, b) => Number(a.dealPriceUSD) - Number(b.dealPriceUSD))[0];
      if (best?.url && Number(best.dealPriceUSD) > 0) {
        deals[city] = {
          price: Math.round(Number(best.dealPriceUSD)),
          normal: Math.round(Number(best.normalPriceUSD) || 0),
          month: best.monthType ?? "",
          url: best.url,
          airlines: best.airlines ?? "",
          foundAt: best.createdAtMS ?? Date.now(),
          origin,
        };
      }
    }
    return NextResponse.json({ deals });
  } catch {
    return NextResponse.json({ deals: {} });
  }
}
