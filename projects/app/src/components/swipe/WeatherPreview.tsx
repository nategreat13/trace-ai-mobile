import React, { useState } from "react";
import { View, Text, StyleSheet, useColorScheme, TouchableOpacity } from "react-native";
import { Cloud, Sun, CloudRain, CloudSnow, ChevronDown, ChevronUp } from "lucide-react-native";
import { Deal } from "@trace/shared";
import { colors } from "../../theme/colors";

// ── Weather data by region and month ────────────────────────────────────────
interface WeatherEntry {
  label: string;
  temp: string;
  desc: string;
  icon: "sun" | "rain" | "snow" | "cloud" | "partly";
  details: string;
}

const WEATHER_DATA: Record<string, Record<number, WeatherEntry>> = {
  tropical: {
    0:  { label: "Dry Season",          temp: "75-88°F", desc: "Sunny, low humidity -- ideal travel weather",   icon: "sun",
          details: "January is peak dry season -- the best time to visit. Expect clear skies, minimal rain, and comfortable humidity. Beaches are pristine, and the trade winds keep things from feeling too hot. Book early; this is the busiest and priciest window of the year." },
    1:  { label: "Dry Season",          temp: "77-90°F", desc: "Warm and sunny with light breezes",             icon: "sun",
          details: "February delivers classic tropical weather at its finest. Days are warm and sunny, evenings cool slightly, and rain is rare. Peak season pricing applies, but the conditions are worth it. Great for outdoor activities and beach days without any weather stress." },
    2:  { label: "Dry Season",          temp: "80-93°F", desc: "Hot and clear -- pack light clothing",          icon: "sun",
          details: "March is hot and mostly dry, though the odd afternoon shower starts creeping in toward the end of the month. Still excellent conditions overall. Crowds begin to thin compared to January-February, which means slightly better prices without sacrificing the weather." },
    3:  { label: "Transition",          temp: "82-95°F", desc: "Getting hotter, occasional showers",            icon: "partly",
          details: "April marks the shoulder season -- temperatures peak and short afternoon rain showers become more frequent. Mornings are typically clear and beautiful; save outdoor plans for the first half of the day. Prices drop noticeably from peak season." },
    4:  { label: "Rainy Season Begins", temp: "80-93°F", desc: "Short afternoon rain showers likely",           icon: "rain",
          details: "May signals the start of the rainy season, but don't be put off. Showers usually arrive in the afternoon and clear quickly, leaving evenings fresh and lush. Temperatures stay warm. You'll find significantly fewer tourists and much better prices." },
    5:  { label: "Rainy Season",        temp: "78-90°F", desc: "Frequent showers, lush greenery",               icon: "rain",
          details: "June brings heavier rain, typically in afternoon downpours rather than all-day drizzle. The landscape turns intensely green. If you don't mind working around the weather, it's a great off-season deal -- crowds are thin and prices are low." },
    6:  { label: "Rainy Season",        temp: "78-88°F", desc: "Wettest month -- pack a rain jacket",           icon: "rain",
          details: "July is often the wettest month in many tropical regions. Expect heavy afternoon showers and occasional all-day rain. Pack a good rain jacket and embrace the lushness. The upside: rock-bottom prices, empty beaches in the mornings, and a completely different side of the destination." },
    7:  { label: "Rainy Season",        temp: "78-88°F", desc: "Warm with heavy showers",                       icon: "rain",
          details: "August stays deep in the rainy season with warm, humid conditions and frequent afternoon storms. Morning windows are usually clear. This is great for travelers who prioritize value over perfect weather -- the destination is at its most verdant and uncrowded." },
    8:  { label: "Transition",          temp: "79-90°F", desc: "Rain tapering off, still warm",                 icon: "partly",
          details: "September marks the transition back toward dry season. Rain becomes less frequent and more predictable. You'll get a mix of partly cloudy mornings and shorter afternoon showers. A solid sweet spot for travelers who want lower prices with increasingly reliable weather." },
    9:  { label: "Dry Season Begins",   temp: "79-91°F", desc: "Cooling down, less rain",                       icon: "partly",
          details: "October is when the weather starts turning reliably good again. Rain events become sporadic, skies open up, and the landscape retains its lush green color from the wet season. Prices haven't fully climbed back to peak yet, making this excellent value." },
    10: { label: "Dry Season",          temp: "77-89°F", desc: "Pleasant and sunny",                            icon: "sun",
          details: "November brings settled dry season conditions back in full. Clear days, manageable humidity, and comfortable temperatures. Tourists are just starting to return, so you'll find great conditions without the full peak-season crowds. A genuinely underrated travel month." },
    11: { label: "Dry Season",          temp: "75-88°F", desc: "Perfect weather, peak season",                  icon: "sun",
          details: "December is peak season for a reason -- ideal tropical weather, festive atmosphere, and the destination at its most alive. Expect clear skies, light breezes, and perfect beach conditions. Book accommodations and flights well in advance; this month fills up fast." },
  },
  temperate_north: {
    0:  { label: "Winter",       temp: "28-45°F", desc: "Cold with possible snow -- bundle up",           icon: "snow",
          details: "January is the heart of winter. Expect cold temperatures, possible snow, and short daylight hours. Pack serious layers and waterproof boots. The upside: indoor attractions have no lines, restaurants are easy to book, and prices are at their annual low. Cities have a quieter, more local feel." },
    1:  { label: "Winter",       temp: "30-47°F", desc: "Still cold but days getting longer",             icon: "snow",
          details: "February is still firmly winter, but there's a subtle shift -- days grow noticeably longer and the first hints of spring feel possible. Cold and occasionally snowy, but fewer storms than January in many areas. Great for winter activities and off-season city exploration at low prices." },
    2:  { label: "Early Spring", temp: "40-58°F", desc: "Chilly and fresh, flowers starting to bloom",    icon: "partly",
          details: "March is the start of spring, and it's full of potential. Temperatures swing day to day -- warm afternoon sun followed by cold evenings. Cherry blossoms and wildflowers begin appearing. Bring layers and be prepared for anything. Crowds are low, prices are still reasonable." },
    3:  { label: "Spring",       temp: "50-65°F", desc: "Mild and pleasant with some rain",               icon: "partly",
          details: "April is proper spring -- mild days, occasional rain showers, and everything in bloom. It's one of the best months to visit many temperate destinations: lively atmosphere, full operating hours, and far fewer tourists than summer. Pack a light rain jacket and enjoy the fresh energy." },
    4:  { label: "Spring",       temp: "58-72°F", desc: "Warm and beautiful, great for sightseeing",      icon: "sun",
          details: "May is a standout month. Warm enough for comfortable outdoor exploration, green and beautiful, long daylight hours, and crowds haven't hit summer levels yet. Often the best value-for-conditions window of the year. Perfect for walking tours, outdoor dining, and hiking." },
    5:  { label: "Early Summer", temp: "65-80°F", desc: "Warm and sunny -- peak season begins",           icon: "sun",
          details: "June marks the start of peak season. Long days, warm weather, and a lively atmosphere across the destination. Prices climb and popular spots get busier, but conditions are excellent. Go early in the month for slightly fewer crowds before school holidays kick in." },
    6:  { label: "Summer",       temp: "72-88°F", desc: "Hot and sunny, long daylight hours",             icon: "sun",
          details: "July is peak summer -- hot days, long evenings, and the city at its most vibrant. It's also the busiest and most expensive time of year. Despite the crowds, the energy is unbeatable and the weather is consistently good. Book everything well in advance." },
    7:  { label: "Summer",       temp: "70-87°F", desc: "Peak summer heat -- stay hydrated",              icon: "sun",
          details: "August is peak summer heat. Days can be scorching, so plan outdoor activities for morning or evening. Outdoor events, festivals, and beach culture are all in full swing. Still peak pricing, but many locals leave for vacation, which gives the city a slightly different feel." },
    8:  { label: "Early Fall",   temp: "62-78°F", desc: "Warm days, cooler evenings -- ideal weather",    icon: "partly",
          details: "September is arguably the best month to visit. Summer heat fades to warm, comfortable days with cool evenings. Crowds thin out as school starts and prices drop from peak. The weather stays excellent. Pack a light jacket for evenings -- this is the sweet spot of the year." },
    9:  { label: "Fall",         temp: "50-65°F", desc: "Crisp autumn air, stunning foliage",             icon: "partly",
          details: "October brings fall in full force -- crisp air, spectacular foliage, and a cozy atmosphere. One of the most beautiful times to visit many temperate destinations. Temperatures are comfortable for walking, evenings get cold, and the crowds are noticeably lighter than summer." },
    10: { label: "Late Fall",    temp: "38-52°F", desc: "Getting chilly, bring a jacket",                 icon: "cloud",
          details: "November gets properly cold and often overcast. Pack warm layers and waterproofs. The upside: it's shoulder season pricing, indoor attractions are uncrowded, and the destination has a moody, authentic winter atmosphere that peak-season visitors never see." },
    11: { label: "Winter",       temp: "30-45°F", desc: "Cold with festive holiday atmosphere",           icon: "snow",
          details: "December brings cold weather and a festive, magical atmosphere. Holiday markets, lights, and decorations transform many cities. It's cold and can be snowy, but the energy around the holidays is worth it. Prices spike around Christmas and New Year -- book early if those dates are flexible." },
  },
  temperate_south: {
    0:  { label: "Summer",        temp: "72-88°F", desc: "Hot and sunny -- peak summer",               icon: "sun",
          details: "January is peak summer in the southern hemisphere -- hot, sunny, and at its most lively. This is prime beach weather and festival season. Prices are at their annual high and popular spots fill up fast. Book everything early. Long evenings and a vibrant outdoor culture make it worth it." },
    1:  { label: "Summer",        temp: "70-87°F", desc: "Warm and dry, long evenings",                icon: "sun",
          details: "February delivers warm, dry summer conditions with slightly lower crowds than January as school resumes. Still excellent beach and outdoor weather, long daylight hours, and a festive summer atmosphere. A slightly better value window within the summer peak season." },
    2:  { label: "Late Summer",   temp: "65-82°F", desc: "Warm with pleasant breezes",                 icon: "sun",
          details: "March is late summer -- warm and pleasant with the intense heat starting to ease. Crowds thin from peak, prices soften, and the weather remains excellent. A genuinely great time to visit: good conditions, more breathing room, and the destination still running at full pace." },
    3:  { label: "Early Fall",    temp: "58-74°F", desc: "Mild and comfortable, less crowded",         icon: "partly",
          details: "April signals the turn toward fall. Mild, comfortable temperatures and a quieter atmosphere as the summer crowds leave. Outdoor activities are pleasant without the summer heat. A solid shoulder season month for travelers who prefer relaxed conditions at better prices." },
    4:  { label: "Fall",          temp: "50-65°F", desc: "Crisp air, beautiful autumn colors",         icon: "partly",
          details: "May brings proper fall -- crisp air, vivid foliage in wooded areas, and a cozy atmosphere. Temperatures are comfortable for sightseeing but evenings get cold. A great month for food and wine culture in many southern hemisphere destinations. Off-peak pricing kicks in." },
    5:  { label: "Winter Begins", temp: "42-57°F", desc: "Cooling down, quieter season",               icon: "cloud",
          details: "June marks the start of winter. Cool, often cloudy days and cold evenings. Indoor culture -- galleries, restaurants, cafes -- comes to the foreground. Pack warm layers. It's off-season for most outdoor activities, but the destination has an authentic local rhythm that summer visitors miss." },
    6:  { label: "Winter",        temp: "38-52°F", desc: "Cool and overcast -- pack layers",           icon: "cloud",
          details: "July is mid-winter in the southern hemisphere -- cold, often grey, and occasionally rainy. Heavy layers are essential. The upside: this is the absolute low season for prices, popular attractions are uncrowded, and you'll experience the destination the way locals live it." },
    7:  { label: "Winter",        temp: "40-54°F", desc: "Cool days, cold nights",                     icon: "cloud",
          details: "August stays in winter, but there's a sense of things beginning to turn. Days lengthen slightly and occasional clearer spells appear. Still cold and pack-warm territory. Great for travelers who prioritize value and authenticity over beach weather -- this is the deepest off-season." },
    8:  { label: "Early Spring",  temp: "48-62°F", desc: "Warming up, wildflowers emerging",           icon: "partly",
          details: "September is the start of spring -- warming days, wildflowers appearing, and a general sense of the destination waking up. Variable weather with some chilly days and surprise warm spells. A lovely transitional month with low prices before the summer rush begins." },
    9:  { label: "Spring",        temp: "55-70°F", desc: "Lovely spring weather, great for outdoors",  icon: "sun",
          details: "October is one of the best months to visit. Spring is in full swing -- mild and sunny, wildflowers everywhere, and the outdoor season is back without peak summer crowds. Great for hiking, sightseeing, and outdoor dining. Prices start rising but haven't hit summer peak." },
    10: { label: "Late Spring",   temp: "62-78°F", desc: "Warm and sunny, pre-summer crowds",          icon: "sun",
          details: "November brings warm, beautiful late spring conditions. The destination is lively and outdoor-friendly without the full summer crush. Think of it as the sweet spot -- excellent weather, vibrant atmosphere, and slightly more manageable prices than January-February." },
    11: { label: "Early Summer",  temp: "68-84°F", desc: "Hot and festive, peak holiday season",       icon: "sun",
          details: "December kicks off summer with warm weather and a festive holiday atmosphere. Outdoor events, beach culture, and long evening light make this a great time to visit. Prices climb toward peak as the season starts -- book early, especially around Christmas and New Year." },
  },
};

// ── Month labels ────────────────────────────────────────────────────────────
const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// ── Month name to index mapping ─────────────────────────────────────────────
const MONTH_MAP: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  january: 0, february: 1, march: 2, april: 3, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

function getMonthIndex(travelWindow: string | undefined): number | null {
  if (!travelWindow) return null;
  const lower = travelWindow.toLowerCase().trim();
  const monthKey = lower.split(/[\s\-\/]/)[0].replace(/\./g, "").trim();
  if (MONTH_MAP[monthKey] !== undefined) return MONTH_MAP[monthKey];
  for (const [key, val] of Object.entries(MONTH_MAP)) {
    if (lower.includes(key)) return val;
  }
  return null;
}

function getRegion(continent: string | undefined, destination: string | undefined): string {
  const c = (continent || "").toLowerCase();
  const d = (destination || "").toLowerCase();

  const southHemisphere = ["south america", "southern africa", "australia", "new zealand", "oceania"];
  if (southHemisphere.some((s) => c.includes(s) || d.includes(s))) return "temperate_south";

  const tropical = ["southeast asia", "asia", "caribbean", "central america", "middle east", "africa", "india"];
  if (tropical.some((t) => c.includes(t) || d.includes(t))) return "tropical";

  return "temperate_north";
}

// ── Icon colors ─────────────────────────────────────────────────────────────
const ICON_COLORS: Record<string, string> = {
  sun: "#f59e0b",
  rain: "#3b82f6",
  snow: "#38bdf8",
  cloud: "#94a3b8",
  partly: "#60a5fa",
};

const ICON_SIZE = 22;

function WeatherIcon({ type }: { type: string }) {
  const color = ICON_COLORS[type] || ICON_COLORS.cloud;
  const resolvedType = type === "partly" ? "cloud" : type;

  if (resolvedType === "sun") return <Sun size={ICON_SIZE} color={color} />;
  if (resolvedType === "rain") return <CloudRain size={ICON_SIZE} color={color} />;
  if (resolvedType === "snow") return <CloudSnow size={ICON_SIZE} color={color} />;
  return <Cloud size={ICON_SIZE} color={color} />;
}

// ── Component ───────────────────────────────────────────────────────────────
interface WeatherPreviewProps {
  deal: Deal;
}

export default function WeatherPreview({ deal }: WeatherPreviewProps) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;
  const [expanded, setExpanded] = useState(false);

  const monthIdx = getMonthIndex(deal.travel_window || deal.dateString);
  const region = getRegion(deal.continent, deal.destination);
  const data = monthIdx !== null ? WEATHER_DATA[region]?.[monthIdx] : null;

  if (!data) return null;

  const monthLabel = monthIdx !== null ? MONTH_LABELS[monthIdx] : "";

  const accentColor = scheme === "dark" ? "#60a5fa" : "#2563eb";
  const bgColor = scheme === "dark" ? "rgba(59,130,246,0.1)" : "#eff6ff";
  const borderColor = scheme === "dark" ? "rgba(30,58,138,0.5)" : "#dbeafe";

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => setExpanded((v) => !v)}
      style={[styles.container, { backgroundColor: bgColor, borderColor }]}
    >
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <WeatherIcon type={data.icon} />
        </View>
        <View style={styles.textContent}>
          <View style={styles.topRow}>
            <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>
              Weather in {monthLabel}
            </Text>
            <View style={styles.topRowRight}>
              <Text style={[styles.tempText, { color: accentColor }]}>{data.temp}</Text>
              {expanded
                ? <ChevronUp size={14} color={theme.mutedForeground} />
                : <ChevronDown size={14} color={theme.mutedForeground} />
              }
            </View>
          </View>
          <Text style={[styles.seasonLabel, { color: theme.foreground }]}>{data.label}</Text>
          <Text style={[styles.desc, { color: theme.mutedForeground }]}>{data.desc}</Text>
        </View>
      </View>

      {expanded && (
        <View style={[styles.expandedSection, { borderTopColor: borderColor }]}>
          <Text style={[styles.expandedText, { color: theme.foreground }]}>
            {data.details}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  iconWrap: {
    marginTop: 2,
  },
  textContent: {
    flex: 1,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  topRowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tempText: {
    fontSize: 11,
    fontWeight: "700",
  },
  seasonLabel: {
    fontSize: 14,
    fontWeight: "700",
  },
  desc: {
    fontSize: 12,
    marginTop: 2,
  },
  expandedSection: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  expandedText: {
    fontSize: 13,
    lineHeight: 20,
  },
});
