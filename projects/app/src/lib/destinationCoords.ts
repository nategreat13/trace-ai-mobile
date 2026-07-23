/**
 * Destination name → map coordinates.
 *
 * The deals API returns destinations as plain city-name strings
 * ("Salt Lake City", "São Paulo") with no airport code or lat/lng, so the
 * map has to resolve position from the name. This table covers the 144
 * distinct destinations the prod API returned across the 8 largest origin
 * airports on 2026-07-23 — the full serviced set at that time, not a sample.
 *
 * Coordinates are city centres (not airports) to a few decimal places —
 * the map plots cities, and an airport can sit 30-60km out of town, which
 * reads as a misplaced pin at country zoom.
 *
 * Adding a destination: add a lowercase, unaccented key. `lookupKey`
 * normalises the incoming name the same way, so "Zürich" and "zurich" both
 * resolve. Unknown destinations return null and are simply not pinned —
 * never guess a position, a wrong pin is worse than a missing one.
 */

export interface Coord {
  lat: number;
  lng: number;
}

/**
 * Normalise a destination name to a lookup key: lowercased, diacritics
 * stripped, punctuation dropped, whitespace collapsed. Keeps "st louis"
 * and "St. Louis" pointing at the same entry.
 */
export function lookupKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip combining accents
    .toLowerCase()
    .replace(/[.,']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Names the API returns in a form that doesn't match the natural city key.
 * Kept separate from COORDS so the main table stays a clean city list.
 */
const ALIASES: Record<string, string> = {
  "federal territory of kuala lumpur": "kuala lumpur",
  "washington dc": "washington",
  "mauritius island": "mauritius",
};

const COORDS: Record<string, Coord> = {
  // — North America (US) —
  asheville: { lat: 35.5951, lng: -82.5515 },
  atlanta: { lat: 33.749, lng: -84.388 },
  austin: { lat: 30.2672, lng: -97.7431 },
  baltimore: { lat: 39.2904, lng: -76.6122 },
  boston: { lat: 42.3601, lng: -71.0589 },
  charleston: { lat: 32.7765, lng: -79.9311 },
  charlotte: { lat: 35.2271, lng: -80.8431 },
  chicago: { lat: 41.8781, lng: -87.6298 },
  cincinnati: { lat: 39.1031, lng: -84.512 },
  "colorado springs": { lat: 38.8339, lng: -104.8214 },
  dallas: { lat: 32.7767, lng: -96.797 },
  denver: { lat: 39.7392, lng: -104.9903 },
  detroit: { lat: 42.3314, lng: -83.0458 },
  "fort lauderdale": { lat: 26.1224, lng: -80.1373 },
  honolulu: { lat: 21.3069, lng: -157.8583 },
  houston: { lat: 29.7604, lng: -95.3698 },
  jacksonville: { lat: 30.3322, lng: -81.6557 },
  "kansas city": { lat: 39.0997, lng: -94.5786 },
  kauai: { lat: 22.0964, lng: -159.5261 },
  "key west": { lat: 24.5551, lng: -81.78 },
  "las vegas": { lat: 36.1699, lng: -115.1398 },
  "los angeles": { lat: 34.0522, lng: -118.2437 },
  memphis: { lat: 35.1495, lng: -90.049 },
  miami: { lat: 25.7617, lng: -80.1918 },
  minneapolis: { lat: 44.9778, lng: -93.265 },
  nashville: { lat: 36.1627, lng: -86.7816 },
  "new orleans": { lat: 29.9511, lng: -90.0715 },
  "new york": { lat: 40.7128, lng: -74.006 },
  orlando: { lat: 28.5383, lng: -81.3792 },
  "palm springs": { lat: 33.8303, lng: -116.5453 },
  philadelphia: { lat: 39.9526, lng: -75.1652 },
  phoenix: { lat: 33.4484, lng: -112.074 },
  pittsburgh: { lat: 40.4406, lng: -79.9959 },
  portland: { lat: 45.5152, lng: -122.6784 },
  "salt lake city": { lat: 40.7608, lng: -111.891 },
  "san antonio": { lat: 29.4241, lng: -98.4936 },
  "san diego": { lat: 32.7157, lng: -117.1611 },
  "san francisco": { lat: 37.7749, lng: -122.4194 },
  "san juan": { lat: 18.4655, lng: -66.1057 },
  "santa fe": { lat: 35.687, lng: -105.9378 },
  seattle: { lat: 47.6062, lng: -122.3321 },
  "st louis": { lat: 38.627, lng: -90.1994 },
  tampa: { lat: 27.9506, lng: -82.4572 },
  tucson: { lat: 32.2226, lng: -110.9747 },
  washington: { lat: 38.9072, lng: -77.0369 },

  // — North America (Canada, Mexico, Caribbean, Central) —
  antigua: { lat: 17.1274, lng: -61.8468 },
  aruba: { lat: 12.5211, lng: -69.9683 },
  bermuda: { lat: 32.3078, lng: -64.7505 },
  calgary: { lat: 51.0447, lng: -114.0719 },
  cancun: { lat: 21.1619, lng: -86.8515 },
  cartagena: { lat: 10.391, lng: -75.4794 },
  cozumel: { lat: 20.4230, lng: -86.9223 },
  curacao: { lat: 12.1696, lng: -68.99 },
  dominica: { lat: 15.415, lng: -61.371 },
  grenada: { lat: 12.1165, lng: -61.679 },
  havana: { lat: 23.1136, lng: -82.3666 },
  "mexico city": { lat: 19.4326, lng: -99.1332 },
  montreal: { lat: 45.5017, lng: -73.5673 },
  oaxaca: { lat: 17.0732, lng: -96.7266 },
  "puerto vallarta": { lat: 20.6534, lng: -105.2253 },
  "punta cana": { lat: 18.582, lng: -68.4055 },
  "quebec city": { lat: 46.8139, lng: -71.208 },
  "saint lucia": { lat: 13.9094, lng: -60.9789 },
  toronto: { lat: 43.6532, lng: -79.3832 },

  // — South America —
  bogota: { lat: 4.711, lng: -74.0721 },
  "buenos aires": { lat: -34.6037, lng: -58.3816 },
  cusco: { lat: -13.5319, lng: -71.9675 },
  "easter island": { lat: -27.1127, lng: -109.3497 },
  lima: { lat: -12.0464, lng: -77.0428 },
  medellin: { lat: 6.2476, lng: -75.5658 },
  quito: { lat: -0.1807, lng: -78.4678 },
  "rio de janeiro": { lat: -22.9068, lng: -43.1729 },
  santiago: { lat: -33.4489, lng: -70.6693 },
  "sao paulo": { lat: -23.5505, lng: -46.6333 },

  // — Europe —
  amsterdam: { lat: 52.3676, lng: 4.9041 },
  athens: { lat: 37.9838, lng: 23.7275 },
  barcelona: { lat: 41.3851, lng: 2.1734 },
  berlin: { lat: 52.52, lng: 13.405 },
  bordeaux: { lat: 44.8378, lng: -0.5792 },
  budapest: { lat: 47.4979, lng: 19.0402 },
  copenhagen: { lat: 55.6761, lng: 12.5683 },
  dublin: { lat: 53.3498, lng: -6.2603 },
  dubrovnik: { lat: 42.6507, lng: 18.0944 },
  edinburgh: { lat: 55.9533, lng: -3.1883 },
  florence: { lat: 43.7696, lng: 11.2558 },
  glasgow: { lat: 55.8642, lng: -4.2518 },
  helsinki: { lat: 60.1699, lng: 24.9384 },
  ibiza: { lat: 38.9067, lng: 1.4206 },
  krakow: { lat: 50.0647, lng: 19.945 },
  lisbon: { lat: 38.7223, lng: -9.1393 },
  luxembourg: { lat: 49.6116, lng: 6.1319 },
  madrid: { lat: 40.4168, lng: -3.7038 },
  malta: { lat: 35.8989, lng: 14.5146 },
  manchester: { lat: 53.4808, lng: -2.2426 },
  milan: { lat: 45.4642, lng: 9.19 },
  munich: { lat: 48.1351, lng: 11.582 },
  mykonos: { lat: 37.4467, lng: 25.3289 },
  naples: { lat: 40.8518, lng: 14.2681 },
  nice: { lat: 43.7102, lng: 7.262 },
  oslo: { lat: 59.9139, lng: 10.7522 },
  paris: { lat: 48.8566, lng: 2.3522 },
  porto: { lat: 41.1579, lng: -8.6291 },
  prague: { lat: 50.0755, lng: 14.4378 },
  reykjavik: { lat: 64.1466, lng: -21.9426 },
  rome: { lat: 41.9028, lng: 12.4964 },
  santorini: { lat: 36.3932, lng: 25.4615 },
  seville: { lat: 37.3891, lng: -5.9845 },
  stockholm: { lat: 59.3293, lng: 18.0686 },
  venice: { lat: 45.4408, lng: 12.3155 },
  vienna: { lat: 48.2082, lng: 16.3738 },
  zurich: { lat: 47.3769, lng: 8.5417 },

  // — Africa & Middle East —
  "abu dhabi": { lat: 24.4539, lng: 54.3773 },
  cairo: { lat: 30.0444, lng: 31.2357 },
  "cape town": { lat: -33.9249, lng: 18.4241 },
  dubai: { lat: 25.2048, lng: 55.2708 },
  marrakesh: { lat: 31.6295, lng: -7.9811 },
  mauritius: { lat: -20.3484, lng: 57.5522 },

  // — Asia —
  bangkok: { lat: 13.7563, lng: 100.5018 },
  beijing: { lat: 39.9042, lng: 116.4074 },
  bengaluru: { lat: 12.9716, lng: 77.5946 },
  chennai: { lat: 13.0827, lng: 80.2707 },
  "chiang mai": { lat: 18.7883, lng: 98.9853 },
  goa: { lat: 15.2993, lng: 74.124 },
  hanoi: { lat: 21.0285, lng: 105.8542 },
  "ho chi minh city": { lat: 10.8231, lng: 106.6297 },
  "hong kong": { lat: 22.3193, lng: 114.1694 },
  jaipur: { lat: 26.9124, lng: 75.7873 },
  kolkata: { lat: 22.5726, lng: 88.3639 },
  "kuala lumpur": { lat: 3.139, lng: 101.6869 },
  mumbai: { lat: 19.076, lng: 72.8777 },
  "new delhi": { lat: 28.6139, lng: 77.209 },
  osaka: { lat: 34.6937, lng: 135.5023 },
  phuket: { lat: 7.8804, lng: 98.3923 },
  seoul: { lat: 37.5665, lng: 126.978 },
  shanghai: { lat: 31.2304, lng: 121.4737 },
  singapore: { lat: 1.3521, lng: 103.8198 },
  tokyo: { lat: 35.6762, lng: 139.6503 },
  udaipur: { lat: 24.5854, lng: 73.7125 },

  // — Oceania —
  adelaide: { lat: -34.9285, lng: 138.6007 },
  auckland: { lat: -36.8485, lng: 174.7633 },
  brisbane: { lat: -27.4698, lng: 153.0251 },
  melbourne: { lat: -37.8136, lng: 144.9631 },
  perth: { lat: -31.9505, lng: 115.8605 },
  sydney: { lat: -33.8688, lng: 151.2093 },
};

/**
 * Resolve a destination name to coordinates. Returns null for anything not
 * in the table — callers should skip the pin rather than fall back to a
 * default position.
 */
export function coordsForDestination(name: string | null | undefined): Coord | null {
  if (!name) return null;
  const key = lookupKey(name);
  return COORDS[ALIASES[key] ?? key] ?? null;
}

/** Exposed for the coverage test — not needed at runtime. */
export const __COORDS_FOR_TEST = COORDS;
