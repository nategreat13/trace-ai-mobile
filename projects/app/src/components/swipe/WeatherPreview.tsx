import React, { useState } from "react";
import { View, Text, StyleSheet, useColorScheme, TouchableOpacity } from "react-native";
import { Cloud, Sun, CloudRain, CloudSnow, ChevronDown, ChevronUp } from "lucide-react-native";
import { Deal } from "@trace/shared";
import { colors } from "../../theme/colors";

// ── Weather data by region and month ────────────────────────────────────────
const WEATHER_DATA: Record<string, Record<number, WeatherEntry>> = {
  tropical: {
    0:  { label: "Dry Season",          temp: "75-88\u00B0F", desc: "Sunny, low humidity -- ideal travel weather",   icon: "sun",    details: "January is peak dry season -- consistently sunny with low humidity and a reliable sea breeze. Evenings cool down nicely. This is the most popular travel window, so expect higher prices and busier attractions." },
    1:  { label: "Dry Season",          temp: "77-90\u00B0F", desc: "Warm and sunny with light breezes",             icon: "sun",    details: "February stays sunny and dry with slightly warmer temperatures than January. Crowds thin a little compared to peak holiday season, making it a sweet spot for the region. Ideal for outdoor activities and beach days." },
    2:  { label: "Dry Season",          temp: "80-93\u00B0F", desc: "Hot and clear -- pack light clothing",          icon: "sun",    details: "March brings intensifying heat as the dry season peaks. Mornings are best for sightseeing before the midday sun sets in. The lack of rain keeps skies blue but UV levels are high -- sunscreen is essential." },
    3:  { label: "Transition",          temp: "82-95\u00B0F", desc: "Getting hotter, occasional showers",            icon: "partly", details: "April marks the shift toward wet season with rising humidity and brief afternoon showers that cool things down quickly. Mornings are still clear and good for exploring. A light rain layer is worth packing." },
    4:  { label: "Rainy Season Begins", temp: "80-93\u00B0F", desc: "Short afternoon rain showers likely",           icon: "rain",   details: "May signals the start of rainy season -- expect daily showers, usually in the afternoon, lasting 1-2 hours. Mornings are still usable and the landscape turns lush and green. Fewer tourists means better prices and quieter sites." },
    5:  { label: "Rainy Season",        temp: "78-90\u00B0F", desc: "Frequent showers, lush greenery",               icon: "rain",   details: "June brings frequent rainfall and high humidity, but storms tend to be intense and short rather than all-day drizzle. The green scenery is stunning. A packable waterproof jacket and quick-dry clothes make a big difference." },
    6:  { label: "Rainy Season",        temp: "78-88\u00B0F", desc: "Wettest month -- pack a rain jacket",           icon: "rain",   details: "July is typically the wettest month in tropical destinations. Heavy rain can disrupt outdoor plans, especially in the afternoons and evenings. Budget hotels and tour operators often discount significantly during this period." },
    7:  { label: "Rainy Season",        temp: "78-88\u00B0F", desc: "Warm with heavy showers",                       icon: "rain",   details: "August remains firmly in rainy season with similar conditions to July. However, many travelers find it perfectly manageable -- mornings are often clear and rain is usually predictable. Indoor cultural attractions are a good backup plan." },
    8:  { label: "Transition",          temp: "79-90\u00B0F", desc: "Rain tapering off, still warm",                 icon: "partly", details: "September sees rainfall starting to ease up, though conditions remain unpredictable. It's a transitional month that rewards flexible travelers with shoulder-season prices and noticeably fewer crowds than the dry season peak." },
    9:  { label: "Dry Season Begins",   temp: "79-91\u00B0F", desc: "Cooling down, less rain",                       icon: "partly", details: "October signals the return of the dry season, with skies clearing and humidity dropping. Temperatures remain warm but more comfortable than the wet season peak. An underrated time to visit before the holiday crowds arrive." },
    10: { label: "Dry Season",          temp: "77-89\u00B0F", desc: "Pleasant and sunny",                            icon: "sun",    details: "November offers some of the best travel conditions of the year -- reliable sunshine, moderate humidity, and pre-peak-season crowd levels. Prices are still reasonable before the December holiday rush begins." },
    11: { label: "Dry Season",          temp: "75-88\u00B0F", desc: "Perfect weather, peak season",                  icon: "sun",    details: "December is peak season in tropical destinations with dry, sunny weather and festive atmosphere. Expect higher prices and advance booking requirements for popular accommodation. The weather delivers -- clear skies and comfortable evenings are the norm." },
  },
  temperate_north: {
    0:  { label: "Winter",       temp: "28-45\u00B0F", desc: "Cold with possible snow -- bundle up",           icon: "snow",   details: "January is the coldest month. Snow is possible and daylight hours are short. That said, winter travel has its own appeal -- fewer tourists, lower prices, and a cozy atmosphere. Indoor cultural attractions are at their best this time of year." },
    1:  { label: "Winter",       temp: "30-47\u00B0F", desc: "Still cold but days getting longer",             icon: "snow",   details: "February is still cold but you start to notice the days lengthening. Late-month temperatures can surprise you with mild spells. Crowds remain thin and hotel prices are typically at their annual low point." },
    2:  { label: "Early Spring", temp: "40-58\u00B0F", desc: "Chilly and fresh, flowers starting to bloom",    icon: "partly", details: "March is the start of the transition -- mornings are still cool but afternoons can be genuinely pleasant. Spring blooms begin appearing and the city feels like it's waking up. Layers are essential as temperatures swing throughout the day." },
    3:  { label: "Spring",       temp: "50-65\u00B0F", desc: "Mild and pleasant with some rain",               icon: "partly", details: "April is a favorite month for many travelers -- comfortable temperatures, longer days, and the city in full spring color. Rain showers are common but brief. Popular sites start getting busier, especially around holidays." },
    4:  { label: "Spring",       temp: "58-72\u00B0F", desc: "Warm and beautiful, great for sightseeing",      icon: "sun",    details: "May is arguably the best month to visit -- warm, long days without the peak summer crowds or prices. Outdoor cafes, parks, and markets come fully alive. Book accommodation in advance as savvy travelers already know this is prime time." },
    5:  { label: "Early Summer", temp: "65-80\u00B0F", desc: "Warm and sunny -- peak season begins",           icon: "sun",    details: "June marks the start of peak summer with warm, reliable weather and very long days. Outdoor events and festivals fill the calendar. Prices rise and popular attractions get busy -- book ahead and aim for early mornings to beat the crowds." },
    6:  { label: "Summer",       temp: "72-88\u00B0F", desc: "Hot and sunny, long daylight hours",             icon: "sun",    details: "July is peak summer -- hot days, long evenings, and the city at its most vibrant. It's also the busiest and most expensive time of year. Despite the crowds, the energy is unbeatable and the weather is consistently good." },
    7:  { label: "Summer",       temp: "70-87\u00B0F", desc: "Peak summer heat -- stay hydrated",              icon: "sun",    details: "August stays hot and busy. The height of tourist season means crowded attractions and premium pricing, but the weather is reliably excellent. Evening temperatures are comfortable for outdoor dining. Staying hydrated in the midday heat is important." },
    8:  { label: "Early Fall",   temp: "62-78\u00B0F", desc: "Warm days, cooler evenings -- ideal weather",    icon: "partly", details: "September is one of the best-kept travel secrets -- summer crowds disappear, prices drop, but the weather remains excellent. Warm days and cool evenings are perfect for exploring. This is arguably the ideal time to visit for most travelers." },
    9:  { label: "Fall",         temp: "50-65\u00B0F", desc: "Crisp autumn air, stunning foliage",             icon: "partly", details: "October brings crisp air and spectacular autumn colors. Days are cooler but still comfortable for sightseeing, and the golden light is beautiful for photos. Crowds and prices have retreated significantly from summer peaks." },
    10: { label: "Late Fall",    temp: "38-52\u00B0F", desc: "Getting chilly, bring a jacket",                 icon: "cloud",  details: "November gets noticeably cold with shorter days and overcast skies becoming more common. It's low season with good value on flights and hotels. The city takes on a quieter, more local character as tourists thin out significantly." },
    11: { label: "Winter",       temp: "30-45\u00B0F", desc: "Cold with festive holiday atmosphere",           icon: "snow",   details: "December brings cold weather but also festive markets, holiday lights, and a magical atmosphere in many cities. It's busy around the holidays and prices spike in late December -- traveling in early December gets you the festive vibe at better rates." },
  },
  temperate_south: {
    0:  { label: "Summer",        temp: "72-88\u00B0F", desc: "Hot and sunny -- peak summer",               icon: "sun",    details: "January is peak summer in the southern hemisphere -- long days, hot temperatures, and the busiest travel season. Book well in advance. The heat is intense midday so mornings and evenings are the best times to explore outdoors." },
    1:  { label: "Summer",        temp: "70-87\u00B0F", desc: "Warm and dry, long evenings",                icon: "sun",    details: "February remains firmly in summer with warm, dry conditions and long evenings. Crowds start to ease slightly from the January peak while the weather stays excellent. A great month to visit if you want summer without the holiday rush." },
    2:  { label: "Late Summer",   temp: "65-82\u00B0F", desc: "Warm with pleasant breezes",                 icon: "sun",    details: "March is the end of summer and one of the most comfortable months -- temperatures are warm but no longer oppressive, and crowd levels are dropping. An often-overlooked sweet spot for travel in this region." },
    3:  { label: "Early Fall",    temp: "58-74\u00B0F", desc: "Mild and comfortable, less crowded",         icon: "partly", details: "April brings early autumn conditions with mild, comfortable temperatures and a noticeable drop in tourist numbers. The landscape starts showing autumn colors. Prices are reasonable and the weather is very pleasant for walking and outdoor activities." },
    4:  { label: "Fall",          temp: "50-65\u00B0F", desc: "Crisp air, beautiful autumn colors",         icon: "partly", details: "May offers crisp autumn weather with beautiful foliage and low tourist numbers. It's a genuinely underrated time to visit -- good value on accommodation, minimal crowds, and pleasant temperatures for sightseeing." },
    5:  { label: "Winter Begins", temp: "42-57\u00B0F", desc: "Cooling down, quieter season",               icon: "cloud",  details: "June marks the start of winter in the southern hemisphere. Temperatures cool noticeably and days are shorter. It's low season for tourism, which means good value and a more local atmosphere. Layering up is essential, especially in the evenings." },
    6:  { label: "Winter",        temp: "38-52\u00B0F", desc: "Cool and overcast -- pack layers",           icon: "cloud",  details: "July is the heart of winter -- cool, sometimes overcast, with the shortest days of the year. Indoor cultural experiences are excellent this time of year. Prices are at their lowest and popular attractions are blissfully uncrowded." },
    7:  { label: "Winter",        temp: "40-54\u00B0F", desc: "Cool days, cold nights",                     icon: "cloud",  details: "August stays cold but days are beginning to lengthen again. The end of winter brings occasional warm spells. Late August can feel noticeably different to early August -- a transitional month with good value and improving conditions." },
    8:  { label: "Early Spring",  temp: "48-62\u00B0F", desc: "Warming up, wildflowers emerging",           icon: "partly", details: "September is the start of spring -- temperatures are rising, wildflowers are blooming, and the city is coming back to life. Shoulder season prices are still in effect but the weather is becoming genuinely pleasant. An excellent time to visit." },
    9:  { label: "Spring",        temp: "55-70\u00B0F", desc: "Lovely spring weather, great for outdoors",  icon: "sun",    details: "October is prime spring travel -- warm enough for comfortable outdoor exploring, still before the summer crowd and price surge. The landscape is lush and green. One of the best months to visit this region for most travelers." },
    10: { label: "Late Spring",   temp: "62-78\u00B0F", desc: "Warm and sunny, pre-summer crowds",          icon: "sun",    details: "November brings warm, sunny weather and noticeably longer days as summer approaches. Crowds are building but haven't hit peak yet -- a good window before prices spike in December. Outdoor activities are at their best." },
    11: { label: "Early Summer",  temp: "68-84\u00B0F", desc: "Hot and festive, peak holiday season",       icon: "sun",    details: "December opens summer in the southern hemisphere and the festive season in full swing. Expect hot weather, holiday energy, and rising prices as the season peaks. Book accommodation well in advance, especially around Christmas and New Year." },
  },
};

interface WeatherEntry {
  label: string;
  temp: string;
  desc: string;
  details: string;
  icon: "sun" | "rain" | "snow" | "cloud" | "partly";
}

const PACKING_TIPS: Record<string, string> = {
  sun:    "Light, breathable clothing. Sunscreen, sunglasses, and a hat are essential.",
  rain:   "Waterproof jacket or compact umbrella. Quick-dry layers are your friend.",
  snow:   "Heavy coat, thermal base layers, waterproof boots, and gloves.",
  cloud:  "Bring a light jacket — temperatures can swing between morning and afternoon.",
  partly: "Layers work best. A light jacket for evenings and cooler spells.",
};

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

const ICON_SIZE = 24;

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

  const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const monthLabel = monthIdx !== null ? MONTH_LABELS[monthIdx] : "";
  const packingTip = PACKING_TIPS[data.icon] ?? PACKING_TIPS.cloud;
  const chevronColor = scheme === "dark" ? "#60a5fa" : "#2563eb";

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => setExpanded((v) => !v)}
      style={[
        styles.container,
        {
          backgroundColor: scheme === "dark" ? "rgba(59,130,246,0.1)" : "#eff6ff",
          borderColor: scheme === "dark" ? "rgba(30,58,138,0.5)" : "#dbeafe",
        },
      ]}
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
              <Text style={[styles.tempText, { color: chevronColor }]}>{data.temp}</Text>
              {expanded
                ? <ChevronUp size={14} color={chevronColor} />
                : <ChevronDown size={14} color={chevronColor} />}
            </View>
          </View>
          <Text style={[styles.seasonLabel, { color: theme.foreground }]}>{data.label}</Text>
          <Text style={[styles.desc, { color: theme.mutedForeground }]}>{data.desc}</Text>
        </View>
      </View>

      {expanded && (
        <View style={[styles.expandedContent, { borderTopColor: scheme === "dark" ? "rgba(30,58,138,0.4)" : "#dbeafe" }]}>
          <View style={styles.expandedRow}>
            <Text style={[styles.expandedLabel, { color: theme.mutedForeground }]}>What to pack</Text>
            <Text style={[styles.expandedValue, { color: theme.foreground }]}>{packingTip}</Text>
          </View>
          <View style={[styles.expandedRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: scheme === "dark" ? "rgba(30,58,138,0.4)" : "#dbeafe" }]}>
              <Text style={[styles.expandedLabel, { color: theme.mutedForeground }]}>Local climate</Text>
              <Text style={[styles.expandedValue, { color: theme.foreground }]}>{data.details}</Text>
            </View>
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
    gap: 4,
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
  expandedContent: {
    marginTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    gap: 10,
  },
  expandedRow: {
    gap: 4,
    paddingTop: 10,
  },
  expandedLabel: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  expandedValue: {
    fontSize: 13,
    lineHeight: 19,
  },
});
