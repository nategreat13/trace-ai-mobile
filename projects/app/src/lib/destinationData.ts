export interface WeatherInfo {
  label: string;
  temp: string;
  humidity: number;
  desc: string;
  details: string;
  icon: "sun" | "rain" | "snow" | "cloud" | "partly";
  packingTip: string;
}

export interface DestinationInfo {
  // International only
  essentials?: {
    flag: string;
    currency: string;
    language: string;
    timezone: string;
    plug: string;
    needsAdapter: boolean;
  };
  weather: WeatherInfo;
  neighborhoods: Array<{
    name: string;
    emoji: string;
    vibe: string;
    description: string;
  }>;
  thingsToDo: Array<{
    name: string;
    emoji: string;
    description: string;
    tags: string[];
  }>;
  dining: {
    budget: Array<{ name: string; type: string }>;
    moderate: Array<{ name: string; type: string }>;
    premium: Array<{ name: string; type: string }>;
  };
  dailyBudget: {
    budget: { amount: string; description: string };
    midRange: { amount: string; description: string };
    luxury: { amount: string; description: string };
  };
  gettingAround: Array<{
    icon: string;
    mode: string;
    tip: string;
    cost?: string;
  }>;
  dayTrips: Array<{ name: string; emoji: string; time: string }>;
  whatToAvoid: Array<{ tip: string }>;
}
