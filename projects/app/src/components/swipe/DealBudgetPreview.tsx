import React, { useState } from "react";
import { View, Text, StyleSheet, useColorScheme, TouchableOpacity } from "react-native";
import { Deal } from "@trace/shared";
import { colors } from "../../theme/colors";

type Tier = "budget" | "moderate" | "premium";

interface TierRanges {
  accommodation: [number, number];
  food: [number, number];
  transport: [number, number];
  activities: [number, number];
}

const TIER_COSTS: Record<Tier, TierRanges> = {
  budget:   { accommodation: [25, 60],   food: [12, 28],  transport: [4, 12],  activities: [10, 25]  },
  moderate: { accommodation: [90, 170],  food: [35, 75],  transport: [15, 30], activities: [25, 60]  },
  premium:  { accommodation: [200, 420], food: [80, 160], transport: [28, 60], activities: [55, 130] },
};

// Per-destination cost multipliers — applied on top of tier base costs
const COST_MULTIPLIERS: Array<{ keywords: string[]; multiplier: number }> = [
  // Very cheap — SE Asia, South Asia, Central America budget
  { keywords: ["bali","ubud","lombok","vietnam","hanoi","ho chi minh","cambodia","siem reap","myanmar","yangon","nepal","kathmandu","india","mumbai","delhi","bangalore","goa","sri lanka","laos","luang prabang"], multiplier: 0.45 },
  // Cheap — Eastern Europe, North Africa, Latin America
  { keywords: ["thailand","bangkok","chiang mai","indonesia","philippines","cebu","manila","morocco","marrakech","fes","casablanca","egypt","cairo","istanbul","turkey","georgia","tbilisi","ukraine","kyiv","romania","bucharest","bulgaria","sofia","hungary","budapest","poland","krakow","warsaw","mexico","cancun","oaxaca","colombia","medellin","cartagena","peru","lima","machu picchu","bolivia","ecuador","quito","vietnam"], multiplier: 0.6 },
  // Slightly below average
  { keywords: ["portugal","lisbon","porto","prague","czech","spain","barcelona","madrid","seville","greece","athens","thessaloniki","croatia","dubrovnik","split","albania","north macedonia","serbia","belgrade","costa rica","guatemala","nicaragua"], multiplier: 0.75 },
  // Above average — major Western cities
  { keywords: ["london","paris","rome","milan","florence","venice","amsterdam","berlin","munich","vienna","brussels","zurich","geneva","oslo","stockholm","copenhagen","helsinki","new york","los angeles","san francisco","miami","chicago","boston","seattle","washington","toronto","vancouver","sydney","melbourne","brisbane","auckland","dubai","abu dhabi"], multiplier: 1.5 },
  // Very expensive — ultra-premium destinations
  { keywords: ["maldives","bora bora","santorini","mykonos","monaco","st. barts","st barths","aspen","whistler","capri","positano","amalfi","st moritz","verbier","courchevel","reykjavik","iceland","hawaii","maui","bahamas","turks and caicos","seychelles","mauritius","singapore","hong kong","tokyo","kyoto"], multiplier: 1.9 },
];

function getCostMultiplier(deal: Deal): number {
  const dest = (deal.destination || "").toLowerCase();
  const continent = (deal.continent || "").toLowerCase();
  for (const entry of COST_MULTIPLIERS) {
    if (entry.keywords.some((k) => dest.includes(k))) return entry.multiplier;
  }
  // Continent fallbacks
  if (continent.includes("southeast asia") || continent.includes("south asia")) return 0.5;
  if (continent.includes("africa") || continent.includes("central america")) return 0.65;
  if (continent.includes("south america")) return 0.7;
  if (continent.includes("western europe") || continent.includes("north america") || continent.includes("oceania")) return 1.4;
  if (continent.includes("east asia")) return 1.3;
  return 1.0;
}

const TIER_META: Record<Tier, { label: string; color: string; activeBg: string; activeBgDark: string }> = {
  budget:   { label: "Budget",   color: "#16a34a", activeBg: "rgba(22,163,74,0.12)",  activeBgDark: "rgba(22,163,74,0.20)"  },
  moderate: { label: "Standard", color: "#d97706", activeBg: "rgba(217,119,6,0.12)",  activeBgDark: "rgba(217,119,6,0.20)"  },
  premium:  { label: "Luxury",   color: "#7c3aed", activeBg: "rgba(124,58,237,0.12)", activeBgDark: "rgba(124,58,237,0.20)" },
};

const TIERS: Tier[] = ["budget", "moderate", "premium"];

const ROWS: { key: keyof TierRanges; icon: string; label: string }[] = [
  { key: "accommodation", icon: "🏨", label: "Stay"      },
  { key: "food",          icon: "🍽️", label: "Food"      },
  { key: "transport",     icon: "🚌", label: "Transport" },
  { key: "activities",    icon: "🎭", label: "Activities" },
];

const BUDGET_KEYWORDS = [
  "thailand","vietnam","cambodia","indonesia","bali","philippines","india","nepal",
  "morocco","egypt","kenya","tanzania","mexico","colombia","peru","bolivia",
  "romania","bulgaria","hungary","poland","turkey","georgia","portugal","lisbon",
];
const PREMIUM_KEYWORDS = [
  "paris","london","zurich","geneva","oslo","stockholm","copenhagen","amsterdam",
  "tokyo","kyoto","osaka","sydney","melbourne","new york","san francisco","miami",
  "dubai","singapore","hong kong","maldives","reykjavik","monaco","hawaii",
];

function getDefaultTier(deal: Deal): Tier {
  const dest = (deal.destination || "").toLowerCase();
  const continent = (deal.continent || "").toLowerCase();
  if (BUDGET_KEYWORDS.some((k) => dest.includes(k))) return "budget";
  if (PREMIUM_KEYWORDS.some((k) => dest.includes(k))) return "premium";
  if (continent.includes("south america") || continent.includes("central america") || continent.includes("southeast asia") || continent.includes("south asia") || continent.includes("africa")) return "budget";
  if (continent.includes("north america") || continent.includes("western europe") || continent.includes("oceania")) return "premium";
  return "moderate";
}

function scaleRange(range: [number, number], multiplier: number): [number, number] {
  return [Math.round(range[0] * multiplier), Math.round(range[1] * multiplier)];
}

function getRanges(tier: Tier, deal: Deal): TierRanges {
  const m = getCostMultiplier(deal);
  const base = TIER_COSTS[tier];
  const scaled: TierRanges = {
    accommodation: scaleRange(base.accommodation, m),
    food:          scaleRange(base.food, m),
    transport:     scaleRange(base.transport, m),
    activities:    scaleRange(base.activities, m),
  };
  if (deal.deal_type === "adventure") {
    scaled.activities = [scaled.activities[0] + Math.round(15 * m), scaled.activities[1] + Math.round(40 * m)];
  }
  if (deal.deal_type === "relaxation" || deal.deal_type === "romantic") {
    scaled.accommodation = [scaled.accommodation[0] + Math.round(25 * m), scaled.accommodation[1] + Math.round(70 * m)];
  }
  return scaled;
}

function getExplanation(tier: Tier, deal: Deal): string {
  const dest = deal.destination || "this destination";
  const map: Record<Tier, string> = {
    budget:   `Hostels, street food, and public transit. You can cover ${dest} well without spending much.`,
    moderate: `Comfortable hotels, local restaurants, and a tour or two. The sweet spot for ${dest}.`,
    premium:  `Boutique stays, fine dining, and private experiences. ${dest} at its most indulgent.`,
  };
  return map[tier];
}

type DestProfile = "ultra_cheap" | "cheap" | "mid" | "expensive" | "ultra_expensive";

function getDestProfile(deal: Deal): DestProfile {
  const m = getCostMultiplier(deal);
  if (m <= 0.5)  return "ultra_cheap";
  if (m <= 0.7)  return "cheap";
  if (m <= 1.1)  return "mid";
  if (m <= 1.6)  return "expensive";
  return "ultra_expensive";
}

function getRowExamples(
  row: keyof TierRanges,
  tier: Tier,
  deal: Deal,
  ranges: TierRanges,
): string[] {
  const dest = deal.destination || "the area";
  const [lo, hi] = ranges[row];
  const mid = Math.round((lo + hi) / 2);
  const p = getDestProfile(deal);

  const examples: Record<keyof TierRanges, Record<Tier, Record<DestProfile, string[]>>> = {
    accommodation: {
      budget: {
        ultra_cheap:    [`Hostel dorm or guesthouse in ${dest} — $${lo}–$${mid}/night`, `Homestay or simple guesthouse — $${mid}–$${hi}/night`],
        cheap:          [`Budget guesthouse or hostel — $${lo}–$${mid}/night`, `Airbnb private room or pension — $${mid}–$${hi}/night`],
        mid:            [`Budget hotel or hostel — $${lo}–$${mid}/night`, `Airbnb shared room near centre — $${mid}–$${hi}/night`],
        expensive:      [`Hostel private room in ${dest} — $${lo}–$${mid}/night`, `Budget hotel, outskirts of city — $${mid}–$${hi}/night`],
        ultra_expensive:[`Hostel dorm (limited availability) — $${lo}–$${mid}/night`, `Budget hotel, 30+ min from centre — $${mid}–$${hi}/night`],
      },
      moderate: {
        ultra_cheap:    [`3-star hotel or boutique guesthouse — $${lo}–$${mid}/night`, `Comfortable Airbnb apartment — $${mid}–$${hi}/night`],
        cheap:          [`Mid-range hotel in ${dest} — $${lo}–$${mid}/night`, `Airbnb apartment, good location — $${mid}–$${hi}/night`],
        mid:            [`3-star hotel, central ${dest} — $${lo}–$${mid}/night`, `Well-rated Airbnb apartment — $${mid}–$${hi}/night`],
        expensive:      [`3–4 star hotel, good neighbourhood — $${lo}–$${mid}/night`, `Airbnb apartment, city centre — $${mid}–$${hi}/night`],
        ultra_expensive:[`Mid-range hotel in ${dest} — $${lo}–$${mid}/night`, `Serviced apartment or Airbnb — $${mid}–$${hi}/night`],
      },
      premium: {
        ultra_cheap:    [`Boutique resort or villa in ${dest} — $${lo}–$${mid}/night`, `Luxury hotel with pool — $${mid}–$${hi}/night`],
        cheap:          [`Design hotel or boutique stay — $${lo}–$${mid}/night`, `Upscale resort or spa hotel — $${mid}–$${hi}/night`],
        mid:            [`4–5 star hotel in ${dest} — $${lo}–$${mid}/night`, `Boutique luxury hotel or suite — $${mid}–$${hi}/night`],
        expensive:      [`5-star hotel in ${dest} — $${lo}–$${mid}/night`, `Luxury suite or penthouse apartment — $${mid}–$${hi}/night`],
        ultra_expensive:[`Overwater villa or luxury resort — $${lo}–$${mid}/night`, `Private villa or 5-star suite — $${mid}–$${hi}/night`],
      },
    },
    food: {
      budget: {
        ultra_cheap:    [`Street food stalls & local markets — $${lo}–$${mid}/day`, `Simple local restaurants (noodles, rice dishes) — $${mid}–$${hi}/day`],
        cheap:          [`Street food, bakeries & local spots — $${lo}–$${mid}/day`, `Casual sit-down local restaurants — $${mid}–$${hi}/day`],
        mid:            [`Supermarkets, cafes & takeaways — $${lo}–$${mid}/day`, `Casual local restaurants & food stalls — $${mid}–$${hi}/day`],
        expensive:      [`Grocery stores & budget cafes — $${lo}–$${mid}/day`, `Affordable local restaurants in ${dest} — $${mid}–$${hi}/day`],
        ultra_expensive:[`Supermarket meals & budget cafes — $${lo}–$${mid}/day`, `Affordable dining options — $${mid}–$${hi}/day`],
      },
      moderate: {
        ultra_cheap:    [`Local restaurants with table service — $${lo}–$${mid}/day`, `Occasional splurge on a nicer meal — $${mid}–$${hi}/day`],
        cheap:          [`Sit-down restaurants & wine bars — $${lo}–$${mid}/day`, `Mix of local and tourist-friendly spots — $${mid}–$${hi}/day`],
        mid:            [`Casual restaurants & neighbourhood bistros — $${lo}–$${mid}/day`, `Craft beer, brunch spots, one dinner out — $${mid}–$${hi}/day`],
        expensive:      [`Mid-range restaurants in ${dest} — $${lo}–$${mid}/day`, `Brunch, dinner out, drinks — $${mid}–$${hi}/day`],
        ultra_expensive:[`Quality restaurants & wine — $${lo}–$${mid}/day`, `Two sit-down meals with drinks — $${mid}–$${hi}/day`],
      },
      premium: {
        ultra_cheap:    [`Upscale local restaurants & tasting menus — $${lo}–$${mid}/day`, `Rooftop dining or chef's table experiences — $${mid}–$${hi}/day`],
        cheap:          [`Fine dining & wine bars in ${dest} — $${lo}–$${mid}/day`, `Tasting menus & specialty restaurants — $${mid}–$${hi}/day`],
        mid:            [`Upscale restaurants & cocktail bars — $${lo}–$${mid}/day`, `Fine dining & curated wine lists — $${mid}–$${hi}/day`],
        expensive:      [`Michelin-level dining & champagne bars — $${lo}–$${mid}/day`, `Tasting menus & hotel restaurants — $${mid}–$${hi}/day`],
        ultra_expensive:[`World-class fine dining in ${dest} — $${lo}–$${mid}/day`, `Private chef experiences & resort dining — $${mid}–$${hi}/day`],
      },
    },
    transport: {
      budget: {
        ultra_cheap:    [`Tuk-tuk, local bus & motorbike taxi — $${lo}–$${mid}/day`, `Rented scooter or bicycle — $${mid}–$${hi}/day`],
        cheap:          [`Local buses, shared taxis & metro — $${lo}–$${mid}/day`, `Occasional ride-hail (Bolt, Yandex) — $${mid}–$${hi}/day`],
        mid:            [`City metro & tram network — $${lo}–$${mid}/day`, `Day pass or ride-hail for longer trips — $${mid}–$${hi}/day`],
        expensive:      [`Metro, bus, or Oyster/transit card — $${lo}–$${mid}/day`, `Occasional Uber or city bike hire — $${mid}–$${hi}/day`],
        ultra_expensive:[`Public transit in ${dest} — $${lo}–$${mid}/day`, `Shared taxis or transit passes — $${mid}–$${hi}/day`],
      },
      moderate: {
        ultra_cheap:    [`Mix of local transit & private transfers — $${lo}–$${mid}/day`, `Ride-hail or taxi for some trips — $${mid}–$${hi}/day`],
        cheap:          [`Metro + regular Uber or taxi use — $${lo}–$${mid}/day`, `Day trip transport included — $${mid}–$${hi}/day`],
        mid:            [`Public transit + Uber for convenience — $${lo}–$${mid}/day`, `Rental car for day trips — $${mid}–$${hi}/day`],
        expensive:      [`Regular Uber/taxi use in ${dest} — $${lo}–$${mid}/day`, `Day trips by rail or car hire — $${mid}–$${hi}/day`],
        ultra_expensive:[`Taxis, Uber & transit in ${dest} — $${lo}–$${mid}/day`, `Private driver for excursions — $${mid}–$${hi}/day`],
      },
      premium: {
        ultra_cheap:    [`Private driver or chartered boat — $${lo}–$${mid}/day`, `Speedboat transfers or helicopter — $${mid}–$${hi}/day`],
        cheap:          [`Private taxi, transfers & car hire — $${lo}–$${mid}/day`, `Chauffeur for key journeys — $${mid}–$${hi}/day`],
        mid:            [`Private car hire or chauffeur — $${lo}–$${mid}/day`, `First-class rail & premium Uber — $${mid}–$${hi}/day`],
        expensive:      [`Private driver or premium car hire — $${lo}–$${mid}/day`, `Helicopter or seaplane for excursions — $${mid}–$${hi}/day`],
        ultra_expensive:[`Private speedboat or helicopter transfers — $${lo}–$${mid}/day`, `Chartered yacht or seaplane — $${mid}–$${hi}/day`],
      },
    },
    activities: {
      budget: {
        ultra_cheap:    [`Temple entry fees & free beaches — $${lo}–$${mid}/day`, `Cooking class or guided local tour — $${mid}–$${hi}/day`],
        cheap:          [`Free museums, parks & walking tours — $${lo}–$${mid}/day`, `Paid attraction or guided tour — $${mid}–$${hi}/day`],
        mid:            [`Free galleries, parks & self-guided — $${lo}–$${mid}/day`, `One paid attraction per day — $${mid}–$${hi}/day`],
        expensive:      [`Free museums & city walking — $${lo}–$${mid}/day`, `Museum entry or paid tour — $${mid}–$${hi}/day`],
        ultra_expensive:[`Free beaches & public spaces — $${lo}–$${mid}/day`, `Entry fees & budget snorkel tours — $${mid}–$${hi}/day`],
      },
      moderate: {
        ultra_cheap:    [`Cooking class, market tour or day trip — $${lo}–$${mid}/day`, `River cruise or jungle trek — $${mid}–$${hi}/day`],
        cheap:          [`Museum passes, city tours & tastings — $${lo}–$${mid}/day`, `Day trip to nearby sights — $${mid}–$${hi}/day`],
        mid:            [`Guided tours & cultural experiences — $${lo}–$${mid}/day`, `Day excursion or adventure sport — $${mid}–$${hi}/day`],
        expensive:      [`Museum tours & theatre tickets — $${lo}–$${mid}/day`, `Day trip by train or organized tour — $${mid}–$${hi}/day`],
        ultra_expensive:[`Guided experiences & cultural tours — $${lo}–$${mid}/day`, `Snorkelling, diving or boat trip — $${mid}–$${hi}/day`],
      },
      premium: {
        ultra_cheap:    [`Private villa excursions & spa days — $${lo}–$${mid}/day`, `Sunrise temple tour or private cooking class — $${mid}–$${hi}/day`],
        cheap:          [`Private guided tours & wine tastings — $${lo}–$${mid}/day`, `Spa treatments & exclusive experiences — $${mid}–$${hi}/day`],
        mid:            [`Private tours, VIP access & tastings — $${lo}–$${mid}/day`, `Spa, opera tickets or rooftop events — $${mid}–$${hi}/day`],
        expensive:      [`Private guides, VIP museum access — $${lo}–$${mid}/day`, `Luxury spa day or private yacht tour — $${mid}–$${hi}/day`],
        ultra_expensive:[`Private island excursions & scuba — $${lo}–$${mid}/day`, `Yacht charter, spa & marine experiences — $${mid}–$${hi}/day`],
      },
    },
  };

  return examples[row][tier][p];
}

export default function DealBudgetPreview({ deal }: { deal: Deal }) {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const theme = isDark ? colors.dark : colors.light;
  const [openTier, setOpenTier] = useState<Tier | null>(null);
  const [openRow, setOpenRow] = useState<keyof TierRanges | null>(null);

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.foreground }]}>Daily Budget</Text>
        <Text style={[styles.subtitle, { color: theme.mutedForeground }]}>Tap a tier to explore</Text>
      </View>

      {/* Tier pills */}
      <View style={[styles.pillsRow, { borderTopColor: theme.border }]}>
        {TIERS.map((tier) => {
          const meta = TIER_META[tier];
          const isActive = openTier === tier;
          return (
            <TouchableOpacity
              key={tier}
              onPress={() => { setOpenTier(isActive ? null : tier); setOpenRow(null); }}
              activeOpacity={0.7}
              style={[
                styles.pill,
                isActive
                  ? { backgroundColor: isDark ? meta.activeBgDark : meta.activeBg, borderColor: meta.color + "66" }
                  : { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)", borderColor: "transparent" },
              ]}
            >
              <Text style={[styles.pillText, { color: isActive ? meta.color : theme.mutedForeground }]}>
                {meta.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Expanded content */}
      {openTier !== null && (() => {
        const meta = TIER_META[openTier];
        const ranges = getRanges(openTier, deal);
        const totalLow  = ROWS.reduce((s, r) => s + ranges[r.key][0], 0);
        const totalHigh = ROWS.reduce((s, r) => s + ranges[r.key][1], 0);

        return (
          <View style={[styles.expanded, { borderTopColor: theme.border }]}>
            {/* AI explanation */}
            <Text style={[styles.explanation, { color: theme.mutedForeground }]}>
              {getExplanation(openTier, deal)}
            </Text>

            {/* Rows */}
            <View style={[styles.rowsContainer, { borderColor: theme.border }]}>
              {ROWS.map((row, i) => {
                const [lo, hi] = ranges[row.key];
                const pct = (hi / (TIER_COSTS.premium[row.key][1] + 50)) * 100;
                const isRowOpen = openRow === row.key;
                const examples = isRowOpen ? getRowExamples(row.key, openTier!, deal, ranges) : [];
                return (
                  <View
                    key={row.key}
                    style={[
                      i < ROWS.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
                    ]}
                  >
                    <TouchableOpacity
                      onPress={() => setOpenRow(isRowOpen ? null : row.key)}
                      activeOpacity={0.7}
                      style={[
                        styles.row,
                        isRowOpen && { backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)" },
                      ]}
                    >
                      <Text style={styles.rowIcon}>{row.icon}</Text>
                      <Text style={[styles.rowLabel, { color: theme.foreground }]}>{row.label}</Text>
                      <View style={styles.rowRight}>
                        <Text style={[styles.rowRange, { color: theme.foreground }]}>
                          ${lo}
                          <Text style={{ color: theme.mutedForeground, fontWeight: "400" }}>–${hi}</Text>
                        </Text>
                        <View style={[styles.barTrack, { backgroundColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)" }]}>
                          <View style={[styles.barFill, { width: `${Math.min(pct, 100)}%`, backgroundColor: meta.color }]} />
                        </View>
                      </View>
                      <Text style={{ fontSize: 10, color: theme.mutedForeground, marginLeft: 4 }}>{isRowOpen ? "▲" : "▼"}</Text>
                    </TouchableOpacity>
                    {isRowOpen && (
                      <View style={{ paddingHorizontal: 14, paddingBottom: 12, paddingTop: 4, gap: 6 }}>
                        {examples.map((ex, j) => (
                          <View key={j} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                            <Text style={{ color: meta.color, fontSize: 12, marginTop: 1 }}>•</Text>
                            <Text style={{ flex: 1, fontSize: 12, color: theme.mutedForeground, lineHeight: 17 }}>{ex}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>

            {/* Total */}
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { color: theme.mutedForeground }]}>Est. daily total</Text>
              <Text style={[styles.totalValue, { color: meta.color }]}>
                ${totalLow}–${totalHigh}
                <Text style={[styles.totalUnit, { color: theme.mutedForeground }]}> /day</Text>
              </Text>
            </View>
          </View>
        );
      })()}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },

  header: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 11,
    fontWeight: "500",
  },

  pillsRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 14,
  },
  pill: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 13,
    fontWeight: "700",
  },

  expanded: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  explanation: {
    fontSize: 12,
    lineHeight: 18,
  },

  rowsContainer: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  rowIcon: {
    fontSize: 15,
    width: 22,
    textAlign: "center",
  },
  rowLabel: {
    fontSize: 13,
    fontWeight: "500",
    width: 80,
  },
  rowRight: {
    flex: 1,
    gap: 5,
    alignItems: "flex-end",
  },
  rowRange: {
    fontSize: 12,
    fontWeight: "700",
  },
  barTrack: {
    width: "100%",
    height: 2,
    borderRadius: 2,
    overflow: "hidden",
  },
  barFill: {
    height: 2,
    borderRadius: 2,
  },

  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  totalValue: {
    fontSize: 15,
    fontWeight: "800",
  },
  totalUnit: {
    fontSize: 11,
    fontWeight: "400",
  },
});
