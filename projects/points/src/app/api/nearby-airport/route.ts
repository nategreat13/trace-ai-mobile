import { NextResponse } from "next/server";
import { AIRPORTS } from "@/lib/airports";

/** Farther than this from every airport we serve, we don't guess. */
const MAX_MILES = 120;

const miles = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const r = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return 3959 * 2 * Math.asin(Math.sqrt(a));
};

/**
 * The served airport nearest the visitor, from Vercel's IP location headers,
 * so the airport question can be one tap. Nothing is stored. Locally (no
 * headers) it answers null; ?lat=&lng= stands in for the headers in dev.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const dev = process.env.NODE_ENV !== "production";
  const lat = Number(req.headers.get("x-vercel-ip-latitude") ?? (dev ? url.searchParams.get("lat") : null));
  const lng = Number(req.headers.get("x-vercel-ip-longitude") ?? (dev ? url.searchParams.get("lng") : null));
  if (!lat || !lng) return NextResponse.json({ airport: null });
  const nearest = AIRPORTS.map((a) => ({ a, d: miles(lat, lng, a.lat, a.lng) })).sort((x, y) => x.d - y.d)[0];
  if (!nearest || nearest.d > MAX_MILES) return NextResponse.json({ airport: null });
  return NextResponse.json({ airport: { code: nearest.a.code, city: nearest.a.city, state: nearest.a.state } });
}
