import { Deal } from "@trace/shared";
import { API_BASE_URL } from "../lib/constants";
import { DestinationInfo } from "../lib/destinationData";

const MONTH_NAMES: Record<string, string> = {
  jan: "january", feb: "february", mar: "march", apr: "april",
  may: "may", jun: "june", jul: "july", aug: "august",
  sep: "september", oct: "october", nov: "november", dec: "december",
  january: "january", february: "february", march: "march", april: "april",
  june: "june", july: "july", august: "august", september: "september",
  october: "october", november: "november", december: "december",
};

function extractMonth(travelWindow: string | undefined): string {
  if (!travelWindow) return "any";
  const lower = travelWindow.toLowerCase().trim();
  const firstWord = lower.split(/[\s\-\/]/)[0].replace(/\./g, "").trim();
  return MONTH_NAMES[firstWord] ?? "any";
}

// TODO: remove MOCK_DATA once server is deployed (firebase deploy --only functions)
const MOCK_DATA: DestinationInfo = {
  weather: {
    label: "Peak Summer",
    temp: "72-88°F",
    humidity: 58,
    desc: "Warm, sunny days with long evenings",
    details: "July brings reliably clear skies and warm temps — ideal for outdoor exploration with evenings that cool off nicely.",
    icon: "sun",
    packingTip: "Light layers for evenings, sunscreen during the day. A compact umbrella for the occasional afternoon shower.",
  },
  neighborhoods: [
    { name: "Downtown Core", emoji: "🏙️", vibe: "Buzzy & walkable", description: "The heart of the city with the best restaurant density and nightlife. Walk everywhere — parking is a nightmare. Best for dinner and drinks after 7pm." },
    { name: "Arts District", emoji: "🎨", vibe: "Creative & local", description: "Where the galleries, coffee shops, and indie boutiques live. Less touristy, more authentic. Saturday mornings have a great farmers market." },
    { name: "Waterfront", emoji: "⛵", vibe: "Scenic & touristy", description: "Great views and easy photo ops, but expect crowds and elevated prices. Worth a morning walk — skip dinner here unless you don't mind paying tourist rates." },
    { name: "North Quarter", emoji: "🌿", vibe: "Residential & chill", description: "Leafy streets, excellent brunch spots, and none of the downtown chaos. Stay here if you want to feel like a local. 20 min from the center by transit." },
  ],
  thingsToDo: [
    { name: "Explore the Old Market", emoji: "🛍️", description: "A sprawling covered market with local food, crafts, and the city's best street snacks — go hungry.", tags: ["culture", "food"] },
    { name: "Sunset Kayak Tour", emoji: "🚣", description: "2-hour guided paddle through the harbor at golden hour. Book 48 hours ahead — fills up fast in summer.", tags: ["adventure", "romantic"] },
    { name: "City Museum of Art", emoji: "🏛️", description: "One of the top collections in the region, with a standout contemporary wing. Free on Thursday evenings.", tags: ["culture", "relaxation"] },
    { name: "Rooftop Bar Crawl", emoji: "🍸", description: "Three iconic rooftop bars within walking distance — start at Elevate, finish at Sky Lounge for the best view.", tags: ["luxury", "romantic"] },
    { name: "Half-Day Bike Tour", emoji: "🚴", description: "Guided cycling through parks and hidden neighborhoods. The best way to cover ground and find spots you'd never stumble on solo.", tags: ["adventure", "culture"] },
    { name: "Cooking Class", emoji: "👨‍🍳", description: "Learn to cook two local dishes with a chef in a private kitchen. Great for couples or solo travelers wanting to connect with locals.", tags: ["food", "romantic", "family"] },
  ],
  dining: {
    budget: [
      { name: "La Taqueria Central", type: "Mexican street tacos — cash only, line out the door for a reason" },
      { name: "Pho Corner", type: "Vietnamese — giant bowls, tiny prices, open until 2am" },
      { name: "The Grain Bowl", type: "Fast-casual grain bowls — fresh, filling, under $12" },
    ],
    moderate: [
      { name: "Ember & Oak", type: "Wood-fired American — best burger in the city, great cocktails" },
      { name: "Saffron", type: "Modern Indian — don't skip the lamb shank, make a reservation" },
      { name: "Tide & Table", type: "Seafood bistro — locally sourced, rotating menu, outdoor patio" },
    ],
    premium: [
      { name: "Atelier", type: "New American tasting menu — 7 courses, impeccable service, book 2 weeks out" },
      { name: "Monocle", type: "Japanese-French fusion — omakase bar seats are the move" },
    ],
  },
  dailyBudget: {
    budget: { amount: "$80/day", description: "Hostel or budget hotel, street food + one sit-down meal, transit and walking" },
    midRange: { amount: "$200/day", description: "Boutique hotel, two solid restaurant meals, a tour or activity, occasional Uber" },
    luxury: { amount: "$450+/day", description: "Design hotel, tasting menus, private tours, rooftop bars, car service" },
  },
  gettingAround: [
    { icon: "🚇", mode: "Metro", tip: "Covers all major areas. Get a 3-day pass at any station — cheaper than buying per ride.", cost: "$3/ride or $18 for 3-day pass" },
    { icon: "🚲", mode: "Bike Share", tip: "Perfect for the flat central neighborhoods. Stations every few blocks. First 30 min is free with day pass.", cost: "$10/day" },
    { icon: "🚕", mode: "Rideshare", tip: "Use for late nights or luggage. Surge pricing hits hard on weekends after 10pm — walk a block from busy venues before requesting.", cost: "$8–20 typical ride" },
  ],
  dayTrips: [
    { name: "Coastal Cliffs", emoji: "🏔️", time: "45 min by car" },
    { name: "Wine Valley", emoji: "🍷", time: "1.5 hrs by car" },
    { name: "Historic Old Town", emoji: "🏘️", time: "1 hr by train" },
    { name: "National Park", emoji: "🌲", time: "2 hrs by car" },
  ],
  whatToAvoid: [
    { tip: "Don't eat at any restaurant directly on the main tourist plaza — you're paying 3x for worse food." },
    { tip: "Avoid the airport taxi queue. Rideshare from the designated app pickup zone is half the price." },
    { tip: "Skip the 'hop-on hop-off' bus. The metro covers the same ground for a fraction of the cost." },
    { tip: "Don't book tours through hotel concierge — they take a cut. Book directly or via GetYourGuide." },
    { tip: "Weekends in the Arts District get crowded by noon. Go Saturday morning or wait until Sunday evening." },
  ],
};

export async function fetchDestinationInfo(deal: Deal): Promise<DestinationInfo> {
  const isDomestic = deal.domestic_or_international?.toLowerCase() === "domestic";
  const month = extractMonth(deal.travel_window || deal.dateString);
  const params = new URLSearchParams({
    destination: deal.destination,
    domestic: String(isDomestic),
    month,
  });
  try {
    const response = await fetch(
      `${API_BASE_URL}/destination-info/${deal.destination_code}?${params}`
    );
    if (response.ok) return response.json();
  } catch {}
  // Server not deployed yet — fall back to mock so the UI is previewable
  return MOCK_DATA;
}
