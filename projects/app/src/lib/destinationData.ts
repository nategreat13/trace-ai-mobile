import { Deal } from "@trace/shared";

export interface DestinationInfo {
  essentials: {
    flag?: string;
    currency?: string;
    language?: string;
    timezone?: string;
    plug?: string;
    needsAdapter?: boolean;
    insiderNote?: string;
  };
  seasonalActivities?: Array<{ title: string; description: string }>;
  neighborhoods: Array<{
    name: string;
    emoji: string;
    vibe: string;
    description: string;
  }>;
  attractions: Array<{ name: string; emoji: string }>;
  dining: {
    budget: Array<{ name: string; type: string }>;
    moderate: Array<{ name: string; type: string }>;
    premium: Array<{ name: string; type: string }>;
  };
  dayTrips: Array<{ name: string; emoji: string; time: string }>;
  gettingAround: Array<{
    icon: string;
    mode: string;
    tip: string;
    cost?: string;
  }>;
}

const DESTINATIONS: Record<string, DestinationInfo> = {
  london: {
    essentials: {
      flag: "🇬🇧",
      currency: "British Pound (£)",
      language: "English",
      timezone: "GMT / BST (UTC+0 / UTC+1)",
      plug: "Type G (3-pin rectangular)",
      needsAdapter: true,
      insiderNote: "Tap your own bank card directly on yellow Oyster readers — daily price caps apply automatically. No need to buy an Oyster card.",
    },
    neighborhoods: [
      { name: "Shoreditch", emoji: "🎨", vibe: "Creative & edgy", description: "East London's creative hub. Brick Lane has the best bagels in the city — Beigel Bake vs Beigel Shop, pick a side. Sundays bring the market crowds, weekdays are better for gallery hopping and coffee." },
      { name: "Notting Hill", emoji: "🌸", vibe: "Charming & colourful", description: "The pastel-coloured terraced houses are the real draw, not Portobello Road market (which is packed on Saturdays). Come on a Friday morning for actual bargains from the antique dealers." },
      { name: "Bermondsey", emoji: "🍺", vibe: "Food & drink scene", description: "The Bermondsey Beer Mile has 20+ craft breweries in walking distance. Maltby Street Market on Saturday mornings is far better than Borough Market for quality without the tourist crush." },
      { name: "Marylebone", emoji: "☕", vibe: "Village-within-the-city", description: "The high street has independent shops that survived the chains. Daunt Books is the most beautiful bookshop in London. Quieter and more residential than the tourist circuit." },
    ],
    attractions: [
      { name: "Tate Modern", emoji: "🖼️" },
      { name: "Borough Market", emoji: "🥐" },
      { name: "Victoria & Albert Museum", emoji: "🏛️" },
      { name: "Columbia Road Flower Market", emoji: "🌹" },
      { name: "St. Paul's Cathedral", emoji: "⛪" },
      { name: "Kew Gardens", emoji: "🌿" },
    ],
    dining: {
      budget: [
        { name: "Beigel Bake", type: "24hr bakery, Brick Lane" },
        { name: "Bao Borough", type: "Taiwanese steamed buns" },
        { name: "Dishoom (lunch)", type: "Bombay café — long waits, worth it" },
      ],
      moderate: [
        { name: "St. John Bread & Wine", type: "British nose-to-tail cooking" },
        { name: "Barrafina", type: "Counter-only Spanish tapas" },
        { name: "The Wolseley", type: "Grand European café, great for breakfast" },
      ],
      premium: [
        { name: "Sketch", type: "Multi-room avant-garde British" },
        { name: "The Ledbury", type: "Two-Michelin-star modern British" },
        { name: "Kiln", type: "Thai wood-fire cooking, Soho" },
      ],
    },
    dayTrips: [
      { name: "Bath", emoji: "🏛️", time: "1.5 hrs by train" },
      { name: "Stonehenge", emoji: "🪨", time: "2 hrs by train + shuttle" },
      { name: "Brighton", emoji: "🎡", time: "1 hr by train" },
      { name: "Oxford", emoji: "📚", time: "1 hr by train" },
    ],
    gettingAround: [
      { icon: "💳", mode: "Contactless card", tip: "Tap your own bank card on yellow readers — no Oyster card needed. Daily and weekly price caps apply automatically so you never overpay. Works on Tube, bus, Overground, and Elizabeth line.", cost: "Capped at ~£8.10/day in Zones 1–2" },
      { icon: "🚤", mode: "Thames Clipper", tip: "The RB1 river bus from Embankment to Greenwich is the city's most underused transport. Same price as the Tube, never crowded, runs every 20 minutes, and the views of the City and Canary Wharf are unbeatable.", cost: "Same as Tube fare" },
    ],
  },

  paris: {
    essentials: {
      flag: "🇫🇷",
      currency: "Euro (€)",
      language: "French",
      timezone: "CET / CEST (UTC+1 / UTC+2)",
      plug: "Type E (2-pin round with hole)",
      needsAdapter: true,
      insiderNote: "Get a carnet of 10 metro tickets — far cheaper per ride than singles. Tap-to-pay now works on Paris Metro with contactless cards.",
    },
    neighborhoods: [
      { name: "Le Marais", emoji: "🏰", vibe: "Historic & hip", description: "The best neighbourhood to simply wander. Jewish quarter on Rue des Rosiers has some of the best falafel in Europe (L'As du Fallafel, always a queue). Free museums like Musée Carnavalet are tucked in side streets." },
      { name: "Canal Saint-Martin", emoji: "🛶", vibe: "Bobo & relaxed", description: "Where Parisians actually hang out on weekends. Picnic along the canal with wine from the local épicerie — far better than fighting for space at Champ de Mars." },
      { name: "Belleville", emoji: "🎭", vibe: "Multicultural & creative", description: "The real working-class Paris that tourists rarely find. Saturday morning at Marché de Belleville is an authentic market experience. Best views of the city from Parc de Belleville." },
      { name: "Batignolles", emoji: "☕", vibe: "Village neighbourhood", description: "Where local Parisians grocery shop and have their café. Marché des Batignolles on Saturday morning is organic and excellent. No tourist trap restaurants here." },
    ],
    attractions: [
      { name: "Musée d'Orsay", emoji: "🖼️" },
      { name: "Sainte-Chapelle", emoji: "🪟" },
      { name: "Palais Royal Gardens", emoji: "🌳" },
      { name: "Père Lachaise Cemetery", emoji: "🕊️" },
      { name: "Centre Pompidou", emoji: "🏗️" },
      { name: "Marché d'Aligre", emoji: "🥦" },
    ],
    dining: {
      budget: [
        { name: "L'As du Fallafel", type: "Legendary falafel, Le Marais" },
        { name: "Marché d'Aligre", type: "Best market in Paris, every morning except Monday" },
        { name: "Bouillon Chartier", type: "100-year-old brasserie, fixed cheap menu" },
      ],
      moderate: [
        { name: "Septime", type: "Bistronomie pioneer — book weeks ahead" },
        { name: "Le Servan", type: "Asian-French fusion, 11th arr." },
        { name: "Bistrot Paul Bert", type: "The benchmark Paris bistro" },
      ],
      premium: [
        { name: "Le Grand Véfour", type: "Napoleon-era dining room, Palais Royal" },
        { name: "Frenchie", type: "Modern French, internationally acclaimed" },
        { name: "Saturne", type: "Natural wine + seasonal tasting menu" },
      ],
    },
    dayTrips: [
      { name: "Versailles", emoji: "🏯", time: "40 min by RER C" },
      { name: "Giverny (Monet's Garden)", emoji: "🌷", time: "1.5 hrs by train + bus" },
      { name: "Reims", emoji: "🥂", time: "45 min by TGV" },
      { name: "Loire Valley Châteaux", emoji: "🏰", time: "1 hr by TGV to Tours" },
    ],
    gettingAround: [
      { icon: "🚇", mode: "Métro", tip: "14 lines cover virtually the entire city. Get a carnet of 10 tickets or use a contactless bank card. Line 1 and 14 are fully automated — always a seat mid-day. Avoid lines 4, 13 at rush hour.", cost: "~€2.15/ride, carnet discounts available" },
      { icon: "🚲", mode: "Vélib' bike-share", tip: "Electric bikes are the best-kept secret for distances too far to walk but awkward for metro. The app shows real-time bike availability. The Seine riverside cycle paths are almost entirely car-free.", cost: "€5 for 24-hr pass, first 30 min free" },
    ],
  },

  tokyo: {
    essentials: {
      flag: "🇯🇵",
      currency: "Japanese Yen (¥)",
      language: "Japanese",
      timezone: "JST (UTC+9)",
      plug: "Type A (2-pin flat, same as US)",
      needsAdapter: false,
      insiderNote: "Load a Suica card at any JR machine — it works on every train, subway, bus, and at most convenience stores and vending machines. Cash is still king at many restaurants.",
    },
    neighborhoods: [
      { name: "Shimokitazawa", emoji: "🎸", vibe: "Bohemian & nostalgic", description: "Tokyo's answer to Brooklyn. Record shops, vintage clothing, tiny live music venues, and coffee bars in repurposed buildings. No chains, no tourists. Best on a Sunday afternoon." },
      { name: "Yanaka", emoji: "🏮", vibe: "Old Tokyo preserved", description: "One of the few neighbourhoods that survived WWII bombing. The shotengai (covered shopping street) hasn't changed since the 1960s. The cemetery is serene and cats roam freely." },
      { name: "Nakameguro", emoji: "🌸", vibe: "Trendy & beautiful", description: "The canal lined with cherry trees is the most photographed place in Tokyo during sakura season. Lined with independent concept stores, coffee roasters, and Japanese designers. The alley food stalls are excellent." },
      { name: "Koenji", emoji: "🎭", vibe: "Counter-culture", description: "Where Tokyo's musicians, artists, and subcultures live. Surreal vintage shops, jazz bars, and live houses. The antique market is held every other Sunday and has incredible finds." },
    ],
    attractions: [
      { name: "Tsukiji Outer Market", emoji: "🐟" },
      { name: "teamLab Borderless", emoji: "💡" },
      { name: "Meiji Shrine at Dawn", emoji: "⛩️" },
      { name: "Shinjuku Golden Gai", emoji: "🏮" },
      { name: "Hamarikyu Gardens", emoji: "🌿" },
      { name: "Nezu Shrine", emoji: "🦊" },
    ],
    dining: {
      budget: [
        { name: "Ichiran Ramen", type: "Solo booth ramen, 24hrs, everywhere" },
        { name: "Any 7-Eleven onigiri", type: "Genuinely excellent convenience store food" },
        { name: "Katsukura (lunch set)", type: "Famous tonkatsu chain, affordable lunch" },
      ],
      moderate: [
        { name: "Sushi Saito (if you can book)", type: "Best sushi in Tokyo by most accounts" },
        { name: "Den", type: "Playful modern Japanese kaiseki" },
        { name: "Narisawa", type: "Innovative 'Satoyama' cuisine" },
      ],
      premium: [
        { name: "Sukiyabashi Jiro Honten", type: "Legendary 10-seat omakase" },
        { name: "RyuGin", type: "Three Michelin stars, traditional kaiseki" },
        { name: "L'Effervescence", type: "Japanese-French, Nishiazabu" },
      ],
    },
    dayTrips: [
      { name: "Nikko", emoji: "⛩️", time: "2 hrs by train" },
      { name: "Kamakura", emoji: "🪷", time: "1 hr by train" },
      { name: "Hakone (Mt. Fuji views)", emoji: "🗻", time: "1.5 hrs by Romancecar" },
      { name: "Kyoto", emoji: "🏯", time: "2.5 hrs by Shinkansen" },
    ],
    gettingAround: [
      { icon: "💳", mode: "Suica IC card", tip: "Load it at any JR Green machine — tap in and tap out on every subway line, JR train, bus, and monorail. The card also works at 7-Eleven, Lawson, Family Mart, and most vending machines so you rarely need cash for small purchases.", cost: "Pay-as-you-go, no markup vs. cash fares" },
      { icon: "🚶", mode: "Walking between neighbourhoods", tip: "Tokyo's subway map looks terrifying but the neighbourhoods are deceptively close. Shimokitazawa to Nakameguro is a 20-minute walk through residential side streets that most tourists skip entirely. Google Maps walking directions are excellent.", cost: "Free" },
    ],
  },

  bali: {
    essentials: {
      flag: "🇮🇩",
      currency: "Indonesian Rupiah (Rp)",
      language: "Balinese / Indonesian",
      timezone: "WITA (UTC+8)",
      plug: "Type C & F (2-pin round)",
      needsAdapter: true,
      insiderNote: "ATMs dispense large bills but many warungs only have change for small ones. Withdraw Rp 500,000 notes and ask for Rp 50,000s when you can. Grab app is the only reliable way to get fair taxi prices.",
    },
    neighborhoods: [
      { name: "Canggu", emoji: "🏄", vibe: "Surf & digital nomad", description: "The place that replaced Seminyak for the younger crowd. Echo Beach has the surf breaks, Batu Bolong Street has the cafés. Can feel like Instagram-land on weekends — weekday mornings are when it's actually pleasant." },
      { name: "Ubud", emoji: "🌿", vibe: "Art & nature", description: "The cultural centre of Bali. Skip the Monkey Forest (it's crowded and aggressive monkeys aren't charming). The rice terrace walks around Tegallalang at dawn before the tour groups arrive are genuinely spectacular." },
      { name: "Seminyak", emoji: "🍹", vibe: "Upmarket beach town", description: "Better restaurants and beach clubs than Kuta without the Kuta chaos. Ku De Ta and Potato Head are the classic sunset spots — arrive early, the good spots go fast. Eat at Sardine for a genuinely great meal." },
      { name: "Amed", emoji: "🤿", vibe: "Quiet & diving", description: "Three hours from Ubud but a different world. Black sand beaches, the USAT Liberty wreck dive is 10 minutes from shore, and none of the southern Bali crowds. This is the Bali that existed before Instagram." },
    ],
    attractions: [
      { name: "Tegallalang Rice Terraces at Dawn", emoji: "🌾" },
      { name: "Pura Lempuyang Temple", emoji: "⛩️" },
      { name: "ARMA Museum", emoji: "🎨" },
      { name: "Munduk Waterfall Trek", emoji: "💧" },
      { name: "Jatiluwih Rice Fields (UNESCO)", emoji: "🌿" },
      { name: "Uluwatu Temple at Sunset", emoji: "🌅" },
    ],
    dining: {
      budget: [
        { name: "Warung Men Tempeh", type: "Classic warung, Ubud locals eat here" },
        { name: "Clear Café", type: "Healthy vegetarian, Ubud" },
        { name: "Babi Guling Ibu Oka", type: "Famous suckling pig, Ubud" },
      ],
      moderate: [
        { name: "Mozaic", type: "Long-running upscale garden dining, Ubud" },
        { name: "Sardine", type: "Fish and seafood in a rice field setting, Seminyak" },
        { name: "Locavore", type: "Best tasting menu on the island, Ubud" },
      ],
      premium: [
        { name: "Locavore (tasting menu)", type: "Indonesian-sourced fine dining" },
        { name: "Métis", type: "French-Mediterranean, Seminyak" },
        { name: "Merah Putih", type: "Regional Indonesian in a stunning space" },
      ],
    },
    dayTrips: [
      { name: "Mount Batur Sunrise Trek", emoji: "🌋", time: "2 hrs from Ubud, pre-dawn start" },
      { name: "Nusa Penida Island", emoji: "🦅", time: "45 min fast boat from Sanur" },
      { name: "Tanah Lot Temple", emoji: "🌊", time: "1 hr from Seminyak" },
      { name: "Sidemen Valley", emoji: "🌄", time: "1.5 hrs from Ubud" },
    ],
    gettingAround: [
      { icon: "📱", mode: "Grab app", tip: "The only reliable way to get fair prices. Always use the app rather than hailing a taxi — metered taxis are rare and unmetered ones will quote tourist prices. Grab covers Uber-style cars and motorbike taxis (GoJek also works).", cost: "Kuta→Ubud roughly Rp 200,000" },
      { icon: "🛵", mode: "Scooter rental", tip: "The local way to get around — cheap, fast, and the only way to reach many surf spots and viewpoints. International driving licence technically required but rarely checked. Traffic drives on the left. Avoid riding at night.", cost: "Rp 70,000–120,000/day" },
    ],
  },

  bangkok: {
    essentials: {
      flag: "🇹🇭",
      currency: "Thai Baht (฿)",
      language: "Thai",
      timezone: "ICT (UTC+7)",
      plug: "Type A, B & C (most sockets accept flat 2-pin US plugs)",
      needsAdapter: false,
      insiderNote: "Bangkok has three overlapping rail systems (BTS Skytrain, MRT subway, Airport Rail Link) — buy separate cards for each or use a rabbit card for BTS. Tuk-tuks are overpriced and for tourists; songthaews (red trucks) are cheap and what locals use.",
    },
    neighborhoods: [
      { name: "Ari", emoji: "☕", vibe: "Local cool", description: "Where Bangkok's younger creative class lives and eats. No temples, no tourist traps — just excellent coffee shops, small restaurants, and a Saturday farmers market. This is the Bangkok that exists behind the tourist circuit." },
      { name: "Charoen Krung", emoji: "🏮", vibe: "Old city reinvented", description: "Bangkok's oldest street has been quietly gentrifying for a decade. TCDC creative space, Warehouse 30 mixed-use complex, and tiny roaster cafés sit alongside century-old shophouses. Best explored on foot." },
      { name: "Thonglor", emoji: "🍸", vibe: "Upscale & nightlife", description: "The address of Bangkok's high-end restaurants and rooftop bars. More expensive than the tourist areas, but the quality of food and service is significantly higher. Sukhumvit Soi 55 at midnight is unlike anywhere else." },
      { name: "Rattanakosin Island", emoji: "⛩️", vibe: "Historic core", description: "The original city — Grand Palace, Wat Pho, Wat Arun — and genuinely unmissable. Go at opening time (8am) before the tour buses. Wear long trousers and a shirt with sleeves or you'll be turned away at the Grand Palace gates." },
    ],
    attractions: [
      { name: "Wat Pho (Reclining Buddha)", emoji: "🙏" },
      { name: "Damnoen Saduak Floating Market", emoji: "🛶" },
      { name: "Jim Thompson House", emoji: "🏡" },
      { name: "Chatuchak Weekend Market", emoji: "🛍️" },
      { name: "Lumphini Park at Dawn", emoji: "🌅" },
      { name: "Or Tor Kor Market", emoji: "🥭" },
    ],
    dining: {
      budget: [
        { name: "Jay Fai", type: "Street food legend, crab omelette (book or queue)" },
        { name: "Jok Prince", type: "Rice congee breakfast since 1950s" },
        { name: "Or Tor Kor Market", type: "Best quality fresh market food in Bangkok" },
      ],
      moderate: [
        { name: "Bo.lan", type: "Royal Thai cuisine, sustainably sourced" },
        { name: "Nahm", type: "Definitive traditional Thai tasting menu" },
        { name: "Baan Phadthai", type: "Refined pad thai in beautiful setting" },
      ],
      premium: [
        { name: "Le Du", type: "Thai-French, Asia's 50 Best perennial" },
        { name: "Gaggan Anand", type: "Progressive Indian-Thai, theatrical" },
        { name: "Saawaan", type: "Michelin-starred traditional Thai" },
      ],
    },
    dayTrips: [
      { name: "Ayutthaya", emoji: "🏛️", time: "1.5 hrs by train" },
      { name: "Kanchanaburi (Bridge on the River Kwai)", emoji: "🌉", time: "2.5 hrs by train" },
      { name: "Amphawa Floating Market", emoji: "🛶", time: "1.5 hrs by minivan" },
      { name: "Khao Yai National Park", emoji: "🐘", time: "3 hrs by bus" },
    ],
    gettingAround: [
      { icon: "🚇", mode: "BTS Skytrain + MRT", tip: "Air-conditioned, reliable, and covers all the major areas tourists need (Sukhumvit, Silom, Siam, river). Buy a rabbit card for BTS and load it as you go — far cheaper than single-journey tickets. Avoid taxis during rush hour (7–9am, 5–8pm) — trains are faster.", cost: "฿16–44 per journey" },
      { icon: "⛵", mode: "Chao Phraya Express Boat", tip: "The fastest way to travel along the river and access the historic temples. Orange flag boats are the local service — cheap and goes everywhere. Don't take the tourist boats (overpriced). The Khlong Saen Saeb canal boat is also excellent for east-west travel.", cost: "฿15–32 per trip" },
    ],
  },

  barcelona: {
    essentials: {
      flag: "🇪🇸",
      currency: "Euro (€)",
      language: "Catalan / Spanish",
      timezone: "CET / CEST (UTC+1 / UTC+2)",
      plug: "Type F (2-pin round)",
      needsAdapter: true,
      insiderNote: "Book Sagrada Família and Park Güell tickets online weeks in advance — they sell out and the queues without tickets are brutal. Buy a T-Casual metro card (10 trips, sharable) at any metro station.",
    },
    neighborhoods: [
      { name: "El Born", emoji: "🍷", vibe: "Medieval cool", description: "The best neighbourhood in the city for eating and drinking. The Basque pintxos bars on Carrer del Parlament are extraordinary value. The Mercat de Santa Caterina (less famous than Boqueria, zero tourist mob) is where locals actually shop." },
      { name: "Gràcia", emoji: "🌺", vibe: "Village within the city", description: "Where Barcelona's artists, students, and long-term residents live. The plaças (squares) fill up every evening for the aperitivo hour. Bar Canigó has been serving vermouth since 1922. Feels like a completely different city from the Ramblas." },
      { name: "Poblenou", emoji: "🏭", vibe: "Industrial creative", description: "The new creative district in the former industrial zone. Rambla del Poblenou is a local version of Las Ramblas without a single tourist. The beach at the end is less packed than Barceloneta. Great for brunch spots and concept bars." },
      { name: "Sarrià-Sant Gervasi", emoji: "🏔️", vibe: "Uphill & residential", description: "Take the FGC train up to this quiet, wealthy neighbourhood for the best views of the city. The Tibidabo amusement park at the top is charmingly retro. Locals hike up here on weekends — much quieter than Montjuïc." },
    ],
    attractions: [
      { name: "Sagrada Família (pre-book)", emoji: "⛪" },
      { name: "Mercat de Santa Caterina", emoji: "🥩" },
      { name: "Fundació Joan Miró", emoji: "🎨" },
      { name: "Palau de la Música Catalana", emoji: "🎶" },
      { name: "Park Güell (pre-book)", emoji: "🦎" },
      { name: "Bunkers del Carmel at Sunset", emoji: "🌇" },
    ],
    dining: {
      budget: [
        { name: "Bar Canigó", type: "Vermouth and pintxos since 1922, Gràcia" },
        { name: "El Xampanyet", type: "Classic tapas bar, El Born" },
        { name: "Mercat de Santa Caterina", type: "Market stalls, locals only" },
      ],
      moderate: [
        { name: "Bar Cañete", type: "Refined tapas at the marble bar" },
        { name: "La Pepita", type: "Creative montaditos, always packed" },
        { name: "Bodega Cañete", type: "Catalan wine bar, serious selection" },
      ],
      premium: [
        { name: "Disfrutar", type: "World's #1 restaurant 2024, avant-garde" },
        { name: "Tickets", type: "Albert Adrià tapas bar, book months ahead" },
        { name: "Alkimia", type: "Michelin-starred modern Catalan" },
      ],
    },
    dayTrips: [
      { name: "Montserrat", emoji: "⛰️", time: "1 hr by train + cable car" },
      { name: "Sitges", emoji: "🏖️", time: "35 min by train" },
      { name: "Tarragona", emoji: "🏛️", time: "1 hr by train" },
      { name: "Penedès Wine Region", emoji: "🍇", time: "45 min by train" },
    ],
    gettingAround: [
      { icon: "🚇", mode: "Metro + FGC", tip: "A T-Casual card gives 10 trips sharable between people — buy at any metro station. Zone 1 covers the entire city including Gràcia, Sarrià, and Poblenou. Line 3 (green) connects most of the major sights. FGC trains head up to the upper neighbourhoods and Tibidabo.", cost: "€11.35 for 10-trip T-Casual card" },
      { icon: "🚲", mode: "Bicing / rental bike", tip: "The city is largely flat along the waterfront and the Eixample grid — perfect for cycling. Bicing is the locals' bike-share (needs local registration), but rental shops near the waterfront are easy to find. The seafront cycle path from Barceloneta to Forum is excellent.", cost: "~€10–15/day to rent" },
    ],
  },

  rome: {
    essentials: {
      flag: "🇮🇹",
      currency: "Euro (€)",
      language: "Italian",
      timezone: "CET / CEST (UTC+1 / UTC+2)",
      plug: "Type F / Type L (2-pin and 3-pin Italian)",
      needsAdapter: true,
      insiderNote: "Book Vatican Museums and Colosseum online — walk-up queues can be 2+ hours. Coffee culture is sacred: stand at the bar, order un caffè (espresso), pay at the cassa first in busy places.",
    },
    neighborhoods: [
      { name: "Trastevere", emoji: "🌿", vibe: "Romantic & local", description: "The medieval neighbourhood that feels like a village. Best in the morning before the tour groups arrive — grab cornetto and cappuccino at Bar San Calisto. The evening aperitivo scene is genuinely local, not performed for tourists." },
      { name: "Pigneto", emoji: "🎸", vibe: "Working class cool", description: "Pasolini's old neighbourhood is Rome's creative district now. No tourist restaurants — just neighbourhood trattorias, craft beer bars, and the locals who've lived here for generations. The Sunday market is excellent." },
      { name: "Prati", emoji: "🛍️", vibe: "Elegant & residential", description: "Directly across the river from Vatican City — great base for Vatican visits but away from tourist trap restaurants. The Mercato Trionfale food market on Via Andrea Doria is one of Rome's best and almost entirely unknown to visitors." },
      { name: "Testaccio", emoji: "🥩", vibe: "Food quarter", description: "Rome's original food neighbourhood, built around the old slaughterhouse. Mercato Testaccio is the best food market in the city. Home to the original supplì (fried rice balls) at Supplì Roma. Locals have eaten here for generations." },
    ],
    attractions: [
      { name: "Borghese Gallery (book 2 weeks ahead)", emoji: "🗿" },
      { name: "Mercato Testaccio", emoji: "🥩" },
      { name: "Pantheon (early morning)", emoji: "🏛️" },
      { name: "Appian Way (Via Appia Antica)", emoji: "🛕" },
      { name: "Castel Sant'Angelo", emoji: "🏰" },
      { name: "Campo de' Fiori Market", emoji: "🌸" },
    ],
    dining: {
      budget: [
        { name: "Supplì Roma", type: "Best supplì in the city, Testaccio" },
        { name: "Tonnarello", type: "Old-school trattoria, Trastevere" },
        { name: "Mercato Testaccio stalls", type: "Market food by the people who make it" },
      ],
      moderate: [
        { name: "Flavio al Velavevodetto", type: "Roman classics dug into the Testaccio hill" },
        { name: "Da Enzo al 29", type: "The platonic ideal of a Roman trattoria" },
        { name: "Roscioli", type: "Salumeria, wine bar, and serious pasta" },
      ],
      premium: [
        { name: "Il Pagliaccio", type: "Two Michelin stars, modern Italian" },
        { name: "Idylio by Apreda", type: "Panoramic fine dining, Prati" },
        { name: "La Pergola", type: "Only 3-star Michelin in Rome" },
      ],
    },
    dayTrips: [
      { name: "Pompeii & Naples", emoji: "🌋", time: "2–2.5 hrs by high-speed train" },
      { name: "Orvieto", emoji: "⛪", time: "1 hr by train" },
      { name: "Tivoli (Hadrian's Villa)", emoji: "🏛️", time: "1 hr by bus" },
      { name: "Ostia Antica", emoji: "🏺", time: "30 min by train" },
    ],
    gettingAround: [
      { icon: "🚌", mode: "Walking + bus", tip: "Rome's metro only has 3 lines and misses most of the historic centre (archaeological sites prevent tunnelling). Walking between monuments is often faster than transit. The 40 and 64 buses connect Termini station to Vatican and the historic core — buy a 100-min ticket from a tobacconist.", cost: "€1.50 per 100-min ticket" },
      { icon: "🛵", mode: "Scooter rental", tip: "The Roman way. Renting a scooter for half a day lets you reach the Appian Way, Trastevere, and Pigneto without waiting for buses. Hundreds of rental shops near Termini station. Traffic is chaotic but slower than it looks.", cost: "~€40–60/half day" },
    ],
  },

  amsterdam: {
    essentials: {
      flag: "🇳🇱",
      currency: "Euro (€)",
      language: "Dutch (everyone speaks English)",
      timezone: "CET / CEST (UTC+1 / UTC+2)",
      plug: "Type F (2-pin round)",
      needsAdapter: true,
      insiderNote: "OV-chipkaart is the transit card — load it at any station. Alternatively, tap your bank card directly on card readers at metro and tram gates. Bikes have absolute right of way; if you rent one, check mirrors before turning.",
    },
    neighborhoods: [
      { name: "De Pijp", emoji: "🌍", vibe: "Multicultural & market", description: "The Albert Cuypmarkt runs through the heart of it every morning — the best street market in Amsterdam for cheap lunches and street food. Surinamese and Indonesian restaurants line the side streets. Real locals' neighbourhood." },
      { name: "Jordaan", emoji: "🌷", vibe: "Picturesque & artsy", description: "The postcard Amsterdam of canals and brown cafés. Best explored on foot with no plan. Noordermarkt on Saturday has organic food and antiques. The Anne Frank House is here — book tickets 2 months ahead online." },
      { name: "NDSM Wharf", emoji: "🏭", vibe: "Industrial creative", description: "Take the free ferry behind Centraal Station to reach this former shipyard turned arts district. Massive studios, street art, a flea market on weekends, and IJ-hallen (Europe's largest indoor flea market, monthly). Far from the tourist crowds." },
      { name: "Oud-West", emoji: "☕", vibe: "Neighbourhood cool", description: "Where Amsterdam's designers, chefs, and creatives actually live. Ten Whyte coffee roaster, Foodhallen food hall (locals actually go here), and the best independent bookshops in the city." },
    ],
    attractions: [
      { name: "Rijksmuseum", emoji: "🖼️" },
      { name: "Albert Cuypmarkt", emoji: "🛒" },
      { name: "Foam Photography Museum", emoji: "📷" },
      { name: "EYE Film Institute", emoji: "🎬" },
      { name: "Anne Frank House (pre-book)", emoji: "📖" },
      { name: "IJ-hallen Flea Market (monthly)", emoji: "🗃️" },
    ],
    dining: {
      budget: [
        { name: "FEBO automat", type: "Dutch fast food institution, croquettes" },
        { name: "Albert Cuypmarkt herring stand", type: "Raw herring, local tradition" },
        { name: "Foodhallen", type: "Food hall that locals actually use, Oud-West" },
      ],
      moderate: [
        { name: "Breda", type: "Beautiful Dutch seasonal cooking" },
        { name: "Guts & Glory", type: "Rotating concept, always a single theme" },
        { name: "De Kas", type: "Farm-to-table in a 1926 greenhouse" },
      ],
      premium: [
        { name: "Restaurant Breda", type: "Sophisticated modern Dutch" },
        { name: "Librije's Zusje Amsterdam", type: "Michelin-starred hotel restaurant" },
        { name: "Vinkeles", type: "Intimate fine dining in historic canal house" },
      ],
    },
    dayTrips: [
      { name: "Keukenhof Gardens (spring only)", emoji: "🌷", time: "45 min by bus" },
      { name: "Zaanse Schans Windmills", emoji: "⚙️", time: "30 min by train" },
      { name: "Haarlem", emoji: "🏡", time: "20 min by train" },
      { name: "Utrecht", emoji: "🏰", time: "30 min by train" },
    ],
    gettingAround: [
      { icon: "🚲", mode: "Bicycle", tip: "This is the only honest recommendation — the city is built for bikes and nearly everything is within cycling distance. MacBike and Orangebike are reliable rental shops near Centraal. Ride in the designated bike lanes (the red-paved strips), never on pavements. Check mirrors before turning — bikes have absolute right of way.", cost: "~€15–20/day to rent" },
      { icon: "🚢", mode: "Free ferry across the IJ", tip: "The free ferries behind Centraal Station run 24 hours and cross to the north bank in 5 minutes. Essential for reaching NDSM Wharf and the developing A'DAM creative district. Most tourists never take them.", cost: "Free" },
    ],
  },

  cancun: {
    essentials: {
      flag: "🇲🇽",
      currency: "Mexican Peso (MXN)",
      language: "Spanish",
      timezone: "EST (UTC-5, no DST)",
      plug: "Type A & B (same as US)",
      needsAdapter: false,
      insiderNote: "Pay in pesos everywhere — the 'dollar price' at tourist areas has a terrible exchange rate built in. The R1 bus (8 pesos) runs the entire Hotel Zone and is how locals navigate. Cenotes require cash.",
    },
    neighborhoods: [
      { name: "Isla Mujeres", emoji: "🏝️", vibe: "Laid-back island", description: "Take the ferry from Puerto Juárez (not the tourist ferry from the Hotel Zone — the local one is a quarter of the price). Golf carts are the main transport. Punta Norte beach on the north tip is the best beach most Cancun visitors never reach." },
      { name: "Downtown Cancún", emoji: "🌮", vibe: "Real city, real food", description: "Where the Mexican city actually is, behind the tourist zone. Mercado 28 for souvenirs at real prices, the Parque de las Palapas for evening street food where locals eat. The seafood at Los Huaraches de Alcapulco is exceptional and costs almost nothing." },
      { name: "Puerto Morelos", emoji: "🐠", vibe: "Quiet village", description: "Thirty minutes south of the airport but a world away from the Hotel Zone. The reef directly offshore is a national marine park — snorkelling directly from the beach. Fish restaurants on the square serve the day's catch. No nightclubs." },
      { name: "Tulum Pueblo", emoji: "🌴", vibe: "Authentic vs. Instagram", description: "The town itself (not the beach road) is where the workers who serve the boutique hotels live. Excellent taco spots and local cenotes that cost a fraction of the curated experiences on the hotel strip." },
    ],
    attractions: [
      { name: "Chichén Itzá (arrive at opening)", emoji: "🏛️" },
      { name: "Cenote Ik Kil", emoji: "💧" },
      { name: "Coba Mayan Ruins (still climbable)", emoji: "🗺️" },
      { name: "Akumal Bay (sea turtles)", emoji: "🐢" },
      { name: "Sian Ka'an Biosphere Reserve", emoji: "🦜" },
      { name: "Isla Contoy (boat trip)", emoji: "🦅" },
    ],
    dining: {
      budget: [
        { name: "Los Huaraches de Alcapulco", type: "Legendary downtown seafood tostadas" },
        { name: "Parque de las Palapas stalls", type: "Evening street food, locals only" },
        { name: "El Pescado Cojo", type: "Cheap beachside seafood, Isla Mujeres" },
      ],
      moderate: [
        { name: "La Fisheria", type: "Quality seafood, Hotel Zone" },
        { name: "Navios", type: "Mexican seafood with proper cocktails" },
        { name: "Tempo", type: "Tasting menu, Mandarin Oriental" },
      ],
      premium: [
        { name: "Hartwood", type: "Open-fire cooking, Tulum (book months ahead)" },
        { name: "Nicos", type: "Classic Mexican cuisine, Mexico City ex-pat favourite" },
        { name: "La Habichuela", type: "Classic Cancun upscale Maya-influenced" },
      ],
    },
    dayTrips: [
      { name: "Chichén Itzá", emoji: "🏛️", time: "2.5 hrs by bus" },
      { name: "Tulum Ruins", emoji: "🌊", time: "2 hrs by bus" },
      { name: "Valladolid + Cenote Suytun", emoji: "💎", time: "2 hrs by bus" },
      { name: "Cozumel (diving/snorkelling)", emoji: "🐡", time: "1 hr ferry from Playa del Carmen" },
    ],
    gettingAround: [
      { icon: "🚌", mode: "R1 / R2 bus", tip: "The blue public buses run the entire length of the Hotel Zone for 12 pesos (less than $1 USD) — the same route taxi drivers charge $10–20 for. R1 goes south to the end of the hotel strip, R2 loops back. Buses run until midnight.", cost: "12 pesos (~$0.60 USD)" },
      { icon: "⛵", mode: "Ferry to Isla Mujeres", tip: "Take the UltraMar ferry from Puerto Juárez rather than the tourist departure point near the hotels — it's the same boat but a quarter of the price. The island has golf cart rentals for exploring. Last ferry back is around 11pm.", cost: "$4 USD each way (local terminal)" },
    ],
  },

  dubai: {
    essentials: {
      flag: "🇦🇪",
      currency: "UAE Dirham (AED)",
      language: "Arabic (English widely spoken)",
      timezone: "GST (UTC+4)",
      plug: "Type G (3-pin rectangular, same as UK)",
      needsAdapter: true,
      insiderNote: "Alcohol is legal in licensed venues (hotels, certain restaurants) but expensive. Don't drink in public or in unlicensed places. Dress conservatively in souks and mosques — shoulders and knees covered. RTA Nol card for all transit.",
    },
    neighborhoods: [
      { name: "Al Fahidi Historical Neighbourhood", emoji: "🏛️", vibe: "Old Dubai preserved", description: "The wind tower architecture from the pre-oil era survives here. The Dubai Museum is in an 18th-century fort. Take the abra (wooden water taxi) across the Creek to the gold and spice souks for 1 dirham — the most authentic experience in the city." },
      { name: "Deira", emoji: "🌶️", vibe: "Trading city roots", description: "The oldest commercial district, where Dubai's identity as a trading port is most visible. The spice souk and gold souk are genuinely working markets, not tourist recreations. Deira's restaurants serve some of the best South Asian and Iranian food in the city at a fraction of hotel prices." },
      { name: "Jumeirah 1", emoji: "🏡", vibe: "Beach residential", description: "Where the emirate's well-off residents live behind high walls. Kite Beach is where local residents go — far less polished than JBR but genuinely local. The La Mer district along the coast has decent independent restaurants." },
      { name: "Downtown Dubai", emoji: "🏙️", vibe: "Modern spectacle", description: "The Burj Khalifa, Dubai Fountain, and Dubai Mall are all here. Overwhelming at peak hours but the fountain show after 6pm is legitimately spectacular. The observation deck tickets are expensive — the view from the Souk Al Bahar terrace across the water is free." },
    ],
    attractions: [
      { name: "Dubai Creek Abra crossing", emoji: "⛵" },
      { name: "Gold Souk & Spice Souk", emoji: "🪙" },
      { name: "Dubai Fountain (evening)", emoji: "⛲" },
      { name: "Al Quoz galleries (Alserkal Avenue)", emoji: "🎨" },
      { name: "Jumeirah Mosque (guided tour)", emoji: "🕌" },
      { name: "Desert dune drive (private, not group tour)", emoji: "🏜️" },
    ],
    dining: {
      budget: [
        { name: "Ravi Restaurant", type: "Pakistani food since 1978, Satwa" },
        { name: "Arabian Tea House", type: "Emirati breakfast, Al Fahidi" },
        { name: "Deira Fish Market restaurant", type: "Choose your fish, they cook it" },
      ],
      moderate: [
        { name: "Logma", type: "Modern Emirati food" },
        { name: "Foka", type: "North African small plates" },
        { name: "Comptoir 102", type: "Healthy café, Jumeirah" },
      ],
      premium: [
        { name: "Nobu Atlantis", type: "Classic Nobu in spectacular setting" },
        { name: "Stay by Yannick Alléno", type: "French fine dining, One&Only Palm" },
        { name: "Il Ristorante – Niko Romito", type: "Elevated Italian, Bulgari Resort" },
      ],
    },
    dayTrips: [
      { name: "Abu Dhabi (Sheikh Zayed Mosque)", emoji: "🕌", time: "1.5 hrs by bus or taxi" },
      { name: "Hatta Mountain Reserve", emoji: "⛰️", time: "1.5 hrs by car" },
      { name: "Al Ain Oasis (UNESCO)", emoji: "🌴", time: "2 hrs by bus" },
      { name: "Fujairah (east coast, Indian Ocean)", emoji: "🌊", time: "1.5 hrs by car" },
    ],
    gettingAround: [
      { icon: "🚇", mode: "Dubai Metro", tip: "Clean, air-conditioned, and covers the key tourist corridor (Red Line from airport through Downtown to Marina). Buy a Nol card at any station — works on metro, tram, and buses. Gold Class carriages aren't worth the premium. Metro doesn't run to the creek souks — 15-min taxi from Union station.", cost: "Nol card from AED 25, fares from AED 1.80" },
      { icon: "⛵", mode: "Abra water taxi", tip: "Wooden abra boats cross Dubai Creek between Deira and Bur Dubai for 1 dirham — by far the best and most atmospheric way to reach the souks. Runs from the Dubai Old Souk abra station and Deira Old Souk station from early morning until midnight.", cost: "AED 1 (25¢)" },
    ],
  },

  singapore: {
    essentials: {
      flag: "🇸🇬",
      currency: "Singapore Dollar (SGD)",
      language: "English / Mandarin / Malay / Tamil",
      timezone: "SGT (UTC+8)",
      plug: "Type G (3-pin rectangular, same as UK)",
      needsAdapter: true,
      insiderNote: "EZ-Link card covers all MRT and buses — top it up at any 7-Eleven. Hawker centres are the only place Singaporeans actually argue about food — skip the hotel restaurants and eat where locals eat.",
    },
    neighborhoods: [
      { name: "Tiong Bahru", emoji: "🐦", vibe: "Art Deco + hipster", description: "1930s housing estate with extraordinary Art Deco architecture that survived Singapore's redevelopment drive. The wet market in the morning, excellent independent bookshop (BooksActually), and the cafés that started Singapore's specialty coffee wave." },
      { name: "Kampong Glam", emoji: "🕌", vibe: "Arab Quarter", description: "The Malay-Arab cultural quarter around the Sultan Mosque. Haji Lane has the best independent boutiques in Singapore. The perfume shops on Arab Street sell custom oud blends. Eat at Hjh Maimunah for authentic Malay-Indonesian cooking." },
      { name: "Joo Chiat / Katong", emoji: "🏡", vibe: "Peranakan heritage", description: "The best-preserved Peranakan shophouse architecture in Singapore. This is the neighbourhood to understand what pre-modern Singapore looked like. Kim Choo Kueh Chang makes the best kueh in the city. Lagoon hawker centre for laksa." },
      { name: "Geylang", emoji: "🦞", vibe: "After hours food haven", description: "Singapore's red-light district is also its best late-night food destination. This is an open secret among locals. The best chilli crab, frog porridge, and durian at midnight. Safe, walkable, and utterly alive when everywhere else is closed." },
    ],
    attractions: [
      { name: "Gardens by the Bay (free outdoor)", emoji: "🌳" },
      { name: "Maxwell Hawker Centre", emoji: "🍜" },
      { name: "National Museum of Singapore", emoji: "🏛️" },
      { name: "Botanic Gardens (UNESCO)", emoji: "🌺" },
      { name: "Pulau Ubin Island (last kampung)", emoji: "🏝️" },
      { name: "Southern Ridges walk", emoji: "🌉" },
    ],
    dining: {
      budget: [
        { name: "Maxwell Food Centre", type: "Tian Tian chicken rice — Singapore's most famous hawker" },
        { name: "Lau Pa Sat", type: "Satay alley at night, city centre" },
        { name: "Hjh Maimunah", type: "Best Malay food in Singapore, Kampong Glam" },
      ],
      moderate: [
        { name: "Burnt Ends", type: "Wood-fire modern BBQ, always packed" },
        { name: "Candlenut", type: "Only Michelin-starred Peranakan restaurant" },
        { name: "PS Café", type: "Local institution, reliable quality" },
      ],
      premium: [
        { name: "Odette", type: "Asia's #1 restaurant (multiple years), French" },
        { name: "Zén", type: "Three Michelin stars, Swedish-Japanese" },
        { name: "Les Amis", type: "Three Michelin stars, French" },
      ],
    },
    dayTrips: [
      { name: "Bintan Island, Indonesia", emoji: "🏖️", time: "1 hr fast ferry" },
      { name: "Johor Bahru, Malaysia", emoji: "🌆", time: "30 min by train + customs" },
      { name: "Sentosa (beaches)", emoji: "🎢", time: "15 min by cable car" },
      { name: "Pulau Ubin (kampung island)", emoji: "🚲", time: "30 min + bumboat" },
    ],
    gettingAround: [
      { icon: "🚇", mode: "MRT (Mass Rapid Transit)", tip: "Singapore's MRT is one of the world's best urban rail networks — clean, air-conditioned, punctual, and covers virtually every area you'll visit. Get an EZ-Link card at any MRT station and top it up at 7-Eleven. The Circle Line and Downtown Line fill the gaps in the original network.", cost: "SGD 0.92–2.00 per journey" },
      { icon: "🚌", mode: "Public bus", tip: "Buses reach everywhere the MRT doesn't, including Joo Chiat, Geylang, and Pulau Ubin ferry terminal. Same EZ-Link card. Bus arrival times are shown in real-time on the SG BusRouter app. A pleasant way to see the city — Singapore's buses are air-conditioned and reliable.", cost: "SGD 0.75–2.00 per journey" },
    ],
  },

  sydney: {
    essentials: {
      flag: "🇦🇺",
      currency: "Australian Dollar (AUD)",
      language: "English",
      timezone: "AEST / AEDT (UTC+10 / UTC+11)",
      plug: "Type I (3-pin angled)",
      needsAdapter: true,
      insiderNote: "The Opal card covers trains, buses, ferries, and light rail — tap on and tap off on every journey or you'll be charged the maximum fare. Harbour ferries are the best and most scenic way to cross the city.",
    },
    neighborhoods: [
      { name: "Surry Hills", emoji: "☕", vibe: "Sydney's best food neighbourhood", description: "The suburb that defines Sydney's café culture. Crown Street has more good restaurants per block than anywhere else in the city. Bourke Street Bakery started here. Saturday morning at the Surry Hills Market on Shannon Reserve." },
      { name: "Newtown", emoji: "🌈", vibe: "Counter-culture & diverse", description: "King Street is one long stretch of Thai restaurants, vintage stores, bookshops, and dive bars. The Enmore Theatre has the best acoustics in Sydney. This is where the university crowd lives — genuine and unpretentious." },
      { name: "Manly", emoji: "🌊", vibe: "Beach town within the city", description: "The 30-minute Manly Ferry from Circular Quay is the finest short harbour crossing in the world, passing the Opera House and Harbour Bridge. The beach itself is calmer than Bondi and far less crowded." },
      { name: "Chippendale", emoji: "🎨", vibe: "Arts precinct", description: "Central Park development anchors the arts side — the White Rabbit Gallery (free, world's best collection of 21st-century Chinese art) and Kensington Street gourmet food precinct are here. Breweries and gallery openings on Friday evenings." },
    ],
    attractions: [
      { name: "Sydney Harbour Ferry to Manly", emoji: "⛴️" },
      { name: "White Rabbit Gallery (free)", emoji: "🐇" },
      { name: "Bondi to Coogee Coastal Walk", emoji: "🌊" },
      { name: "Taronga Zoo (ferry access)", emoji: "🦒" },
      { name: "Royal Botanic Garden", emoji: "🌿" },
      { name: "Shelly Beach snorkelling", emoji: "🐠" },
    ],
    dining: {
      budget: [
        { name: "Bourke Street Bakery", type: "The pastry standard, Surry Hills" },
        { name: "Speedos Café", type: "Bondi Beach brunch institution" },
        { name: "Any Vietnamese restaurant, Cabramatta", type: "45 min by train, best pho in Australia" },
      ],
      moderate: [
        { name: "Automata", type: "Share-plate modern Australian, Chippendale" },
        { name: "Icebergs Dining Room", type: "Bondi cliff-top, incredible views" },
        { name: "The Boathouse on Blackwattle Bay", type: "Seafood with harbour views" },
      ],
      premium: [
        { name: "Quay", type: "Harbour Bridge views, progressive Australian" },
        { name: "Bennelong (Opera House)", type: "Dining inside the Opera House itself" },
        { name: "Sepia", type: "Japanese-influenced modern Australian" },
      ],
    },
    dayTrips: [
      { name: "Blue Mountains (Katoomba)", emoji: "⛰️", time: "2 hrs by train" },
      { name: "Hunter Valley Wine Region", emoji: "🍷", time: "2.5 hrs by bus" },
      { name: "Royal National Park Coastal Walk", emoji: "🌿", time: "1 hr by train" },
      { name: "Jervis Bay (white sand, dolphins)", emoji: "🐬", time: "3 hrs by bus" },
    ],
    gettingAround: [
      { icon: "⛴️", mode: "Harbour Ferry", tip: "The Manly Ferry (F1) is the best transport experience in Australia — 30 minutes across Sydney Harbour, past the Opera House and Harbour Bridge, for the price of a regular Opal transit fare. Also take the F3 to Parramatta along the river. Same Opal card as the train.", cost: "Opal card, ~AUD 7–9 each way" },
      { icon: "🚆", mode: "Train network", tip: "Sydney Trains covers the CBD, all beach suburbs (Bondi Junction then bus to Bondi), and the Blue Mountains. Always tap your Opal card on AND off — failure to tap off charges maximum fare. Off-peak fares are significantly cheaper and apply on weekdays after 9am.", cost: "AUD 2.50–13 depending on zones" },
    ],
  },

  seoul: {
    essentials: {
      flag: "🇰🇷",
      currency: "Korean Won (₩)",
      language: "Korean",
      timezone: "KST (UTC+9)",
      plug: "Type F (2-pin round, same as Europe)",
      needsAdapter: true,
      insiderNote: "T-money card works on every subway line, bus, and even taxis across the city. Load it at any convenience store. Korean convenience stores (GS25, CU, 7-Eleven) serve genuinely good hot food — don't underestimate them.",
    },
    neighborhoods: [
      { name: "Ikseon-dong", emoji: "🏯", vibe: "Heritage alleys", description: "Hanok village that survived modernisation by accident — now home to the best independent coffee shops and cocktail bars in Seoul, each in a converted traditional house. Weekday afternoons are manageable; weekends are overwhelming." },
      { name: "Mangwon", emoji: "🥬", vibe: "Youthful local", description: "The Saturday Mangwon Market is where Seoul's young residents shop — incredible street food prices and quality. The Han River park access here is less crowded than at Yeouido. Authentic neighbourhood without the Instagrammer crowds of Ikseon." },
      { name: "Euljiro", emoji: "🔧", vibe: "Artisan industrial", description: "The printing and hardware district that became Seoul's coolest bar area. Basement bars and rooftop spots occupy buildings next to working metal shops and printing studios. The contrast is real and deliberate — bars refuse to make it look too designed." },
      { name: "Seongsu", emoji: "👟", vibe: "Seoul's Brooklyn", description: "Former leather factory district now full of concept stores, flagship boutiques, and coffee roasters. Nike and major brands have opened concept stores here specifically because the neighbourhood has cultural credibility. Ongoing gentrification means it's still interesting." },
    ],
    attractions: [
      { name: "Gyeongbokgung Palace at Opening (9am)", emoji: "🏯" },
      { name: "Gwangjang Market (raw market, evening food)", emoji: "🥟" },
      { name: "Bukchon Hanok Village (early morning)", emoji: "🏡" },
      { name: "National Museum of Korea (free)", emoji: "🏛️" },
      { name: "Namsan Seoul Tower at Dusk", emoji: "🗼" },
      { name: "MMCA Seoul (National Museum of Modern Art)", emoji: "🎨" },
    ],
    dining: {
      budget: [
        { name: "Gwangjang Market", type: "Bindaetteok, mayak gimbap, raw octopus" },
        { name: "Any GS25 or CU convenience store", type: "Seriously — try the hot food counter" },
        { name: "Tosokchon Samgyetang", type: "Famous ginseng chicken soup since 1983" },
      ],
      moderate: [
        { name: "Jungsik", type: "Modern Korean fine dining pioneer" },
        { name: "Mingles", type: "Korean-European fusion, Gangnam" },
        { name: "Poom Seoul", type: "Royal Korean cuisine, Insadong" },
      ],
      premium: [
        { name: "Gaon", type: "Three Michelin stars, Korean royal court cuisine" },
        { name: "La Yeon", type: "Traditional Korean, Shilla Hotel" },
        { name: "Mosu Seoul", type: "Korean-Californian, two Michelin stars" },
      ],
    },
    dayTrips: [
      { name: "Suwon Hwaseong Fortress", emoji: "🏰", time: "1 hr by subway" },
      { name: "DMZ & JSA (book a tour)", emoji: "🪖", time: "1 hr + guided tour" },
      { name: "Nami Island", emoji: "🍂", time: "1.5 hrs by train + ferry" },
      { name: "Jeonju (bibimbap city)", emoji: "🍚", time: "2 hrs by KTX train" },
    ],
    gettingAround: [
      { icon: "💳", mode: "T-money card", tip: "Seoul's subway is one of the world's best — 9 main lines plus regional connections, fully English-signposted, and extremely cheap. Load a T-money card at any convenience store and it works on every line, bus, and even taxis. Transfers within 30 minutes are discounted or free.", cost: "₩1,400–2,150 per journey (~$1–1.60)" },
      { icon: "🚕", mode: "Kakao Taxi", tip: "For anywhere the subway doesn't reach easily, Kakao Taxi is Korea's Uber equivalent and universally used. The app has an English mode and shows a fixed fare before you book. Far more reliable and fairly priced than hailing street taxis.", cost: "Base fare ₩4,800 (~$3.50)" },
    ],
  },

  lisbon: {
    essentials: {
      flag: "🇵🇹",
      currency: "Euro (€)",
      language: "Portuguese",
      timezone: "WET / WEST (UTC+0 / UTC+1)",
      plug: "Type F (2-pin round)",
      needsAdapter: true,
      insiderNote: "Tap your bank card directly on Carris-Metro validators — no need to buy a Viva Viagem card anymore. The tram network is scenic but extremely slow; the funiculars (elevadores) are the local way to navigate the steep hills.",
    },
    neighborhoods: [
      { name: "Mouraria", emoji: "🎵", vibe: "Fado roots & multicultural", description: "The neighbourhood where fado music was born, now the most ethnically diverse part of Lisbon. The Intendente square has transformed from rough to culturally rich. Authentic Indian, Mozambican, and Chinese restaurants next to old fado houses. Real Lisbon." },
      { name: "LX Factory", emoji: "🏭", vibe: "Sunday market best", description: "Former industrial complex with independent shops, restaurants, and a bookshop suspended between crane beams. The Sunday market is worth coming for specifically. Better on weekdays when it's not packed — several good restaurants open for weekday lunch." },
      { name: "Alfama", emoji: "⛪", vibe: "Ancient hillside", description: "The oldest part of Lisbon, Moorish streets above the river. São Jorge Castle is tourist-heavy, but the viewpoints (miradouros) are free and the streets between them are remarkable. Go on a weekday morning. The fado houses here are the real ones." },
      { name: "Príncipe Real", emoji: "🌳", vibe: "Antiques & gardens", description: "The upscale neighbourhood around a beautiful garden square. Saturday antiques market under the trees. The best independent restaurants in Lisbon are clustered here. Pavilhão Chinês bar has one of the most extraordinary interiors in Portugal." },
    ],
    attractions: [
      { name: "Museu Nacional do Azulejo", emoji: "🎨" },
      { name: "Miradouro da Graça (least crowded viewpoint)", emoji: "👁️" },
      { name: "Feira da Ladra flea market (Tue & Sat)", emoji: "🗃️" },
      { name: "Palácio Nacional de Sintra", emoji: "🏰" },
      { name: "Pastéis de Belém original bakery", emoji: "🥧" },
      { name: "MAAT Museum (modern art, riverside)", emoji: "🏛️" },
    ],
    dining: {
      budget: [
        { name: "Pastéis de Belém", type: "Original pastel de nata, since 1837" },
        { name: "Cervejaria Ramiro (lunch)", type: "Legendary seafood, slightly cheaper at lunch" },
        { name: "Taberna da Rua das Flores", type: "Old-school tasca, petiscos at the bar" },
      ],
      moderate: [
        { name: "Tasca do Chico", type: "Best fado house in Lisbon, small and real" },
        { name: "Solar dos Presuntos", type: "Definitive Portuguese cooking" },
        { name: "A Cevicheria", type: "Modern Portuguese seafood, Príncipe Real" },
      ],
      premium: [
        { name: "Belcanto", type: "Two Michelin stars, Chef José Avillez" },
        { name: "Alma", type: "Modern Portuguese, beautifully designed space" },
        { name: "Feitoria", type: "One Michelin star, Belém waterfront" },
      ],
    },
    dayTrips: [
      { name: "Sintra", emoji: "🏰", time: "45 min by train" },
      { name: "Setúbal & Arrábida Natural Park", emoji: "🌊", time: "1 hr by bus" },
      { name: "Évora (Roman temple, walled city)", emoji: "🏛️", time: "1.5 hrs by bus" },
      { name: "Óbidos (medieval walled town)", emoji: "⛩️", time: "1 hr by bus" },
    ],
    gettingAround: [
      { icon: "🚇", mode: "Metro + Carris bus/tram", tip: "Tap your bank card directly on Carris-Metro validators — works on metro, buses, and trams. The metro is fast and covers modern Lisbon; the famous Tram 28 is scenic but extremely slow and always packed. For the hills, use the funiculars (Ascensor da Bica, Elevador do Lavra) — same card.", cost: "€1.65 per journey with bank card" },
      { icon: "🚆", mode: "CP train to Cascais/Sintra", tip: "The Cascais line from Cais do Sodré runs along the Tagus coast and is one of Europe's most scenic commuter trains. Same for the Sintra line from Rossio station. Regional train tickets are cheap and the views along the Tagus are excellent.", cost: "€2.30 to Cascais, €2.35 to Sintra" },
    ],
  },

  marrakech: {
    essentials: {
      flag: "🇲🇦",
      currency: "Moroccan Dirham (MAD)",
      language: "Arabic / Darija / French / Berber",
      timezone: "WET (UTC+0, no DST observed)",
      plug: "Type C & E (2-pin round)",
      needsAdapter: true,
      insiderNote: "Always negotiate prices in the souks before you commit — initial prices are not real prices. Cash only almost everywhere; ATMs in the Ville Nouvelle (Gueliz) area are more reliable. Djemaa el-Fna square's food stalls all serve the same food at the same quality — pick by atmosphere, not by the hawkers' pressure.",
    },
    neighborhoods: [
      { name: "Mouassine", emoji: "🌹", vibe: "Medina's finest quarter", description: "The most beautiful part of the medina. The Mouassine fountain and mosque anchor a neighbourhood of restored riads, leather-scent tanneries, and tile workshops that still make product. Café des Épices overlooks the spice square — the rooftop terrace has the best medina views without the Djemaa chaos." },
      { name: "Mellah (Jewish Quarter)", emoji: "🕍", vibe: "Overlooked & historic", description: "The former Jewish quarter is far less touristed than the main souks. The covered market has the best prices for spices because the sellers aren't positioned for tourist foot traffic. The synagogue is still open and beautiful." },
      { name: "Gueliz (Ville Nouvelle)", emoji: "🏙️", vibe: "Modern Marrakech", description: "The French-built new city where Moroccans who can afford choice actually eat and shop. Better restaurant quality, reliable ATMs, and prices that don't start at tourist premiums. Café du Livre has English books and excellent coffee." },
      { name: "Kasbah", emoji: "🏰", vibe: "Royal fortified quarter", description: "The area around the Saadian Tombs and El Badi Palace. Less chaotic than the main medina. The Palais Royal gardens are rarely open to visitors but the surrounding streets are calm. Best at sunrise before the heat builds." },
    ],
    attractions: [
      { name: "Bahia Palace (early morning)", emoji: "🏯" },
      { name: "Saadian Tombs", emoji: "⚰️" },
      { name: "Madrasa Ben Youssef", emoji: "🕌" },
      { name: "Jardin Majorelle (pre-book)", emoji: "🌵" },
      { name: "Djemaa el-Fna at Dusk", emoji: "🎭" },
      { name: "Hammam experience (local hammam, not spa)", emoji: "🧼" },
    ],
    dining: {
      budget: [
        { name: "Djemaa el-Fna food stalls (stall 1–14)", type: "Harira soup and merguez at dusk, all same quality" },
        { name: "Café Clock", type: "Excellent tagines, roof terrace, Kasbah" },
        { name: "Chez Lamine Hadj Mustapha", type: "Best mechoui (slow-roasted lamb) in the medina" },
      ],
      moderate: [
        { name: "Nomad", type: "Modern Moroccan rooftop, Mouassine" },
        { name: "Dar Cherifa", type: "Literary café in 16th-century riad" },
        { name: "Le Tobsil", type: "Traditional feast in a private riad courtyard" },
      ],
      premium: [
        { name: "Dar Moha", type: "Poolside refined Moroccan, legendary" },
        { name: "La Maison Arabe", type: "Classic riad dining with cooking classes" },
        { name: "Amanjena restaurant", type: "Peaceful luxury resort, outside the medina" },
      ],
    },
    dayTrips: [
      { name: "Atlas Mountains & Berber villages", emoji: "⛰️", time: "1.5 hrs by taxi" },
      { name: "Essaouira (coastal medina)", emoji: "🌊", time: "2.5 hrs by CTM bus" },
      { name: "Ouzoud Waterfalls", emoji: "💧", time: "3 hrs by shared taxi" },
      { name: "Ourika Valley", emoji: "🌿", time: "1 hr by taxi" },
    ],
    gettingAround: [
      { icon: "🚖", mode: "Petit taxi", tip: "The small orange Marrakech taxis are metered but drivers often refuse to use the meter with tourists. Agree on a price before getting in or insist on the meter. A ride across the medina should be 20–30 MAD. Never take the horse-drawn caleches — they're expensive and the horses are poorly treated.", cost: "20–40 MAD for most medina journeys" },
      { icon: "🚶", mode: "Walking the medina", tip: "The medina is compact enough to walk everywhere, but the souks are intentionally designed to disorient you — this is how they've always worked. Download the Maps.me offline map before you arrive (more accurate in the medina than Google Maps). Getting 'lost' is part of the experience; getting found is easy with offline maps.", cost: "Free" },
    ],
  },
};

const REGIONAL_FALLBACKS: Record<string, Partial<DestinationInfo>> = {
  europe: {
    essentials: {
      flag: "🇪🇺",
      currency: "Euro (€) — check local currency for non-Eurozone countries",
      language: "Varies by country",
      timezone: "CET/CEST (UTC+1/+2) for most of continental Europe",
      plug: "Type F (2-pin round) for most of continental Europe",
      needsAdapter: true,
    },
    gettingAround: [
      { icon: "🚇", mode: "City metro / transit", tip: "European city transit is almost always the fastest and cheapest way to get around. Get a multi-day transit pass or tap with a contactless bank card where available.", cost: "€1.50–3 per journey typically" },
    ],
  },
  asia: {
    essentials: {
      flag: "🌏",
      currency: "Varies — carry local currency for markets and street food",
      language: "Varies by country",
      timezone: "Varies (UTC+5:30 to UTC+9)",
      plug: "Varies — bring a universal adapter",
      needsAdapter: true,
    },
    gettingAround: [
      { icon: "📱", mode: "Ride-hailing app", tip: "Grab (Southeast Asia) or local equivalents are the only reliable way to get fair taxi prices. Always book through the app rather than hailing street taxis.", cost: "Varies" },
    ],
  },
  caribbean: {
    essentials: {
      flag: "🌴",
      currency: "Varies — USD widely accepted in most islands",
      language: "English / Spanish / French / Creole depending on island",
      timezone: "AST (UTC-4)",
      plug: "Type A & B (same as US) on most islands",
      needsAdapter: false,
    },
    gettingAround: [
      { icon: "🚕", mode: "Taxi / shared van", tip: "Negotiate the price before you get in. Many islands have shared 'route taxis' that run fixed routes at a fraction of private taxi prices.", cost: "Varies significantly by island" },
    ],
  },
  "latin america": {
    essentials: {
      flag: "🌎",
      currency: "Varies — always carry local currency for markets",
      language: "Spanish (Portuguese in Brazil)",
      timezone: "Varies (UTC-3 to UTC-8)",
      plug: "Type A & B (same as US) in most countries",
      needsAdapter: false,
    },
    gettingAround: [
      { icon: "📱", mode: "Uber / local ride apps", tip: "Uber operates in most major Latin American cities and is safer and more transparent than street taxis. InDriver is also popular and often cheaper.", cost: "Varies by city" },
    ],
  },
  "middle east": {
    essentials: {
      flag: "🌙",
      currency: "Varies by country",
      language: "Arabic (English widely spoken in tourist areas)",
      timezone: "UTC+3 to UTC+4",
      plug: "Type G (3-pin) in Gulf states, Type C elsewhere",
      needsAdapter: true,
    },
    gettingAround: [
      { icon: "🚇", mode: "Metro (where available)", tip: "Gulf cities with metros (Dubai, Doha, Riyadh) have excellent air-conditioned systems. Get a transit card at the station. Elsewhere, Uber or Careem are the reliable options.", cost: "Varies" },
    ],
  },
  africa: {
    essentials: {
      flag: "🌍",
      currency: "Varies — USD and EUR widely accepted alongside local currency",
      language: "Varies — French, English, Arabic, or local languages",
      timezone: "Varies (UTC+0 to UTC+3)",
      plug: "Varies — bring a universal adapter",
      needsAdapter: true,
    },
    gettingAround: [
      { icon: "🚕", mode: "Negotiated taxi / ride app", tip: "Bolt and Uber operate in major African cities and are the safest option. In cities without apps, negotiate the fare before getting in and have local currency ready.", cost: "Varies" },
    ],
  },
  oceania: {
    essentials: {
      flag: "🦘",
      currency: "Australian Dollar or local currency",
      language: "English",
      timezone: "AEST/AEDT (UTC+10/+11) for east coast Australia",
      plug: "Type I (3-pin angled)",
      needsAdapter: true,
    },
    gettingAround: [
      { icon: "🚆", mode: "Train network", tip: "Australian cities have reliable transit cards (Opal in Sydney, Myki in Melbourne). Always tap on AND off or you'll be charged max fare.", cost: "AUD 2.50–6 per journey" },
    ],
  },
};

const DEFAULT: DestinationInfo = {
  essentials: {
    flag: "✈️",
    currency: "Check before you go — airport exchange rates are always poor",
    language: "Learn 5 words: please, thank you, hello, excuse me, where is...",
    timezone: "Check local time on arrival and adjust your watch before landing",
    plug: "Bring a universal adapter — most travel ones cover all socket types",
    needsAdapter: true,
    insiderNote: "The best travel advice is always from someone who was just there. Ask at your hotel for what's changed recently.",
  },
  neighborhoods: [
    { name: "Old City / Historic Centre", emoji: "🏛️", vibe: "Historic core", description: "Most cities have a historic centre that rewards slow exploration on foot. Go in the morning before tour groups arrive." },
    { name: "Local Market Area", emoji: "🛒", vibe: "Where locals shop", description: "Find the neighbourhood where residents do their daily shopping — the food and prices will be significantly better than the tourist areas." },
  ],
  attractions: [
    { name: "Central Market", emoji: "🥩" },
    { name: "Historic District", emoji: "🏛️" },
    { name: "Local Viewpoint", emoji: "👁️" },
  ],
  dining: {
    budget: [{ name: "Local Market", type: "Eat where the workers eat" }],
    moderate: [{ name: "Neighbourhood Restaurant", type: "Ask hotel staff where they eat" }],
    premium: [{ name: "Chef's Recommendation", type: "Ask a local for the best restaurant" }],
  },
  dayTrips: [
    { name: "Nearest UNESCO Site", emoji: "🏛️", time: "Varies" },
    { name: "Local Natural Landmark", emoji: "🌿", time: "Varies" },
  ],
  gettingAround: [
    { icon: "📱", mode: "Local ride app", tip: "Uber, Bolt, or local equivalents are available in most cities worldwide and are the safest way to get fair prices. Book through the app rather than hailing street taxis.", cost: "Varies by city" },
  ],
};

function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z\s]/g, "").trim();
}

export function getDestinationInfo(deal: Deal): DestinationInfo {
  const dest = normalise(deal.destination || "");

  // City-level exact and keyword matches
  const cityMatches: [string[], string][] = [
    [["london", "heathrow", "gatwick", "stansted"], "london"],
    [["paris", "charles de gaulle", "orly", "cdg"], "paris"],
    [["tokyo", "narita", "haneda", "shinjuku", "shibuya"], "tokyo"],
    [["bali", "denpasar", "seminyak", "ubud", "canggu", "kuta"], "bali"],
    [["bangkok", "suvarnabhumi", "don mueang"], "bangkok"],
    [["barcelona", "bcn"], "barcelona"],
    [["rome", "roma", "fiumicino", "ciampino"], "rome"],
    [["amsterdam", "schiphol"], "amsterdam"],
    [["cancun", "cancún", "playa del carmen", "tulum", "riviera maya"], "cancun"],
    [["dubai", "dxb"], "dubai"],
    [["singapore", "changi", "sin"], "singapore"],
    [["sydney", "syd", "kingsford smith"], "sydney"],
    [["seoul", "incheon", "gimpo", "icn"], "seoul"],
    [["lisbon", "lisboa", "lis"], "lisbon"],
    [["marrakech", "marrakesh", "rak"], "marrakech"],
  ];

  for (const [keywords, key] of cityMatches) {
    if (keywords.some((kw) => dest.includes(kw))) {
      return DESTINATIONS[key];
    }
  }

  // Continental / regional fallback — merge with DEFAULT
  const continent = normalise(deal.continent || "");
  const regionMatches: [string[], string][] = [
    [["europe", "european"], "europe"],
    [["asia", "asian", "southeast asia", "east asia", "south asia"], "asia"],
    [["caribbean"], "caribbean"],
    [["latin america", "south america", "central america", "mexico"], "latin america"],
    [["middle east", "gulf"], "middle east"],
    [["africa", "african"], "africa"],
    [["oceania", "australia", "pacific"], "oceania"],
  ];

  for (const [keywords, key] of regionMatches) {
    if (keywords.some((kw) => continent.includes(kw) || dest.includes(kw))) {
      const regional = REGIONAL_FALLBACKS[key];
      return {
        ...DEFAULT,
        essentials: { ...DEFAULT.essentials, ...(regional.essentials ?? {}) },
        gettingAround: regional.gettingAround ?? DEFAULT.gettingAround,
      };
    }
  }

  return DEFAULT;
}
