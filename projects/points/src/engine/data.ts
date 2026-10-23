import type {
  CardOffer,
  Program,
  ProgramId,
  TransferBonus,
  TransferPartner,
  TripDef,
} from "./types";

/**
 * Seed data, researched Oct 21, 2026.
 *
 * Award prices are typical saver prices per person, not live availability.
 * Card offers and transfer bonuses change often; refresh weekly (see README).
 * Inland adjustments are estimates and still need verifying.
 */
export const DATA_AS_OF = "2026-10-21";

export const LAUNCH_AIRPORTS = [
  "LAX", "SFO", "SAN", "SJC", "OAK", "SMF", "SEA", "PDX",
  "SLC", "DEN", "PHX", "LAS", "BOI", "ABQ", "TUS",
] as const;

/** Award charts often price these higher than the coast. */
export const INLAND = ["SLC", "DEN", "PHX", "LAS", "BOI", "ABQ", "TUS"];
export const NORTHWEST = ["SEA", "PDX", "BOI"];

export const PROGRAMS: Record<ProgramId, Program> = {
  amex: { id: "amex", name: "Amex Membership Rewards", short: "Amex", kind: "bank", badge: "MR", badgeColor: "#3B5B9A", earnedOn: "Gold, Platinum, Green", typical: 60000, sliderMax: 300000, flightCents: 1.8, cashCents: 0.6, transferUrl: "https://global.americanexpress.com/rewards", logo: "/logos/amex.png" },
  chase: { id: "chase", name: "Chase Ultimate Rewards", short: "Chase", kind: "bank", badge: "UR", badgeColor: "#2F6F8F", earnedOn: "Sapphire, Freedom, Ink", typical: 50000, sliderMax: 300000, flightCents: 1.8, cashCents: 1.0, transferUrl: "https://ultimaterewards.chase.com", logo: "/logos/chase.png" },
  c1: { id: "c1", name: "Capital One Miles", short: "Capital One", kind: "bank", badge: "C1", badgeColor: "#8A4B5C", earnedOn: "Venture, Venture X", typical: 50000, sliderMax: 300000, flightCents: 1.6, cashCents: 0.5, transferUrl: "https://www.capitalone.com", logo: "/logos/c1.png" },
  citi: { id: "citi", name: "Citi ThankYou Points", short: "Citi", kind: "bank", badge: "TY", badgeColor: "#2E7D6B", earnedOn: "Strata Premier, Strata Elite", typical: 40000, sliderMax: 300000, flightCents: 1.6, cashCents: 1.0, transferUrl: "https://www.thankyou.com", logo: "/logos/citi.png" },
  bilt: { id: "bilt", name: "Bilt Points", short: "Bilt", kind: "bank", badge: "BLT", badgeColor: "#4A4A58", earnedOn: "Blue, Obsidian, Palladium", typical: 30000, sliderMax: 300000, flightCents: 1.8, cashCents: 0.55, transferUrl: "https://www.biltrewards.com", logo: "/logos/bilt.png" },
  delta: { id: "delta", name: "Delta SkyMiles", short: "Delta", kind: "airline", badge: "DL", badgeColor: "#7A3E3E", earnedOn: "Delta SkyMiles Amex cards", typical: 40000, sliderMax: 250000, flightCents: 1.2, awardProgram: "delta", transferUrl: "https://www.delta.com", logo: "/logos/delta.png" },
  united: { id: "united", name: "United MileagePlus", short: "United", kind: "airline", badge: "UA", badgeColor: "#34508A", earnedOn: "Explorer, Quest, Club", typical: 35000, sliderMax: 250000, flightCents: 1.2, awardProgram: "united", transferUrl: "https://www.united.com", logo: "/logos/united.png" },
  atmos: { id: "atmos", name: "Alaska Atmos Rewards", short: "Alaska Atmos", kind: "airline", badge: "AS", badgeColor: "#1F6A73", earnedOn: "Summit, Ascent", typical: 30000, sliderMax: 250000, flightCents: 1.4, awardProgram: "atmos", transferUrl: "https://www.alaskaair.com", logo: "/logos/atmos.png" },
  aa: { id: "aa", name: "American AAdvantage", short: "American", kind: "airline", badge: "AA", badgeColor: "#5A5F6B", earnedOn: "Citi AAdvantage cards", typical: 35000, sliderMax: 250000, flightCents: 1.7, awardProgram: "aa", transferUrl: "https://www.aa.com", logo: "/logos/aa.png" },
  sw: { id: "sw", name: "Southwest Rapid Rewards", short: "Southwest", kind: "airline", badge: "WN", badgeColor: "#8A6A1F", earnedOn: "Rapid Rewards Plus, Priority", typical: 30000, sliderMax: 250000, flightCents: 1.4, awardProgram: "sw", transferUrl: "https://www.southwest.com", logo: "/logos/sw.png" },
};

export const BANK_IDS: ProgramId[] = ["amex", "chase", "c1", "citi", "bilt"];
export const AIRLINE_IDS: ProgramId[] = ["delta", "united", "atmos", "aa", "sw"];

/** 1:1 unless noted. An airline's own members are listed as a 1:1 source. */
export const PARTNERS: TransferPartner[] = [
  { program: "avios", name: "British Airways Avios", short: "Avios", searchUrl: "https://www.britishairways.com", sources: [{ from: "amex", ratio: 1 }, { from: "chase", ratio: 1 }, { from: "c1", ratio: 1 }, { from: "bilt", ratio: 1 }] },
  { program: "aeroplan", name: "Air Canada Aeroplan", short: "Aeroplan", searchUrl: "https://www.aircanada.com/aeroplan", sources: [{ from: "amex", ratio: 1 }, { from: "chase", ratio: 1 }, { from: "c1", ratio: 1 }, { from: "bilt", ratio: 1 }] },
  { program: "virgin", name: "Virgin Atlantic Flying Club", short: "Virgin", searchUrl: "https://www.virginatlantic.com", sources: [{ from: "amex", ratio: 1 }, { from: "chase", ratio: 1 }, { from: "c1", ratio: 1 }, { from: "citi", ratio: 1 }, { from: "bilt", ratio: 1 }] },
  { program: "flyingblue", name: "Air France-KLM Flying Blue", short: "Flying Blue", searchUrl: "https://www.flyingblue.com", sources: [{ from: "amex", ratio: 1 }, { from: "chase", ratio: 1 }, { from: "c1", ratio: 1 }, { from: "citi", ratio: 1 }, { from: "bilt", ratio: 1 }] },
  { program: "turkish", name: "Turkish Miles&Smiles", short: "Turkish", searchUrl: "https://www.turkishairlines.com", sources: [{ from: "citi", ratio: 1 }, { from: "c1", ratio: 1 }, { from: "bilt", ratio: 1 }] },
  { program: "aa", name: "American AAdvantage", short: "AAdvantage", searchUrl: "https://www.aa.com", sources: [{ from: "aa", ratio: 1 }, { from: "citi", ratio: 1 }] },
  { program: "atmos", name: "Alaska Atmos Rewards", short: "Atmos", searchUrl: "https://www.alaskaair.com", sources: [{ from: "atmos", ratio: 1 }, { from: "bilt", ratio: 1 }] },
  { program: "delta", name: "Delta SkyMiles", short: "SkyMiles", dynamic: true, searchUrl: "https://www.delta.com", sources: [{ from: "delta", ratio: 1 }, { from: "amex", ratio: 1 }] },
  { program: "united", name: "United MileagePlus", short: "MileagePlus", dynamic: true, searchUrl: "https://www.united.com", sources: [{ from: "united", ratio: 1 }, { from: "chase", ratio: 1 }, { from: "bilt", ratio: 1 }] },
  { program: "sw", name: "Southwest Rapid Rewards", short: "Rapid Rewards", dynamic: true, searchUrl: "https://www.southwest.com", sources: [{ from: "sw", ratio: 1 }, { from: "chase", ratio: 1 }, { from: "bilt", ratio: 1 }] },
  { program: "kris", name: "Singapore KrisFlyer", short: "KrisFlyer", searchUrl: "https://www.singaporeair.com", sources: [{ from: "amex", ratio: 1 }, { from: "chase", ratio: 1 }, { from: "c1", ratio: 1 }, { from: "citi", ratio: 1 }] },
];

export const BONUSES: TransferBonus[] = [
  { from: "amex", to: "flyingblue", toName: "Flying Blue", pct: 25, endsOn: "2026-10-31" },
  { from: "c1", to: "avios", toName: "British Airways Avios", pct: 20, endsOn: "2026-10-31" },
  { from: "citi", to: "qatar", toName: "Qatar Avios", pct: 35, endsOn: "2026-10-31" },
  { from: "citi", to: "lifemiles", toName: "Avianca LifeMiles", pct: 25, endsOn: "2026-10-24" },
];

export const CARD_OFFERS_AS_OF = "2026-10-21";

export const CARD_OFFERS: CardOffer[] = [
  { id: "csp", name: "Chase Sapphire Preferred", currency: "chase", bonus: 75000, spend: "$5,000 in 3 months", fee: "$95/yr", applyUrl: "https://creditcards.chase.com/rewards-credit-cards/sapphire/preferred" },
  { id: "amex-gold", name: "Amex Gold", currency: "amex", bonus: 100000, upTo: true, spend: "$8,000 in 6 months", fee: "$325/yr", applyUrl: "https://www.americanexpress.com/us/credit-cards/card/gold-card/" },
  { id: "venture", name: "Capital One Venture", currency: "c1", bonus: 75000, extra: " + $300 travel credit", spend: "$4,000 in 3 months", fee: "$95/yr", tag: "Limited time", applyUrl: "https://www.capitalone.com/credit-cards/venture/" },
  { id: "strata", name: "Citi Strata Premier", currency: "citi", bonus: 60000, spend: "$4,000 in 3 months", fee: "$95/yr", applyUrl: "https://www.citi.com/credit-cards/citi-strata-premier-credit-card" },
  { id: "delta-gold", name: "Delta SkyMiles Gold Amex", currency: "delta", bonus: 80000, upTo: true, spend: "$3,000 in 6 months", fee: "$0 first year", tag: "Ends Nov 4", applyUrl: "https://www.americanexpress.com/us/credit-cards/card/delta-skymiles-gold-american-express-card/" },
  { id: "united-explorer", name: "United Explorer", currency: "united", bonus: 70000, spend: "$3,000 in 3 months", fee: "$0 first year", tag: "Elevated offer", applyUrl: "https://creditcards.chase.com/travel-credit-cards/united/united-explorer" },
  { id: "atmos-summit", name: "Atmos Rewards Summit", currency: "atmos", bonus: 100000, extra: " + 25k companion award", spend: "$6,000 in 90 days", fee: "$395/yr", tag: "Elevated offer", applyUrl: "https://www.alaskaair.com/atmosrewards/content/credit-cards/visa-summit" },
  { id: "aa-plat", name: "Citi AAdvantage Platinum Select", currency: "aa", bonus: 80000, spend: "$3,500 in 4 months", fee: "$0 first year", tag: "Limited time", applyUrl: "https://www.citi.com/credit-cards/citi-aadvantage-platinum-select-world-elite-mastercard" },
  { id: "sw-plus", name: "Southwest Rapid Rewards Plus", currency: "sw", bonus: 50000, spend: "$1,000 in 3 months", fee: "$99/yr", applyUrl: "https://creditcards.chase.com/travel-credit-cards/southwest/plus" },
];

/** The weekend trip changes with the home airport. */
export function hopFor(origin: string): { city: string; code: string } {
  if (INLAND.includes(origin)) return { city: "Los Angeles", code: "LAX" };
  if (origin === "LAX" || origin === "SAN") return { city: "San Francisco", code: "SFO" };
  return { city: "Las Vegas", code: "LAS" };
}

export function tripDefs(origin: string): TripDef[] {
  const hop = hopFor(origin);
  const researched: TripDef[] = [
    {
      id: "hop", city: hop.city, code: hop.code, route: "Round trip", cabin: "Economy", cash: 160, taxes: 11, kind: "city", international: false, region: "USA", source: "brief",
      options: [
        { program: "atmos", points: 9000, notFrom: NORTHWEST, on: "American or Alaska", note: "Atmos prices short partner flights from 4,500 each way." },
        { program: "aeroplan", points: 12000, on: "United" },
        { program: "avios", points: 16500, on: "American or Alaska" },
        { program: "sw", points: 10000, on: "Southwest" },
        { program: "united", points: 12000, on: "United" },
        { program: "delta", points: 15000, on: "Delta" },
        { program: "aa", points: 15000, on: "American" },
      ],
    },
    {
      id: "cabo", city: "Los Cabos", code: "SJD", route: "Round trip", cabin: "Economy", cash: 380, taxes: 70, kind: "beach", international: true, region: "Mexico & Caribbean", source: "brief",
      options: [
        { program: "aeroplan", points: 20000, byOrigin: [{ origins: NORTHWEST, points: 25000 }], on: "United" },
        { program: "avios", points: 22000, byOrigin: [{ origins: NORTHWEST, points: 29000 }], on: "American or Alaska" },
        { program: "aa", points: 25000, on: "American" },
        { program: "united", points: 24000, on: "United" },
        { program: "sw", points: 22000, on: "Southwest" },
        { program: "delta", points: 30000, on: "Delta" },
      ],
    },
    {
      id: "cancun", city: "Cancún", code: "CUN", route: "Round trip", cabin: "Economy", cash: 450, taxes: 75, kind: "beach", international: true, region: "Mexico & Caribbean", source: "brief",
      options: [
        { program: "aeroplan", points: 25000, on: "United" },
        { program: "aa", points: 25000, on: "American" },
        { program: "avios", points: 32000, on: "American or Alaska" },
        { program: "sw", points: 28000, on: "Southwest" },
        { program: "united", points: 30000, on: "United" },
        { program: "delta", points: 35000, on: "Delta" },
      ],
    },
    {
      id: "maui", city: "Maui", code: "OGG", route: "Round trip", cabin: "Economy", cash: 380, taxes: 11, kind: "beach", international: false, region: "Hawaii", source: "brief",
      options: [
        { program: "aeroplan", points: 25000, byOrigin: [{ origins: INLAND, points: 35000 }], on: "United" },
        { program: "sw", points: 26000, on: "Southwest" },
        { program: "atmos", points: 30000, on: "Alaska or Hawaiian" },
        { program: "avios", points: 32000, byOrigin: [{ origins: INLAND, points: 40000 }], on: "Alaska or American" },
        { program: "united", points: 35000, on: "United" },
        { program: "delta", points: 40000, on: "Delta" },
      ],
    },
    {
      id: "hnl-j", city: "Honolulu", code: "HNL", route: "One way", cabin: "First/Business", cash: 1100, taxes: 6, kind: "beach", international: false, region: "Hawaii", source: "brief",
      options: [
        { program: "aeroplan", points: 25000, byOrigin: [{ origins: INLAND, points: 35000 }], on: "United" },
        { program: "atmos", points: 35000, on: "Alaska or Hawaiian" },
        { program: "united", points: 45000, on: "United" },
      ],
    },
    {
      id: "nyc", city: "New York", code: "JFK", route: "Round trip", cabin: "Economy", cash: 420, taxes: 11, kind: "city", international: false, region: "USA", source: "brief",
      options: [
        { program: "aa", points: 25000, on: "American" },
        { program: "aeroplan", points: 25000, on: "United" },
        { program: "turkish", points: 30000, on: "United" },
        { program: "sw", points: 30000, on: "Southwest" },
        { program: "delta", points: 30000, on: "Delta" },
        { program: "united", points: 30000, on: "United" },
        { program: "avios", points: 32000, on: "American or Alaska" },
      ],
    },
    {
      id: "nyc-j", city: "New York", code: "EWR", route: "One way", cabin: "Lie-flat business", cash: 1200, taxes: 6, kind: "city", international: false, region: "USA", source: "brief",
      options: [
        { program: "turkish", points: 22500, on: "United Polaris" },
        { program: "aa", points: 25000, on: "American" },
        { program: "aeroplan", points: 35000, on: "United Polaris" },
      ],
    },
    {
      id: "costa-rica", city: "Costa Rica", code: "SJO", route: "Round trip", cabin: "Economy", cash: 450, taxes: 80, kind: "beach", international: true, region: "Central & South America", source: "brief",
      options: [
        { program: "aa", points: 30000, on: "American" },
        { program: "avios", points: 32000, on: "American or Alaska" },
        { program: "united", points: 40000, on: "United" },
        { program: "delta", points: 40000, on: "Delta" },
      ],
    },
    {
      id: "paris", city: "Paris", code: "CDG", route: "Round trip", cabin: "Economy", cash: 750, taxes: 200, kind: "city", international: true, region: "Europe", source: "brief",
      options: [
        { program: "aa", points: 45000, on: "American (off-peak)" },
        { program: "flyingblue", points: 50000, on: "Air France", note: "Flying Blue adds carrier surcharges." },
        { program: "virgin", points: 60000, on: "Delta" },
        { program: "delta", points: 60000, on: "Delta" },
        { program: "united", points: 60000, on: "United" },
        { program: "aeroplan", points: 85000, on: "Air Canada" },
      ],
    },
    {
      id: "paris-j", city: "Paris", code: "CDG", route: "One way", cabin: "Business", cash: 3200, taxes: 200, kind: "city", international: true, region: "Europe", source: "brief",
      options: [
        { program: "flyingblue", points: 60000, byOrigin: [{ origins: ["SEA"], points: 45000, until: "2026-10-31", note: "Flying Blue promo from Seattle, book by Oct 31." }], on: "Air France", note: "Flying Blue adds carrier surcharges." },
        { program: "aa", points: 57500, on: "American (off-peak)" },
        { program: "aeroplan", points: 75000, on: "Air Canada or United" },
      ],
    },
    {
      id: "rome", city: "Rome", code: "FCO", route: "Round trip", cabin: "Economy", cash: 850, taxes: 200, kind: "city", international: true, region: "Europe", source: "brief",
      options: [
        { program: "aa", points: 45000, on: "American (off-peak)" },
        { program: "flyingblue", points: 50000, on: "Air France or KLM" },
        { program: "virgin", points: 60000, on: "Delta" },
        { program: "delta", points: 60000, on: "Delta" },
      ],
    },
    {
      id: "tokyo", city: "Tokyo", code: "HND", route: "Round trip", cabin: "Economy", cash: 900, taxes: 60, kind: "city", international: true, region: "Asia", source: "brief",
      options: [
        { program: "delta", points: 64000, on: "Delta" },
        { program: "aa", points: 70000, on: "Japan Airlines" },
        { program: "united", points: 70000, on: "United" },
      ],
    },
    {
      id: "tokyo-j", city: "Tokyo", code: "HND", route: "One way", cabin: "Business on ANA", cash: 4800, taxes: 60, kind: "city", international: true, region: "Asia", source: "brief",
      options: [
        { program: "virgin", points: 52500, byOrigin: [{ origins: INLAND, points: 60000 }], on: "ANA", note: "Virgin's ANA pricing was last confirmed in 2024." },
        { program: "aa", points: 60000, on: "Japan Airlines" },
        { program: "atmos", points: 60000, on: "Japan Airlines", note: "Atmos seats on JAL business are scarce." },
        { program: "aeroplan", points: 85000, on: "ANA" },
      ],
    },
    {
      id: "seoul-j", city: "Seoul", code: "ICN", route: "One way", cabin: "Business", cash: 4500, taxes: 70, kind: "city", international: true, region: "Asia", source: "brief",
      options: [
        { program: "aa", points: 60000, on: "Japan Airlines via Tokyo" },
        { program: "aeroplan", points: 85000, on: "Asiana or EVA" },
      ],
    },
    {
      id: "sydney-j", city: "Sydney", code: "SYD", route: "One way", cabin: "Business on Qantas", cash: 6500, taxes: 90, kind: "city", international: true, region: "Oceania", source: "brief",
      options: [
        { program: "aa", points: 80000, on: "Qantas" },
        { program: "atmos", points: 85000, on: "Qantas" },
        { program: "aeroplan", points: 90000, on: "United or Air Canada" },
      ],
    },
    {
      id: "bali-j", city: "Bali", code: "DPS", route: "One way", cabin: "Business", cash: 5500, taxes: 100, kind: "beach", international: true, region: "Asia", source: "brief",
      options: [
        { program: "kris", points: 120000, on: "Singapore Airlines via Singapore", note: "Approximate price." },
      ],
    },
  ];
  return [...researched, ...estimatedTrips()];
}

/**
 * More destinations, priced by Trace from published award charts on Oct 22,
 * 2026. These are estimates that haven't been checked against live searches
 * yet; the UI labels them that way. Verify before promoting any of them.
 */
function estimatedTrips(): TripDef[] {
  const E = { source: "estimate" as const };
  return [
    // USA
    { ...E, id: "chicago", city: "Chicago", code: "ORD", route: "Round trip", cabin: "Economy", cash: 380, taxes: 11, kind: "city", region: "USA", international: false,
      options: [
        { program: "aeroplan", points: 25000, byOrigin: [{ origins: INLAND, points: 20000 }], on: "United" },
        { program: "avios", points: 22000, on: "American" },
        { program: "aa", points: 25000, on: "American" },
        { program: "sw", points: 24000, on: "Southwest" },
        { program: "united", points: 25000, on: "United" },
        { program: "delta", points: 25000, on: "Delta" },
      ] },
    { ...E, id: "boston", city: "Boston", code: "BOS", route: "Round trip", cabin: "Economy", cash: 430, taxes: 11, kind: "city", region: "USA", international: false,
      options: [
        { program: "aa", points: 25000, on: "American" },
        { program: "aeroplan", points: 25000, on: "United" },
        { program: "turkish", points: 30000, on: "United" },
        { program: "sw", points: 30000, on: "Southwest" },
        { program: "delta", points: 30000, on: "Delta" },
        { program: "united", points: 30000, on: "United" },
      ] },
    { ...E, id: "miami", city: "Miami", code: "MIA", route: "Round trip", cabin: "Economy", cash: 400, taxes: 11, kind: "beach", region: "USA", international: false,
      options: [
        { program: "aa", points: 25000, on: "American" },
        { program: "aeroplan", points: 25000, on: "United" },
        { program: "sw", points: 28000, on: "Southwest" },
        { program: "united", points: 28000, on: "United" },
        { program: "delta", points: 30000, on: "Delta" },
        { program: "avios", points: 32000, on: "American" },
      ] },
    { ...E, id: "orlando", city: "Orlando", code: "MCO", route: "Round trip", cabin: "Economy", cash: 350, taxes: 11, kind: "city", region: "USA", international: false,
      options: [
        { program: "sw", points: 22000, on: "Southwest" },
        { program: "aa", points: 25000, on: "American" },
        { program: "aeroplan", points: 25000, on: "United" },
        { program: "united", points: 25000, on: "United" },
        { program: "delta", points: 28000, on: "Delta" },
      ] },
    { ...E, id: "new-orleans", city: "New Orleans", code: "MSY", route: "Round trip", cabin: "Economy", cash: 360, taxes: 11, kind: "city", region: "USA", international: false,
      options: [
        { program: "sw", points: 22000, on: "Southwest" },
        { program: "aeroplan", points: 25000, byOrigin: [{ origins: INLAND, points: 20000 }], on: "United" },
        { program: "aa", points: 25000, on: "American" },
        { program: "united", points: 25000, on: "United" },
        { program: "delta", points: 28000, on: "Delta" },
      ] },
    { ...E, id: "nashville", city: "Nashville", code: "BNA", route: "Round trip", cabin: "Economy", cash: 340, taxes: 11, kind: "city", region: "USA", international: false,
      options: [
        { program: "sw", points: 22000, on: "Southwest" },
        { program: "aeroplan", points: 25000, byOrigin: [{ origins: INLAND, points: 20000 }], on: "United" },
        { program: "aa", points: 25000, on: "American" },
        { program: "delta", points: 25000, on: "Delta" },
        { program: "united", points: 25000, on: "United" },
      ] },
    { ...E, id: "austin", city: "Austin", code: "AUS", route: "Round trip", cabin: "Economy", cash: 300, taxes: 11, kind: "city", region: "USA", international: false,
      options: [
        { program: "sw", points: 18000, on: "Southwest" },
        { program: "aeroplan", points: 20000, on: "United" },
        { program: "aa", points: 20000, on: "American" },
        { program: "united", points: 20000, on: "United" },
        { program: "delta", points: 22000, on: "Delta" },
      ] },
    { ...E, id: "washington", city: "Washington, D.C.", code: "DCA", route: "Round trip", cabin: "Economy", cash: 420, taxes: 11, kind: "city", region: "USA", international: false,
      options: [
        { program: "aa", points: 25000, on: "American" },
        { program: "aeroplan", points: 25000, on: "United" },
        { program: "turkish", points: 30000, on: "United" },
        { program: "sw", points: 30000, on: "Southwest" },
        { program: "united", points: 30000, on: "United" },
        { program: "delta", points: 30000, on: "Delta" },
      ] },
    { ...E, id: "chicago-j", city: "Chicago", code: "ORD", route: "One way", cabin: "First/Business", cash: 700, taxes: 6, kind: "city", region: "USA", international: false,
      options: [
        { program: "turkish", points: 22500, on: "United" },
        { program: "aa", points: 25000, on: "American" },
        { program: "aeroplan", points: 25000, on: "United" },
      ] },
    // Hawaii
    { ...E, id: "kauai", city: "Kauai", code: "LIH", route: "Round trip", cabin: "Economy", cash: 420, taxes: 11, kind: "beach", region: "Hawaii", international: false,
      options: [
        { program: "aeroplan", points: 25000, byOrigin: [{ origins: INLAND, points: 35000 }], on: "United" },
        { program: "sw", points: 26000, on: "Southwest" },
        { program: "atmos", points: 30000, on: "Alaska or Hawaiian" },
        { program: "avios", points: 32000, byOrigin: [{ origins: INLAND, points: 40000 }], on: "Alaska or American" },
        { program: "united", points: 35000, on: "United" },
      ] },
    { ...E, id: "maui-j", city: "Maui", code: "OGG", route: "One way", cabin: "First/Business", cash: 1000, taxes: 6, kind: "beach", region: "Hawaii", international: false,
      options: [
        { program: "aeroplan", points: 25000, byOrigin: [{ origins: INLAND, points: 35000 }], on: "United" },
        { program: "atmos", points: 35000, on: "Alaska or Hawaiian" },
        { program: "united", points: 45000, on: "United" },
      ] },
    // Canada
    { ...E, id: "banff", city: "Banff", code: "YYC", route: "Round trip", cabin: "Economy", cash: 380, taxes: 70, kind: "nature", region: "Canada", international: true,
      options: [
        { program: "aeroplan", points: 20000, byOrigin: [{ origins: NORTHWEST, points: 12000 }], on: "Air Canada" },
        { program: "atmos", points: 20000, on: "Alaska" },
        { program: "united", points: 25000, on: "United" },
        { program: "delta", points: 25000, on: "Delta or WestJet" },
      ] },
    // Mexico & Caribbean
    { ...E, id: "mexico-city", city: "Mexico City", code: "MEX", route: "Round trip", cabin: "Economy", cash: 350, taxes: 60, kind: "city", region: "Mexico & Caribbean", international: true,
      options: [
        { program: "aeroplan", points: 20000, on: "United" },
        { program: "avios", points: 22000, on: "American" },
        { program: "aa", points: 25000, on: "American" },
        { program: "united", points: 25000, on: "United" },
        { program: "delta", points: 28000, on: "Delta or Aeromexico" },
      ] },
    { ...E, id: "puerto-vallarta", city: "Puerto Vallarta", code: "PVR", route: "Round trip", cabin: "Economy", cash: 380, taxes: 70, kind: "beach", region: "Mexico & Caribbean", international: true,
      options: [
        { program: "aeroplan", points: 20000, byOrigin: [{ origins: NORTHWEST, points: 25000 }], on: "United" },
        { program: "avios", points: 22000, on: "Alaska or American" },
        { program: "sw", points: 22000, on: "Southwest" },
        { program: "aa", points: 25000, on: "American" },
        { program: "atmos", points: 25000, on: "Alaska" },
        { program: "united", points: 25000, on: "United" },
      ] },
    { ...E, id: "cancun-j", city: "Cancún", code: "CUN", route: "One way", cabin: "First/Business", cash: 700, taxes: 40, kind: "beach", region: "Mexico & Caribbean", international: true,
      options: [
        { program: "aa", points: 25000, on: "American" },
        { program: "aeroplan", points: 30000, on: "United" },
        { program: "united", points: 40000, on: "United" },
      ] },
    { ...E, id: "san-juan", city: "San Juan", code: "SJU", route: "Round trip", cabin: "Economy", cash: 450, taxes: 11, kind: "beach", region: "Mexico & Caribbean", international: false,
      options: [
        { program: "aa", points: 25000, on: "American" },
        { program: "aeroplan", points: 30000, on: "United" },
        { program: "sw", points: 30000, on: "Southwest" },
        { program: "united", points: 30000, on: "United" },
        { program: "delta", points: 30000, on: "Delta" },
        { program: "avios", points: 32000, on: "American" },
      ] },
    { ...E, id: "punta-cana", city: "Punta Cana", code: "PUJ", route: "Round trip", cabin: "Economy", cash: 500, taxes: 90, kind: "beach", region: "Mexico & Caribbean", international: true,
      options: [
        { program: "aa", points: 30000, on: "American" },
        { program: "aeroplan", points: 30000, on: "United" },
        { program: "avios", points: 35000, on: "American" },
        { program: "united", points: 35000, on: "United" },
        { program: "delta", points: 40000, on: "Delta" },
      ] },
    { ...E, id: "aruba", city: "Aruba", code: "AUA", route: "Round trip", cabin: "Economy", cash: 550, taxes: 90, kind: "beach", region: "Mexico & Caribbean", international: true,
      options: [
        { program: "aa", points: 30000, on: "American" },
        { program: "aeroplan", points: 35000, on: "United" },
        { program: "avios", points: 35000, on: "American" },
        { program: "united", points: 40000, on: "United" },
        { program: "delta", points: 40000, on: "Delta" },
      ] },
    // Central & South America
    { ...E, id: "medellin", city: "Medellín", code: "MDE", route: "Round trip", cabin: "Economy", cash: 600, taxes: 80, kind: "city", region: "Central & South America", international: true,
      options: [
        { program: "aa", points: 40000, on: "American" },
        { program: "aeroplan", points: 50000, on: "Avianca or United" },
        { program: "united", points: 50000, on: "United" },
      ] },
    { ...E, id: "buenos-aires-j", city: "Buenos Aires", code: "EZE", route: "One way", cabin: "Business", cash: 4500, taxes: 80, kind: "city", region: "Central & South America", international: true,
      options: [
        { program: "aa", points: 57500, on: "American" },
        { program: "aeroplan", points: 75000, on: "United or Copa" },
      ] },
    // Europe
    { ...E, id: "london", city: "London", code: "LHR", route: "Round trip", cabin: "Economy", cash: 800, taxes: 250, kind: "city", region: "Europe", international: true,
      options: [
        { program: "aa", points: 45000, on: "American (off-peak)" },
        { program: "virgin", points: 50000, on: "Virgin Atlantic", note: "Virgin adds carrier surcharges." },
        { program: "avios", points: 52000, on: "British Airways (off-peak)", note: "British Airways adds carrier surcharges." },
        { program: "delta", points: 60000, on: "Delta" },
        { program: "united", points: 60000, on: "United" },
        { program: "aeroplan", points: 85000, on: "Air Canada" },
      ] },
    { ...E, id: "london-j", city: "London", code: "LHR", route: "One way", cabin: "Lie-flat business", cash: 4000, taxes: 300, kind: "city", region: "Europe", international: true,
      options: [
        { program: "aa", points: 57500, on: "American (off-peak)" },
        { program: "virgin", points: 57500, on: "Virgin Atlantic Upper Class", note: "Virgin adds carrier surcharges, often several hundred dollars." },
        { program: "aeroplan", points: 75000, on: "Air Canada or United" },
      ] },
    { ...E, id: "barcelona", city: "Barcelona", code: "BCN", route: "Round trip", cabin: "Economy", cash: 850, taxes: 200, kind: "city", region: "Europe", international: true,
      options: [
        { program: "aa", points: 45000, on: "American (off-peak)" },
        { program: "flyingblue", points: 50000, on: "Air France or KLM", note: "Flying Blue adds carrier surcharges." },
        { program: "virgin", points: 60000, on: "Delta" },
        { program: "delta", points: 60000, on: "Delta" },
        { program: "united", points: 60000, on: "United" },
      ] },
    { ...E, id: "lisbon", city: "Lisbon", code: "LIS", route: "Round trip", cabin: "Economy", cash: 800, taxes: 180, kind: "city", region: "Europe", international: true,
      options: [
        { program: "aa", points: 45000, on: "American (off-peak)" },
        { program: "flyingblue", points: 50000, on: "Air France or KLM", note: "Flying Blue adds carrier surcharges." },
        { program: "united", points: 60000, on: "United or TAP" },
        { program: "aeroplan", points: 85000, on: "Air Canada or TAP" },
      ] },
    { ...E, id: "amsterdam", city: "Amsterdam", code: "AMS", route: "Round trip", cabin: "Economy", cash: 800, taxes: 200, kind: "city", region: "Europe", international: true,
      options: [
        { program: "aa", points: 45000, on: "American (off-peak)" },
        { program: "flyingblue", points: 50000, on: "KLM", note: "Flying Blue adds carrier surcharges." },
        { program: "virgin", points: 60000, on: "Delta" },
        { program: "delta", points: 60000, on: "Delta" },
      ] },
    { ...E, id: "dublin", city: "Dublin", code: "DUB", route: "Round trip", cabin: "Economy", cash: 700, taxes: 150, kind: "city", region: "Europe", international: true,
      options: [
        { program: "avios", points: 40000, on: "Aer Lingus (off-peak)" },
        { program: "aa", points: 45000, on: "American (off-peak)" },
        { program: "united", points: 60000, on: "United" },
        { program: "aeroplan", points: 70000, on: "Air Canada or United" },
      ] },
    { ...E, id: "reykjavik", city: "Reykjavík", code: "KEF", route: "Round trip", cabin: "Economy", cash: 600, taxes: 120, kind: "nature", region: "Europe", international: true,
      options: [
        { program: "united", points: 50000, on: "United" },
        { program: "delta", points: 50000, on: "Delta" },
      ] },
    { ...E, id: "athens", city: "Athens", code: "ATH", route: "Round trip", cabin: "Economy", cash: 1000, taxes: 200, kind: "city", region: "Europe", international: true,
      options: [
        { program: "aa", points: 45000, on: "American (off-peak)" },
        { program: "flyingblue", points: 55000, on: "Air France or KLM", note: "Flying Blue adds carrier surcharges." },
        { program: "united", points: 70000, on: "United" },
        { program: "delta", points: 70000, on: "Delta" },
      ] },
    { ...E, id: "santorini", city: "Santorini", code: "JTR", route: "Round trip", cabin: "Economy", cash: 1100, taxes: 220, kind: "beach", region: "Europe", international: true,
      options: [
        { program: "aa", points: 45000, on: "American and partners (off-peak)" },
        { program: "flyingblue", points: 60000, on: "Air France or KLM", note: "Flying Blue adds carrier surcharges." },
        { program: "united", points: 75000, on: "United and partners" },
      ] },
    // Asia
    { ...E, id: "osaka", city: "Osaka", code: "KIX", route: "Round trip", cabin: "Economy", cash: 950, taxes: 60, kind: "city", region: "Asia", international: true,
      options: [
        { program: "atmos", points: 60000, on: "Japan Airlines", note: "Atmos seats on JAL are limited." },
        { program: "aa", points: 70000, on: "Japan Airlines" },
        { program: "united", points: 70000, on: "United or ANA" },
      ] },
    { ...E, id: "bangkok-j", city: "Bangkok", code: "BKK", route: "One way", cabin: "Business", cash: 5000, taxes: 80, kind: "city", region: "Asia", international: true,
      options: [
        { program: "aa", points: 70000, on: "Japan Airlines via Tokyo" },
        { program: "aeroplan", points: 87500, on: "EVA Air via Taipei" },
      ] },
    { ...E, id: "singapore-j", city: "Singapore", code: "SIN", route: "One way", cabin: "Business", cash: 6000, taxes: 80, kind: "city", region: "Asia", international: true,
      options: [
        { program: "aa", points: 70000, on: "Japan Airlines via Tokyo" },
        { program: "aeroplan", points: 87500, on: "EVA Air or Singapore Airlines" },
        { program: "kris", points: 99000, on: "Singapore Airlines", note: "Approximate saver price." },
      ] },
    { ...E, id: "hong-kong-j", city: "Hong Kong", code: "HKG", route: "One way", cabin: "Business", cash: 4500, taxes: 70, kind: "city", region: "Asia", international: true,
      options: [
        { program: "aa", points: 70000, on: "Cathay Pacific" },
        { program: "atmos", points: 70000, on: "Cathay Pacific", note: "Atmos seats on Cathay are limited." },
      ] },
    // Oceania
    { ...E, id: "sydney", city: "Sydney", code: "SYD", route: "Round trip", cabin: "Economy", cash: 1500, taxes: 120, kind: "city", region: "Oceania", international: true,
      options: [
        { program: "aa", points: 80000, on: "Qantas" },
        { program: "united", points: 100000, on: "United" },
        { program: "aeroplan", points: 110000, on: "United or Air Canada" },
      ] },
    { ...E, id: "auckland-j", city: "Auckland", code: "AKL", route: "One way", cabin: "Business", cash: 6000, taxes: 90, kind: "nature", region: "Oceania", international: true,
      options: [
        { program: "aa", points: 80000, on: "Qantas or American" },
        { program: "aeroplan", points: 87500, on: "Air New Zealand" },
      ] },
    // Middle East
    { ...E, id: "dubai-j", city: "Dubai", code: "DXB", route: "One way", cabin: "Business", cash: 6000, taxes: 90, kind: "city", region: "Middle East", international: true,
      options: [
        { program: "aa", points: 70000, on: "Qatar Airways via Doha" },
      ] },
  ];
}
