import type { WorldAirport } from "./worldAirports";

/** A city someone might fly to, with its airports. */
export interface WorldPlace {
  city: string;
  /** State or province for US, CA, AU, MX; empty elsewhere. */
  area: string;
  country: string;
  codes: string[];
  lat: number;
  lng: number;
}

export const placeLabel = (p: WorldPlace) =>
  p.country === "United States" ? `${p.city}, ${p.area}` : p.area ? `${p.city}, ${p.area}, ${p.country}` : `${p.city}, ${p.country}`;

const norm = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

export function miles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = Math.PI / 180;
  const x =
    Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lng2 - lng1) * r) / 2) ** 2;
  return 2 * 3958.8 * Math.asin(Math.sqrt(x));
}

/**
 * Popular places with no airport of their own, mapped to the airports people
 * actually fly into (first one is the main choice).
 */
export const PLACE_ALIASES: Record<string, string[]> = {
  Kyoto: ["KIX", "ITM"],
  Nara: ["KIX", "ITM"],
  Hakone: ["HND", "NRT"],
  "Mount Fuji": ["HND", "NRT"],
  Niseko: ["CTS"],
  Whistler: ["YVR"],
  "Lake Louise": ["YYC"],
  Napa: ["SFO", "OAK", "STS"],
  "Big Sur": ["MRY", "SJC"],
  "Lake Tahoe": ["RNO", "SMF"],
  Yosemite: ["FAT", "SFO"],
  "Park City": ["SLC"],
  Zion: ["LAS", "SGU"],
  "Grand Canyon": ["FLG", "PHX", "LAS"],
  Sedona: ["PHX", "FLG"],
  Yellowstone: ["BZN", "JAC", "IDA"],
  "Jackson Hole": ["JAC"],
  Aspen: ["ASE", "DEN"],
  Vail: ["EGE", "DEN"],
  Tulum: ["TQO", "CUN"],
  "Playa del Carmen": ["CUN"],
  "Machu Picchu": ["CUZ"],
  Patagonia: ["FTE", "PUQ"],
  Galapagos: ["GPS", "SCY"],
  "Amalfi Coast": ["NAP"],
  Positano: ["NAP"],
  Tuscany: ["FLR", "PSA"],
  "Cinque Terre": ["PSA", "GOA"],
  "Lake Como": ["MXP", "LIN", "BGY"],
  Provence: ["MRS", "AVN"],
  Normandy: ["CDG"],
  Cotswolds: ["LHR", "BHX"],
  "Scottish Highlands": ["INV"],
  Zermatt: ["GVA", "ZRH"],
  "Swiss Alps": ["ZRH", "GVA"],
  Iceland: ["KEF"],
  Maldives: ["MLE"],
  "Bora Bora": ["BOB", "PPT"],
  Tahiti: ["PPT"],
  Seychelles: ["SEZ"],
  Ubud: ["DPS"],
};

/**
 * The airport most travelers mean when they search a country. The dataset marks
 * most international airports "large", so without this "Peru" would list
 * Arequipa before Lima.
 */
const COUNTRY_HUBS = new Set([
  "LIM", "HND", "NRT", "FCO", "CDG", "MAD", "BCN", "MEX", "GRU", "EZE", "SCL", "BOG", "SJO", "PTY", "UIO",
  "BKK", "SGN", "HAN", "CGK", "DPS", "MNL", "KUL", "SIN", "SYD", "AKL", "ATH", "LIS", "FRA", "MUC", "LHR",
  "DUB", "AMS", "ZRH", "VIE", "IST", "CAI", "CMN", "JNB", "CPT", "NBO", "DEL", "BOM", "PEK", "PVG", "ICN",
  "YYZ", "YVR", "KEF", "DXB", "DOH", "TLV", "ZAG", "DBV", "PRG", "BUD", "WAW", "CPH", "ARN", "OSL", "HEL",
  "BRU", "MLE", "PPT", "NAN", "HKG", "TPE", "SJU", "PUJ", "MBJ", "NAS", "AUA", "CUN",
]);

const words = (t: string) => norm(t).split(/[^a-z0-9]+/).filter(Boolean);
const wordStarts = (t: string, q: string) => words(t).some((w) => w.startsWith(q));

/**
 * Finds cities in the world airport list by city, airport code, airport name,
 * state or country, plus a few famous places with no airport of their own. A
 * country or state query returns its main hubs first.
 */
export function searchWorld(all: WorldAirport[], query: string, limit = 5): WorldPlace[] {
  const q = norm(query);
  if (q.length < 2) return [];
  const byCode = new Map(all.map((a) => [a[0], a]));
  const out: WorldPlace[] = [];

  for (const [place, codes] of Object.entries(PLACE_ALIASES)) {
    if (!norm(place).startsWith(q)) continue;
    const main = byCode.get(codes[0]);
    if (main) out.push({ city: place, area: "", country: main[3], codes, lat: main[4], lng: main[5] });
  }

  const scored: { a: WorldAirport; score: number }[] = [];
  for (const a of all) {
    const [code, city, area, country, , , large, name] = a;
    const c = norm(city);
    let score = 0;
    if (q.length === 3 && code.toLowerCase() === q) score = 100;
    else if (c === q) score = 90;
    else if (norm(country) === q || norm(area) === q) score = 70 + large * 15 + (COUNTRY_HUBS.has(code) ? 30 : 0);
    else if (c.startsWith(q)) score = 75;
    else if (q.length >= 4 && (wordStarts(city, q) || wordStarts(name, q))) score = 50;
    if (score) scored.push({ a, score: score + large * 5 });
  }
  scored.sort((x, y) => y.score - x.score);

  // One row per city, airports merged.
  const byCity = new Map<string, WorldPlace>();
  for (const { a } of scored) {
    const [code, city, area, country, lat, lng] = a;
    const key = `${city}|${country}`;
    const hit = byCity.get(key);
    if (hit) {
      if (!hit.codes.includes(code)) hit.codes.push(code);
    } else if (byCity.size + out.length < limit) {
      byCity.set(key, { city, area, country, codes: [code], lat, lng });
    }
  }
  return [...out, ...byCity.values()].slice(0, limit);
}

/** Coordinates for an airport code, used to place the destinations we price. */
export function coordsFor(all: WorldAirport[], code: string): [number, number] | null {
  const a = all.find((x) => x[0] === code);
  return a ? [a[4], a[5]] : null;
}
