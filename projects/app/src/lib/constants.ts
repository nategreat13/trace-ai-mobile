import Constants from "expo-constants";
import { getEnv } from "./env";

export const MAX_SAVES = 5;
/**
 * Cadence for the in-deck premium/business upsell card: fires every
 * UPSELL_CARD_INTERVAL lifetime swipes, starting at UPSELL_CARD_START.
 * Free users alternate Premium/Business each time it fires (swipe 10 =
 * Premium, 15 = Business, 20 = Premium, ...); Premium-but-not-Business
 * users only ever see the Business pitch, since Premium's moot for them.
 */
export const UPSELL_CARD_START = 10;
export const UPSELL_CARD_INTERVAL = 5;

/**
 * Cloud Function URLs.
 *
 * Prod is the long-stable URL the function was deployed under. Staging
 * is the URL Cloud Run assigns to the `apiStaging` function — set once
 * after the first staging deploy.
 *
 * Both functions live in the same Firebase project (`trace-ai-b9cba`)
 * and use the same secrets bindings; the only difference is the env
 * scope they read/write inside (via `runWithEnv` in server/src/env.ts).
 */
const PROD_API_URL = "https://api-7l7vojyykq-uc.a.run.app";
const STAGING_API_URL = "https://apistaging-7l7vojyykq-uc.a.run.app";

// In dev, app.config.js populates `extra.devApiUrl` with the local server
// URL when USE_LOCAL_API=1 is set (the default for `yarn dev2`). For
// `yarn dev:prod` and for production binaries, devApiUrl is null and we
// fall back to the env-appropriate production API.
const devApiUrl = (Constants.expoConfig?.extra as { devApiUrl?: string | null } | undefined)?.devApiUrl;

function resolveApiBaseUrl(): string {
  // @ts-ignore: __DEV__ is defined by React Native at runtime
  if (__DEV__ && devApiUrl) return devApiUrl;
  return getEnv() === "staging" ? STAGING_API_URL : PROD_API_URL;
}

export const API_BASE_URL = resolveApiBaseUrl();
// @ts-ignore: __DEV__ is defined by React Native at runtime
if (__DEV__) {
  console.log(
    `[constants] API_BASE_URL = ${API_BASE_URL} (env: ${getEnv()}, devApiUrl from extra: ${devApiUrl ?? "null"})`
  );
}

export const DEAL_TYPES = [
  { value: "family", icon: "\u{1F468}\u200D\u{1F469}\u200D\u{1F467}\u200D\u{1F466}", label: "Family-Friendly", sub: "Kid-approved fun" },
  { value: "luxury", icon: "\u2728", label: "Luxury Resort", sub: "Treat yourself" },
  { value: "adventure", icon: "\u{1F3D4}\uFE0F", label: "Adventure", sub: "Off the beaten path" },
  { value: "budget", icon: "\u{1F4B0}", label: "Budget", sub: "Max value" },
  { value: "cultural", icon: "\u{1F3DB}\uFE0F", label: "Cultural", sub: "History & sites" },
  { value: "relaxation", icon: "\u{1F3D6}\uFE0F", label: "Relaxation", sub: "Unwind & retreat" },
  { value: "surprise", icon: "\u{1F3B2}", label: "Surprise Me", sub: "AI picks" },
] as const;

export const TIMEFRAMES = [
  { value: "immediately", icon: "\u26A1", label: "Immediately", sub: "Ready to go now" },
  { value: "next_few_weeks", icon: "\u{1F4C5}", label: "Next Few Weeks", sub: "2-3 weeks out" },
  { value: "next_1_2_months", icon: "\u{1F5D3}\uFE0F", label: "1-2 Months", sub: "Planning ahead" },
  { value: "3_months_plus", icon: "\u{1F30D}", label: "3+ Months", sub: "Future trip" },
  { value: "no_preference", icon: "\u2728", label: "No Preference", sub: "Show me everything" },
] as const;

export const DEST_OPTIONS = [
  { value: "domestic", icon: "\u{1F1FA}\u{1F1F8}", label: "Domestic", sub: "Stay close" },
  { value: "international", icon: "\u{1F30D}", label: "International", sub: "Go far" },
  { value: "both", icon: "\u2708\uFE0F", label: "Both", sub: "Show me everything" },
] as const;

export interface Badge {
  id: string;
  emoji: string;
  name: string;
  desc: string;
  requirement: (profile: any, swipes: any[]) => boolean;
}

const US_STATES = [
  "new york", "los angeles", "chicago", "miami", "las vegas", "orlando",
  "san francisco", "seattle", "boston", "denver", "atlanta", "dallas",
  "houston", "phoenix", "portland", "nashville", "new orleans", "hawaii",
  "honolulu", "austin",
];

export const ALL_BADGES: Badge[] = [
  {
    id: "first_5_swipes",
    emoji: "✈️",
    name: "First 5 Swipes",
    desc: "You're officially a deal hunter",
    requirement: (p) => (p.swipeCount || 0) >= 5,
  },
  {
    id: "international",
    emoji: "\u{1F30D}",
    name: "Globe Trotter",
    desc: "Swipe on 5 international deals",
    requirement: (_, swipes) => {
      const intlSwipes = swipes.filter((s: any) => {
        if (s.domesticOrInternational) {
          return s.domesticOrInternational.toLowerCase().includes("international");
        }
        if (s.continent) {
          const c = s.continent.trim().toLowerCase();
          return c && c !== "north america";
        }
        if (s.destination) {
          const d = s.destination.toLowerCase();
          return !US_STATES.some((us) => d.includes(us));
        }
        return false;
      });
      return intlSwipes.length >= 5;
    },
  },
  {
    id: "50_deals",
    emoji: "\u{1F525}",
    name: "Deal Machine",
    desc: "Reviewed 50 deals",
    requirement: (p) => (p.swipeCount || 0) >= 50,
  },
  {
    id: "luxury_lover",
    emoji: "\u{1F48E}",
    name: "Luxury Lover",
    desc: "Saved 5 luxury deals",
    requirement: (_, swipes) =>
      swipes.filter(
        (s: any) => s.dealType === "luxury" && s.action === "right"
      ).length >= 5,
  },
  {
    id: "budget_sniper",
    emoji: "\u{1F3AF}",
    name: "Budget Sniper",
    desc: "Saved 5 budget deals",
    requirement: (_, swipes) =>
      swipes.filter(
        (s: any) => s.dealType === "budget" && s.action === "right"
      ).length >= 5,
  },
  {
    id: "streak_7",
    emoji: "\u26A1",
    name: "Weekly Warrior",
    desc: "7-day streak",
    requirement: (p) => (p.streakDays || 0) >= 7,
  },
  {
    id: "level_5",
    emoji: "\u{1F3C6}",
    name: "Deal Hunter Pro",
    desc: "Reach level 5",
    requirement: (p) => (p.dealHunterLevel || 1) >= 5,
  },
];

export const LEVEL_TITLES: { title: string; emoji: string }[] = [
  { title: "Deal Scout",     emoji: "✈️"  }, // 1
  { title: "Bargain Hunter", emoji: "🔍"  }, // 2
  { title: "Fare Detective", emoji: "🕵️"  }, // 3
  { title: "Flight Finder",  emoji: "🛫"  }, // 4
  { title: "Sky Captain",    emoji: "🎖️"  }, // 5
  { title: "Jet Setter",     emoji: "💎"  }, // 6
  { title: "Altitude Ace",   emoji: "🚀"  }, // 7
  { title: "Frequent Flyer", emoji: "⚡"  }, // 8
  { title: "Mile Master",    emoji: "🏅"  }, // 9
  { title: "Trace Legend",   emoji: "👑"  }, // 10+
];

export const SWIPES_PER_LEVEL = 25;

export function getLevelInfo(level: number, swipeCount: number) {
  const idx = Math.min(level - 1, LEVEL_TITLES.length - 1);
  const current = LEVEL_TITLES[idx];
  const isMax = level >= LEVEL_TITLES.length;
  const nextIdx = Math.min(level, LEVEL_TITLES.length - 1);
  const next = LEVEL_TITLES[nextIdx];
  const swipesIntoLevel = swipeCount % SWIPES_PER_LEVEL;
  const swipesToNext = isMax ? 0 : SWIPES_PER_LEVEL - swipesIntoLevel;
  const progress = swipesIntoLevel / SWIPES_PER_LEVEL;
  return { current, next, isMax, swipesToNext, progress };
}

export const DEAL_TYPE_LABELS: Record<string, string> = {
  family: "\u{1F468}\u200D\u{1F469}\u200D\u{1F467}\u200D\u{1F466} Family",
  luxury: "\u2728 Luxury",
  big_city: "\u{1F3D9}\uFE0F Big City",
  adventure: "\u{1F3D4}\uFE0F Adventure",
  romantic: "\u{1F495} Romantic",
  budget: "\u{1F4B0} Budget",
  cultural: "\u{1F3DB}\uFE0F Cultural",
  relaxation: "\u{1F334} Relaxation",
  surprise: "\u{1F3B2} Surprise",
};

export const DEST_LABELS: Record<string, string> = {
  domestic: "\u{1F1FA}\u{1F1F8} Domestic",
  international: "\u{1F30D} International",
  both: "\u2708\uFE0F Both",
};

const DESTINATION_FLAGS: Array<[string[], string]> = [
  // North America
  [["new york", "nyc", "manhattan", "brooklyn", "miami", "los angeles", "l.a.", "las vegas", "chicago", "san francisco", "seattle", "boston", "denver", "atlanta", "dallas", "houston", "phoenix", "portland", "nashville", "new orleans", "honolulu", "hawaii", "maui", "austin", "orlando", "washington dc", "washington d.c.", "san diego", "minneapolis", "detroit", "philadelphia"], "\uD83C\uDDFA\uD83C\uDDF8"],
  [["toronto", "vancouver", "montreal", "calgary", "ottawa", "quebec", "banff", "whistler"], "\uD83C\uDDE8\uD83C\uDDE6"],
  [["cancun", "mexico city", "tulum", "cabo", "los cabos", "puerto vallarta", "playa del carmen", "oaxaca", "guadalajara", "mazatlan", "mexico"], "\uD83C\uDDF2\uD83C\uDDFD"],
  [["havana", "cuba"], "\uD83C\uDDE8\uD83C\uDDFA"],
  [["san jose", "costa rica"], "\uD83C\uDDE8\uD83C\uDDF7"],
  [["panama city", "panama"], "\uD83C\uDDF5\uD83C\uDDE6"],
  [["punta cana", "santo domingo", "dominican republic"], "\uD83C\uDDE9\uD83C\uDDF4"],
  [["montego bay", "kingston", "jamaica"], "\uD83C\uDDEF\uD83C\uDDF2"],
  [["nassau", "bahamas"], "\uD83C\uDDE7\uD83C\uDDF8"],
  [["san juan", "puerto rico"], "\uD83C\uDDF5\uD83C\uDDF7"],
  [["aruba"], "\uD83C\uDDE6\uD83C\uDDFC"],
  [["barbados"], "\uD83C\uDDE7\uD83C\uDDE7"],
  [["antigua"], "\uD83C\uDDE6\uD83C\uDDEC"],
  [["st. lucia", "st lucia"], "\uD83C\uDDF1\uD83C\uDDE8"],
  [["turks and caicos", "providenciales"], "\uD83C\uDDF9\uD83C\uDDE8"],
  // South America
  [["rio", "s\u00E3o paulo", "sao paulo", "brazil", "brasil", "florianopolis", "iguazu"], "\uD83C\uDDE7\uD83C\uDDF7"],
  [["buenos aires", "patagonia", "argentina"], "\uD83C\uDDE6\uD83C\uDDF7"],
  [["lima", "machu picchu", "cusco", "peru"], "\uD83C\uDDF5\uD83C\uDDEA"],
  [["bogota", "bogot\u00E1", "cartagena", "colombia", "medell\u00EDn", "medellin"], "\uD83C\uDDE8\uD83C\uDDF4"],
  [["santiago", "chile"], "\uD83C\uDDE8\uD83C\uDDF1"],
  [["quito", "galapagos", "gal\u00E1pagos", "ecuador"], "\uD83C\uDDEA\uD83C\uDDE8"],
  // Europe
  [["london", "england", "united kingdom", "uk", "manchester", "edinburgh", "scotland", "wales", "oxford", "cambridge"], "\uD83C\uDDEC\uD83C\uDDE7"],
  [["paris", "nice", "lyon", "marseille", "bordeaux", "france", "french riviera", "normandy", "provence"], "\uD83C\uDDEB\uD83C\uDDF7"],
  [["rome", "milan", "venice", "florence", "naples", "amalfi", "sicily", "sardinia", "italy", "italian"], "\uD83C\uDDEE\uD83C\uDDF9"],
  [["barcelona", "madrid", "seville", "sevilla", "ibiza", "mallorca", "granada", "spain", "canary islands", "tenerife"], "\uD83C\uDDEA\uD83C\uDDF8"],
  [["amsterdam", "netherlands", "holland"], "\uD83C\uDDF3\uD83C\uDDF1"],
  [["berlin", "munich", "hamburg", "frankfurt", "germany", "bavarian"], "\uD83C\uDDE9\uD83C\uDDEA"],
  [["lisbon", "porto", "algarve", "portugal", "azores", "madeira"], "\uD83C\uDDF5\uD83C\uDDF9"],
  [["athens", "santorini", "mykonos", "crete", "greece", "greek"], "\uD83C\uDDEC\uD83C\uDDF7"],
  [["dublin", "ireland"], "\uD83C\uDDEE\uD83C\uDDEA"],
  [["zurich", "geneva", "bern", "switzerland", "swiss alps"], "\uD83C\uDDE8\uD83C\uDDED"],
  [["vienna", "salzburg", "austria"], "\uD83C\uDDE6\uD83C\uDDF9"],
  [["prague", "czech", "czechia"], "\uD83C\uDDE8\uD83C\uDDFF"],
  [["budapest", "hungary"], "\uD83C\uDDED\uD83C\uDDFA"],
  [["warsaw", "krakow", "krak\u00F3w", "poland"], "\uD83C\uDDF5\uD83C\uDDF1"],
  [["bucharest", "romania"], "\uD83C\uDDF7\uD83C\uDDF4"],
  [["copenhagen", "denmark"], "\uD83C\uDDE9\uD83C\uDDF0"],
  [["stockholm", "sweden"], "\uD83C\uDDF8\uD83C\uDDEA"],
  [["oslo", "norway", "norwegian"], "\uD83C\uDDF3\uD83C\uDDF4"],
  [["helsinki", "finland"], "\uD83C\uDDEB\uD83C\uDDEE"],
  [["reykjavik", "iceland"], "\uD83C\uDDEE\uD83C\uDDF8"],
  [["brussels", "belgium"], "\uD83C\uDDE7\uD83C\uDDEA"],
  [["istanbul", "turkey", "t\u00FCrkiye", "cappadocia", "antalya", "bodrum"], "\uD83C\uDDF9\uD83C\uDDF7"],
  [["tallinn", "estonia"], "\uD83C\uDDEA\uD83C\uDDEA"],
  [["riga", "latvia"], "\uD83C\uDDF1\uD83C\uDDFB"],
  [["vilnius", "lithuania"], "\uD83C\uDDF1\uD83C\uDDF9"],
  [["zagreb", "dubrovnik", "split", "croatia"], "\uD83C\uDDED\uD83C\uDDF7"],
  [["athens", "thessaloniki"], "\uD83C\uDDEC\uD83C\uDDF7"],
  [["belgrade", "serbia"], "\uD83C\uDDF7\uD83C\uDDF8"],
  [["luxembourg"], "\uD83C\uDDF1\uD83C\uDDFA"],
  [["malta"], "\uD83C\uDDF2\uD83C\uDDF9"],
  [["monaco"], "\uD83C\uDDF2\uD83C\uDDE8"],
  // Middle East & Africa
  [["dubai", "abu dhabi", "uae", "emirates"], "\uD83C\uDDE6\uD83C\uDDEA"],
  [["doha", "qatar"], "\uD83C\uDDF6\uD83C\uDDE6"],
  [["tel aviv", "jerusalem", "israel"], "\uD83C\uDDEE\uD83C\uDDF1"],
  [["cairo", "egypt", "sharm el sheikh", "hurghada"], "\uD83C\uDDEA\uD83C\uDDEC"],
  [["marrakech", "casablanca", "fez", "morocco"], "\uD83C\uDDF2\uD83C\uDDE6"],
  [["nairobi", "kenya", "masai mara", "amboseli"], "\uD83C\uDDF0\uD83C\uDDEA"],
  [["cape town", "johannesburg", "south africa", "kruger"], "\uD83C\uDDFF\uD83C\uDDE6"],
  [["zanzibar", "tanzania", "serengeti"], "\uD83C\uDDF9\uD83C\uDDFF"],
  [["victoria falls", "zambia"], "\uD83C\uDDFF\uD83C\uDDF2"],
  [["accra", "ghana"], "\uD83C\uDDEC\uD83C\uDDED"],
  [["tunis", "tunisia"], "\uD83C\uDDF9\uD83C\uDDF3"],
  [["amman", "petra", "jordan"], "\uD83C\uDDEF\uD83C\uDDF4"],
  // Asia
  [["tokyo", "osaka", "kyoto", "japan", "hiroshima", "hokkaido", "okinawa", "sapporo"], "\uD83C\uDDEF\uD83C\uDDF5"],
  [["bali", "jakarta", "lombok", "indonesia", "komodo"], "\uD83C\uDDEE\uD83C\uDDE9"],
  [["bangkok", "phuket", "chiang mai", "koh samui", "thailand", "thai", "krabi"], "\uD83C\uDDF9\uD83C\uDDED"],
  [["singapore"], "\uD83C\uDDF8\uD83C\uDDEC"],
  [["hong kong"], "\uD83C\uDDED\uD83C\uDDF0"],
  [["seoul", "busan", "jeju", "korea", "south korea"], "\uD83C\uDDF0\uD83C\uDDF7"],
  [["beijing", "shanghai", "china", "chinese"], "\uD83C\uDDE8\uD83C\uDDF3"],
  [["taipei", "taiwan"], "\uD83C\uDDF9\uD83C\uDDFC"],
  [["mumbai", "delhi", "goa", "india", "agra", "jaipur", "kerala"], "\uD83C\uDDEE\uD83C\uDDF3"],
  [["colombo", "sri lanka", "maldives"], "\uD83C\uDDF1\uD83C\uDDF0"],
  [["male", "maldives"], "\uD83C\uDDF2\uD83C\uDDFB"],
  [["kathmandu", "nepal", "himalaya"], "\uD83C\uDDF3\uD83C\uDDF5"],
  [["kuala lumpur", "malaysia", "penang", "langkawi"], "\uD83C\uDDF2\uD83C\uDDFE"],
  [["manila", "cebu", "palawan", "boracay", "philippines"], "\uD83C\uDDF5\uD83C\uDDED"],
  [["hanoi", "ho chi minh", "saigon", "danang", "vietnam", "halong"], "\uD83C\uDDFB\uD83C\uDDF3"],
  [["phnom penh", "siem reap", "cambodia", "angkor"], "\uD83C\uDDF0\uD83C\uDDED"],
  [["yangon", "myanmar", "burma", "bagan"], "\uD83C\uDDF2\uD83C\uDDF2"],
  [["ulaanbaatar", "mongolia"], "\uD83C\uDDF2\uD83C\uDDF3"],
  [["tashkent", "uzbekistan", "samarkand"], "\uD83C\uDDFA\uD83C\uDDFF"],
  // Oceania
  [["sydney", "melbourne", "brisbane", "perth", "cairns", "great barrier reef", "australia"], "\uD83C\uDDE6\uD83C\uDDFA"],
  [["auckland", "queenstown", "new zealand", "fiordland"], "\uD83C\uDDF3\uD83C\uDDFF"],
  [["fiji", "suva", "nadi"], "\uD83C\uDDEB\uD83C\uDDEF"],
  [["bora bora", "tahiti", "french polynesia"], "\uD83C\uDDF5\uD83C\uDDEB"],
];

export function getDestinationFlag(destination: string): string {
  const lower = destination.toLowerCase();
  for (const [keywords, flag] of DESTINATION_FLAGS) {
    if (keywords.some((kw) => lower.includes(kw))) return flag;
  }
  return "";
}
