import { HOME_AIRPORTS, type Airport } from "../components/onboarding/AirportInput";

/**
 * Geography for the airport picker's dead end.
 *
 * 13% of everyone who made an account in the 1.8.0 cohort got stuck on the
 * airport screen — 58% of all onboarding drop-off, and the single largest
 * loss in the funnel. The cause was silence: the picker lists only the 23
 * serviced origins, and a search for anything else returned an empty array,
 * so no rows rendered, no message appeared, and Continue stayed grey. Ten of
 * those fourteen people bounced between the name and airport screens for
 * minutes; some came back hours or days later to try again.
 *
 * Two pieces fix that. `UNSERVED_AIRPORTS` lets the picker *recognise* a city
 * it can't serve — "BNA · Nashville, TN" reads as an answer, where an empty
 * list reads as a broken app. And coordinates on both tables let us point at
 * the nearest airport we do cover, which for a lot of people is a genuinely
 * usable alternative: Nashville is 3.5 hours from Atlanta, and plenty of
 * people already drive it.
 */
export interface GeoAirport extends Airport {
  lat: number;
  lng: number;
}

/** The 23 serviced origins, with coordinates. */
export const HOME_AIRPORT_COORDS: Record<string, { lat: number; lng: number }> = {
  ATL: { lat: 33.6407, lng: -84.4277 },
  AUS: { lat: 30.1975, lng: -97.6664 },
  BOS: { lat: 42.3656, lng: -71.0096 },
  CLT: { lat: 35.2144, lng: -80.9473 },
  DEN: { lat: 39.8561, lng: -104.6737 },
  DFW: { lat: 32.8998, lng: -97.0403 },
  DTW: { lat: 42.2162, lng: -83.3554 },
  EWR: { lat: 40.6895, lng: -74.1745 },
  FLL: { lat: 26.0742, lng: -80.1506 },
  IAH: { lat: 29.9902, lng: -95.3368 },
  JFK: { lat: 40.6413, lng: -73.7781 },
  LAS: { lat: 36.084, lng: -115.1537 },
  LAX: { lat: 33.9416, lng: -118.4085 },
  MCO: { lat: 28.4312, lng: -81.3081 },
  MIA: { lat: 25.7959, lng: -80.287 },
  MSP: { lat: 44.8848, lng: -93.2223 },
  ORD: { lat: 41.9742, lng: -87.9073 },
  PHL: { lat: 39.8729, lng: -75.2437 },
  PHX: { lat: 33.4352, lng: -112.0101 },
  SAN: { lat: 32.7338, lng: -117.1933 },
  SEA: { lat: 47.4502, lng: -122.3088 },
  SFO: { lat: 37.6213, lng: -122.379 },
  SLC: { lat: 40.7899, lng: -111.9791 },
};

/**
 * US airports Trace does NOT serve, so a search for one can be answered
 * rather than ignored. Ordered roughly by passenger volume — the cities most
 * likely to be typed come first, which also makes the list easy to audit
 * against whatever the waitlist starts reporting.
 */
export const UNSERVED_AIRPORTS: GeoAirport[] = [
  { code: "DCA", name: "Ronald Reagan Washington National", city: "Washington", state: "DC", lat: 38.8512, lng: -77.0402 },
  { code: "IAD", name: "Washington Dulles International", city: "Washington", state: "DC", lat: 38.9531, lng: -77.4565 },
  { code: "BWI", name: "Baltimore/Washington International", city: "Baltimore", state: "MD", lat: 39.1774, lng: -76.6684 },
  { code: "LGA", name: "LaGuardia", city: "New York", state: "NY", lat: 40.7769, lng: -73.874 },
  { code: "BNA", name: "Nashville International", city: "Nashville", state: "TN", lat: 36.1263, lng: -86.6774 },
  { code: "TPA", name: "Tampa International", city: "Tampa", state: "FL", lat: 27.9755, lng: -82.5332 },
  { code: "PDX", name: "Portland International", city: "Portland", state: "OR", lat: 45.5898, lng: -122.5951 },
  { code: "STL", name: "St. Louis Lambert International", city: "St. Louis", state: "MO", lat: 38.7487, lng: -90.37 },
  { code: "MCI", name: "Kansas City International", city: "Kansas City", state: "MO", lat: 39.2976, lng: -94.7139 },
  { code: "RDU", name: "Raleigh-Durham International", city: "Raleigh", state: "NC", lat: 35.8801, lng: -78.7880 },
  { code: "SAT", name: "San Antonio International", city: "San Antonio", state: "TX", lat: 29.5337, lng: -98.4698 },
  { code: "HNL", name: "Daniel K. Inouye International", city: "Honolulu", state: "HI", lat: 21.3187, lng: -157.9225 },
  { code: "SJC", name: "Norman Y. Mineta San Jose International", city: "San Jose", state: "CA", lat: 37.3639, lng: -121.9289 },
  { code: "OAK", name: "Oakland International", city: "Oakland", state: "CA", lat: 37.7213, lng: -122.2207 },
  { code: "SMF", name: "Sacramento International", city: "Sacramento", state: "CA", lat: 38.6954, lng: -121.5908 },
  { code: "SNA", name: "John Wayne", city: "Santa Ana", state: "CA", lat: 33.6757, lng: -117.8682 },
  { code: "ONT", name: "Ontario International", city: "Ontario", state: "CA", lat: 34.056, lng: -117.6012 },
  { code: "BUR", name: "Hollywood Burbank", city: "Burbank", state: "CA", lat: 34.2007, lng: -118.3587 },
  { code: "PIT", name: "Pittsburgh International", city: "Pittsburgh", state: "PA", lat: 40.4915, lng: -80.2329 },
  { code: "CLE", name: "Cleveland Hopkins International", city: "Cleveland", state: "OH", lat: 41.4117, lng: -81.8498 },
  { code: "CMH", name: "John Glenn Columbus International", city: "Columbus", state: "OH", lat: 39.998, lng: -82.8919 },
  { code: "CVG", name: "Cincinnati/Northern Kentucky International", city: "Cincinnati", state: "OH", lat: 39.0489, lng: -84.6678 },
  { code: "IND", name: "Indianapolis International", city: "Indianapolis", state: "IN", lat: 39.7169, lng: -86.2956 },
  { code: "MKE", name: "Milwaukee Mitchell International", city: "Milwaukee", state: "WI", lat: 42.9472, lng: -87.8966 },
  { code: "MSY", name: "Louis Armstrong New Orleans International", city: "New Orleans", state: "LA", lat: 29.9934, lng: -90.258 },
  { code: "JAX", name: "Jacksonville International", city: "Jacksonville", state: "FL", lat: 30.4941, lng: -81.6879 },
  { code: "RSW", name: "Southwest Florida International", city: "Fort Myers", state: "FL", lat: 26.5362, lng: -81.7552 },
  { code: "PBI", name: "Palm Beach International", city: "West Palm Beach", state: "FL", lat: 26.6832, lng: -80.0956 },
  { code: "SJU", name: "Luis Muñoz Marín International", city: "San Juan", state: "PR", lat: 18.4394, lng: -66.0018 },
  { code: "DAL", name: "Dallas Love Field", city: "Dallas", state: "TX", lat: 32.8471, lng: -96.8518 },
  { code: "HOU", name: "William P. Hobby", city: "Houston", state: "TX", lat: 29.6454, lng: -95.2789 },
  { code: "ELP", name: "El Paso International", city: "El Paso", state: "TX", lat: 31.8072, lng: -106.3778 },
  { code: "OKC", name: "Will Rogers World", city: "Oklahoma City", state: "OK", lat: 35.3931, lng: -97.6007 },
  { code: "TUL", name: "Tulsa International", city: "Tulsa", state: "OK", lat: 36.1984, lng: -95.8881 },
  { code: "ABQ", name: "Albuquerque International Sunport", city: "Albuquerque", state: "NM", lat: 35.0402, lng: -106.6091 },
  { code: "TUS", name: "Tucson International", city: "Tucson", state: "AZ", lat: 32.1161, lng: -110.9411 },
  { code: "BOI", name: "Boise Airport", city: "Boise", state: "ID", lat: 43.5644, lng: -116.2228 },
  { code: "RNO", name: "Reno-Tahoe International", city: "Reno", state: "NV", lat: 39.4991, lng: -119.7681 },
  { code: "GEG", name: "Spokane International", city: "Spokane", state: "WA", lat: 47.6199, lng: -117.5338 },
  { code: "ANC", name: "Ted Stevens Anchorage International", city: "Anchorage", state: "AK", lat: 61.1744, lng: -149.9964 },
  { code: "OMA", name: "Eppley Airfield", city: "Omaha", state: "NE", lat: 41.3032, lng: -95.8941 },
  { code: "MEM", name: "Memphis International", city: "Memphis", state: "TN", lat: 35.0424, lng: -89.9767 },
  { code: "BHM", name: "Birmingham-Shuttlesworth International", city: "Birmingham", state: "AL", lat: 33.5629, lng: -86.7535 },
  { code: "CHS", name: "Charleston International", city: "Charleston", state: "SC", lat: 32.8986, lng: -80.0405 },
  { code: "SAV", name: "Savannah/Hilton Head International", city: "Savannah", state: "GA", lat: 32.1276, lng: -81.2021 },
  { code: "GSO", name: "Piedmont Triad International", city: "Greensboro", state: "NC", lat: 36.0978, lng: -79.9373 },
  { code: "ORF", name: "Norfolk International", city: "Norfolk", state: "VA", lat: 36.8946, lng: -76.2012 },
  { code: "RIC", name: "Richmond International", city: "Richmond", state: "VA", lat: 37.5052, lng: -77.3197 },
  { code: "BUF", name: "Buffalo Niagara International", city: "Buffalo", state: "NY", lat: 42.9405, lng: -78.7322 },
  { code: "ROC", name: "Frederick Douglass Greater Rochester", city: "Rochester", state: "NY", lat: 43.1189, lng: -77.6724 },
  { code: "SYR", name: "Syracuse Hancock International", city: "Syracuse", state: "NY", lat: 43.1112, lng: -76.1063 },
  { code: "ALB", name: "Albany International", city: "Albany", state: "NY", lat: 42.7483, lng: -73.8017 },
  { code: "PVD", name: "Rhode Island T. F. Green International", city: "Providence", state: "RI", lat: 41.7267, lng: -71.4326 },
  { code: "MHT", name: "Manchester-Boston Regional", city: "Manchester", state: "NH", lat: 42.9326, lng: -71.4357 },
  { code: "BDL", name: "Bradley International", city: "Hartford", state: "CT", lat: 41.9389, lng: -72.6832 },
  { code: "DSM", name: "Des Moines International", city: "Des Moines", state: "IA", lat: 41.5341, lng: -93.6631 },
  { code: "MSN", name: "Dane County Regional", city: "Madison", state: "WI", lat: 43.1399, lng: -89.3375 },
  { code: "GRR", name: "Gerald R. Ford International", city: "Grand Rapids", state: "MI", lat: 42.8808, lng: -85.5228 },
  { code: "SDF", name: "Louisville Muhammad Ali International", city: "Louisville", state: "KY", lat: 38.1744, lng: -85.736 },
  { code: "LIT", name: "Bill and Hillary Clinton National", city: "Little Rock", state: "AR", lat: 34.7294, lng: -92.2243 },
  { code: "COS", name: "Colorado Springs", city: "Colorado Springs", state: "CO", lat: 38.8058, lng: -104.7008 },
  { code: "KOA", name: "Ellison Onizuka Kona International", city: "Kailua-Kona", state: "HI", lat: 19.7388, lng: -156.0456 },
  { code: "OGG", name: "Kahului", city: "Maui", state: "HI", lat: 20.8986, lng: -156.4305 },
];

const EARTH_MI = 3958.8;

/** Great-circle distance in miles. */
export function distanceMiles(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_MI * Math.asin(Math.sqrt(s));
}

export interface NearestResult {
  airport: Airport;
  miles: number;
}

/**
 * Past this, "closest airport we cover" stops being a suggestion and starts
 * being a joke — the honest nearest origin to Honolulu is SFO, 2,396 miles
 * across an ocean. Roughly a day's drive, which is the distance people
 * actually do trade for a cheap fare: Nashville drives to Atlanta, Raleigh to
 * Charlotte, Portland to Seattle. Beyond it we offer the waitlist alone.
 */
export const MAX_SUGGEST_MILES = 300;

/** The closest serviced origin to a point, or null if we have no coordinates. */
export function nearestServed(point: { lat: number; lng: number }): NearestResult | null {
  let best: NearestResult | null = null;
  for (const a of HOME_AIRPORTS) {
    const c = HOME_AIRPORT_COORDS[a.code];
    if (!c) continue;
    const miles = distanceMiles(point, c);
    if (!best || miles < best.miles) best = { airport: a, miles };
  }
  return best && best.miles <= MAX_SUGGEST_MILES ? best : null;
}

/**
 * Find an unserved airport matching a free-text query, so the picker can name
 * what the user typed instead of showing an empty list.
 */
export function findUnserved(query: string): GeoAirport[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return UNSERVED_AIRPORTS.filter(
    (a) =>
      a.code.toLowerCase().includes(q) ||
      a.city.toLowerCase().includes(q) ||
      a.state.toLowerCase() === q ||
      a.name.toLowerCase().includes(q),
  ).slice(0, 4);
}
