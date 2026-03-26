import Constants from "expo-constants";

export const MAX_DAILY_SWIPES = 8;
// @ts-ignore: __DEV__ is defined by React Native at runtime
export const SUBSCRIBE_URL = __DEV__
  ? (Constants.expoConfig?.extra?.devSubscribeUrl ?? "http://localhost:3000/subscribe")
  : "https://subscribe.tracetravel.co/subscribe";
export const MAX_SAVES = 3;
export const UNLIMITED_SWIPES = 999999;

// @ts-ignore: __DEV__ is defined by React Native at runtime
export const API_BASE_URL = __DEV__
  ? (Constants.expoConfig?.extra?.devApiUrl ?? "http://localhost:3001")
  : "https://api-7l7vojyykq-uc.a.run.app";

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
    id: "first_swipe",
    emoji: "\u{1F446}",
    name: "First Swipe",
    desc: "Started the journey",
    requirement: (p) => (p.swipeCount || 0) >= 1,
  },
  {
    id: "international",
    emoji: "\u{1F30D}",
    name: "Globe Trotter",
    desc: "Swipe on 3 international deals",
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
      return intlSwipes.length >= 3;
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
        (s: any) =>
          s.dealType === "luxury" && (s.action === "right" || s.action === "super")
      ).length >= 5,
  },
  {
    id: "budget_sniper",
    emoji: "\u{1F3AF}",
    name: "Budget Sniper",
    desc: "Saved 5 budget deals",
    requirement: (_, swipes) =>
      swipes.filter(
        (s: any) =>
          s.dealType === "budget" && (s.action === "right" || s.action === "super")
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
  {
    id: "super_swiper",
    emoji: "\u{1F680}",
    name: "Super Swiper",
    desc: "Used 10 super swipes",
    requirement: (_, swipes) =>
      swipes.filter((s: any) => s.action === "super").length >= 10,
  },
];

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
