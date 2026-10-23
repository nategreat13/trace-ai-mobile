import { fuzzyIncludes } from "./fuzzy";
import { WEST_ZIP3 } from "./zip3";

export interface LaunchAirport {
  code: string;
  city: string;
  state: string;
  st: string;
  lat: number;
  lng: number;
  /** Other words people type for it. */
  aliases: string[];
}

export const AIRPORTS: LaunchAirport[] = [
  { code: "LAX", city: "Los Angeles", state: "California", st: "ca", lat: 33.9416, lng: -118.4085, aliases: ["la", "socal", "so cal", "southern california", "santa monica", "long beach", "pasadena", "orange county", "inland empire", "hollywood"] },
  { code: "SFO", city: "San Francisco", state: "California", st: "ca", lat: 37.6213, lng: -122.379, aliases: ["bay area", "sf", "norcal"] },
  { code: "SAN", city: "San Diego", state: "California", st: "ca", lat: 32.7338, lng: -117.1933, aliases: ["socal", "la jolla", "carlsbad"] },
  { code: "SJC", city: "San Jose", state: "California", st: "ca", lat: 37.3639, lng: -121.9289, aliases: ["bay area", "silicon valley", "palo alto", "santa cruz"] },
  { code: "OAK", city: "Oakland", state: "California", st: "ca", lat: 37.7126, lng: -122.2197, aliases: ["bay area", "east bay", "berkeley"] },
  { code: "SMF", city: "Sacramento", state: "California", st: "ca", lat: 38.6951, lng: -121.5908, aliases: ["norcal", "davis", "reno", "tahoe"] },
  { code: "SEA", city: "Seattle", state: "Washington", st: "wa", lat: 47.4502, lng: -122.3088, aliases: ["seatac", "sea-tac", "tacoma", "bellevue", "pnw", "pacific northwest"] },
  { code: "PDX", city: "Portland", state: "Oregon", st: "or", lat: 45.5898, lng: -122.5951, aliases: ["pnw", "pacific northwest", "eugene", "salem", "vancouver wa"] },
  { code: "SLC", city: "Salt Lake City", state: "Utah", st: "ut", lat: 40.7899, lng: -111.9791, aliases: ["salt lake", "provo", "ogden", "park city"] },
  { code: "DEN", city: "Denver", state: "Colorado", st: "co", lat: 39.8561, lng: -104.6737, aliases: ["boulder", "colorado springs", "fort collins"] },
  { code: "PHX", city: "Phoenix", state: "Arizona", st: "az", lat: 33.4342, lng: -112.0116, aliases: ["scottsdale", "tempe", "mesa", "chandler", "valley of the sun"] },
  { code: "LAS", city: "Las Vegas", state: "Nevada", st: "nv", lat: 36.084, lng: -115.1537, aliases: ["vegas", "henderson"] },
  { code: "BOI", city: "Boise", state: "Idaho", st: "id", lat: 43.5644, lng: -116.2228, aliases: ["nampa", "meridian"] },
  { code: "ABQ", city: "Albuquerque", state: "New Mexico", st: "nm", lat: 35.0402, lng: -106.609, aliases: ["santa fe"] },
  { code: "TUS", city: "Tucson", state: "Arizona", st: "az", lat: 32.1161, lng: -110.941, aliases: [] },
];

export const airportByCode = (code: string) => AIRPORTS.find((a) => a.code === code);

export interface AirportMatch {
  airport: LaunchAirport;
  /** Shown under the city, e.g. "Utah" or "34 mi from 84101". */
  detail: string;
}

function miles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = Math.PI / 180;
  const x =
    Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lng2 - lng1) * r) / 2) ** 2;
  return 2 * 3958.8 * Math.asin(Math.sqrt(x));
}

/**
 * Live autocomplete for the home airport step. Matches codes, cities, states
 * and their abbreviations, common nicknames, and zip codes (by the 3-digit
 * prefix's centroid, nearest airports first). An empty result means the
 * place is outside the launch region.
 */
export function searchAirports(query: string, limit = 6): AirportMatch[] {
  const q = query.toLowerCase().trim().replace(/\s+/g, " ");
  if (!q) return [];

  if (/^\d{3,5}$/.test(q)) {
    const c = WEST_ZIP3[q.slice(0, 3)];
    if (!c) return [];
    return AIRPORTS.map((a) => ({ a, d: miles(c[0], c[1], a.lat, a.lng) }))
      .filter((x) => x.d <= 350)
      .sort((x, y) => x.d - y.d)
      .slice(0, 3)
      .map((x) => ({ airport: x.a, detail: `About ${Math.max(5, Math.round(x.d / 5) * 5)} mi from ${q}` }));
  }

  const scored: { a: LaunchAirport; score: number }[] = [];
  for (const a of AIRPORTS) {
    let score = 0;
    if (a.code.toLowerCase() === q) score = 100;
    else if (a.code.toLowerCase().startsWith(q)) score = 90;
    else if (q.length === 2 && a.st === q) score = 80;
    else if (a.city.toLowerCase().startsWith(q) || a.state.toLowerCase().startsWith(q)) score = 70;
    else if (a.aliases.some((x) => x === q || (q.length >= 3 && x.startsWith(q)))) score = 60;
    else if (q.length >= 4) {
      const tokens = `${a.city} ${a.state} ${a.aliases.join(" ")}`.toLowerCase().split(/[\s-]+/);
      if (q.split(" ").every((w) => fuzzyIncludes(tokens, w))) score = 40;
    }
    if (score) scored.push({ a, score });
  }
  // Typo matches only when nothing matched outright, so "utah" doesn't pull in "tahoe".
  const exact = scored.some((x) => x.score >= 60);
  return scored
    .filter((x) => !exact || x.score >= 60)
    .sort((x, y) => y.score - x.score)
    .slice(0, limit)
    .map(({ a }) => ({ airport: a, detail: a.state }));
}
