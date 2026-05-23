const LUXURY_KEYWORDS = [
  "maldives", "bora bora", "monaco", "dubai", "abu dhabi", "st. barts", "st barts", "saint barts",
  "mykonos", "amalfi", "portofino", "capri", "santorini", "tuscany",
  "seychelles", "french polynesia", "tahiti", "st. lucia", "saint lucia",
  "turks and caicos", "turks & caicos", "aspen", "vail", "courchevel", "st moritz",
  "ibiza", "positano", "cinque terre", "lake como", "zurich", "zürich", "geneva",
  "copenhagen", "singapore", "hong kong",
  "las vegas", "udaipur", "palm springs",
];

const ADVENTURE_KEYWORDS = [
  "patagonia", "peru", "machu picchu", "cusco", "amazon", "galapagos", "ecuador",
  "colombia", "medellin", "medellín", "bogota", "bogotá", "cartagena", "chile", "santiago", "argentina", "buenos aires",
  "rio de janeiro", "brazil", "sao paulo", "são paulo", "bolivia", "la paz", "montevideo", "uruguay",
  "costa rica", "san jose", "guatemala", "belize", "honduras", "nicaragua", "panama",
  "alaska", "banff", "jasper", "whistler", "yukon", "yellowstone",
  "grand canyon", "zion", "moab", "sedona", "yosemite", "glacier",
  "jackson hole", "bozeman", "flagstaff", "durango",
  "kenya", "nairobi", "tanzania", "kilimanjaro", "serengeti", "zanzibar",
  "namibia", "botswana", "zambia", "zimbabwe", "victoria falls",
  "madagascar", "rwanda", "uganda", "ethiopia", "addis ababa",
  "south africa", "cape town", "kruger", "mozambique",
  "nepal", "kathmandu", "pokhara", "tibet", "bhutan",
  "vietnam", "hanoi", "ho chi minh", "halong bay", "da nang", "hoi an",
  "laos", "luang prabang", "cambodia", "angkor", "siem reap",
  "chiang mai", "chiang rai", "myanmar", "bagan",
  "indonesia", "lombok", "komodo", "flores", "sulawesi", "borneo", "raja ampat",
  "philippines", "palawan", "siargao", "cebu", "boracay",
  "mongolia", "sri lanka", "pakistan", "kyrgyzstan", "kazakhstan",
  "jordan", "petra", "wadi rum", "oman", "muscat",
  "iceland", "reykjavik", "reykjavík", "faroe islands", "svalbard", "lofoten", "tromso",
  "norway", "bergen", "scotland", "highlands", "ireland",
  "dolomites", "innsbruck", "interlaken", "zermatt", "chamonix",
  "slovenia", "lake bled", "albania", "montenegro", "kotor",
  "georgia", "tbilisi", "armenia", "azerbaijan",
  "azores", "madeira", "canary islands",
  "easter island",
  "new zealand", "queenstown", "milford sound", "rotorua", "auckland",
  "australia", "cairns", "great barrier reef", "uluru", "tasmania", "perth", "brisbane", "adelaide",
  "fiji", "vanuatu",
  "asheville", "santa fe", "calgary", "salt lake city",
];

const CULTURAL_KEYWORDS = [
  "rome", "paris", "athens", "istanbul", "cairo", "jerusalem", "tel aviv",
  "florence", "venice", "milan", "naples", "sicily",
  "madrid", "barcelona", "seville", "granada", "lisbon", "porto",
  "amsterdam", "bruges", "brussels", "berlin", "munich", "prague",
  "krakow", "warsaw", "budapest", "vienna", "salzburg",
  "london", "edinburgh", "dublin",
  "kyoto", "osaka", "nara", "hiroshima", "beijing",
  "seoul", "shanghai", "bangkok", "kuala lumpur",
  "delhi", "agra", "jaipur", "mumbai", "varanasi", "bengaluru", "chennai", "kolkata", "udaipur",
  "marrakech", "marrakesh", "fez", "casablanca", "tunis", "luxor", "aswan",
  "mexico city", "oaxaca", "havana", "cartagena", "quito",
  "lima", "la paz", "montevideo",
  "saint petersburg", "moscow", "riga", "tallinn", "vilnius", "helsinki",
  "stockholm", "oslo",
  "bordeaux", "luxembourg", "malta", "glasgow", "manchester",
  "new orleans", "nashville", "charleston", "san antonio",
  "washington", "quebec", "québec",
  "austin", "santa fe", "asheville", "memphis", "kansas city",
  "st. louis", "minneapolis", "charlotte", "detroit", "pittsburgh",
];

const RELAXATION_KEYWORDS = [
  "cancun", "cancún", "cabo", "los cabos", "puerto vallarta", "playa del carmen",
  "tulum", "cozumel", "riviera maya", "bahamas", "nassau", "aruba",
  "curacao", "curaçao", "barbados", "jamaica", "montego bay", "punta cana", "dominican republic",
  "antigua", "grenada", "san juan", "goa", "fort lauderdale",
  "dominica", "bermuda", "miami", "palm springs", "tampa",
  "hawaii", "honolulu", "waikiki", "maui", "kauai", "big island",
  "bali", "phuket", "samui", "krabi",
  "maldives", "seychelles", "mauritius", "zanzibar",
  "miami beach", "key west", "florida keys", "clearwater",
  "santorini", "mykonos", "crete", "corfu", "rhodes",
  "mallorca", "ibiza", "tenerife", "gran canaria",
  "algarve", "madeira", "azores",
  "nice", "cannes", "saint tropez", "french riviera",
  "dubrovnik", "split", "hvar", "kotor",
  "fiji", "tahiti", "bora bora", "moorea", "french polynesia",
];

const FAMILY_KEYWORDS = [
  "orlando", "disney", "disneyland", "universal studios",
  "anaheim", "san diego", "san francisco", "los angeles", "new york", "chicago",
  "washington", "boston", "philadelphia", "atlanta",
  "dallas", "houston", "denver", "seattle", "portland",
  "phoenix", "las vegas", "nashville", "new orleans", "charleston", "san antonio", "baltimore",
  "fort lauderdale", "san juan", "austin", "jacksonville", "kansas city", "miami",
  "palm springs", "minneapolis", "st. louis", "calgary", "indianapolis",
  "salt lake city", "tampa", "charlotte", "detroit", "pittsburgh",
  "cancun", "cancún", "cabo", "los cabos", "puerto vallarta", "punta cana",
  "bahamas", "nassau", "aruba", "jamaica", "hawaii", "honolulu", "maui",
  "london", "paris", "amsterdam", "barcelona", "rome",
  "tokyo", "singapore", "hong kong", "sydney", "melbourne",
  "toronto", "vancouver", "montreal", "banff",
  "auckland", "brisbane", "adelaide", "perth",
  "glasgow", "manchester", "quebec", "québec",
];

export function classifyDeal(deal: {
  destination?: string;
  price?: number;
  discount_pct?: number;
  deal_type?: string | null;
}): string[] {
  const types = new Set<string>();
  const dest = (deal.destination || "").toLowerCase();
  const price = deal.price || 0;
  const discount = deal.discount_pct || 0;
  const apiType = (deal.deal_type || "").toLowerCase();

  if (apiType === "budget") types.add("budget");
  if (apiType === "luxury") types.add("luxury");
  if (apiType === "adventure") types.add("adventure");
  if (apiType === "cultural") types.add("cultural");
  if (apiType === "relaxation") types.add("relaxation");
  if (apiType === "family") types.add("family");

  if (price > 0 && price <= 350) types.add("budget");
  if (discount >= 35) types.add("budget");
  if (price >= 800 || LUXURY_KEYWORDS.some((k) => dest.includes(k)))
    types.add("luxury");
  if (ADVENTURE_KEYWORDS.some((k) => dest.includes(k))) types.add("adventure");
  if (CULTURAL_KEYWORDS.some((k) => dest.includes(k))) types.add("cultural");
  if (RELAXATION_KEYWORDS.some((k) => dest.includes(k)))
    types.add("relaxation");
  if (FAMILY_KEYWORDS.some((k) => dest.includes(k))) types.add("family");

  return Array.from(types);
}

export function dealMatchesType(
  deal: { destination?: string; price?: number; discount_pct?: number; deal_type?: string | null },
  type: string
): boolean {
  return classifyDeal(deal).includes(type);
}
