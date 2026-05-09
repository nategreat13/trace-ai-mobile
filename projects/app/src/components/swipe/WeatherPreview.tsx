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
  details: string;
  icon: "sun" | "rain" | "snow" | "cloud" | "partly";
}

const WEATHER_DATA: Record<string, Record<number, WeatherEntry>> = {
  tropical: {
    0:  { label: "Dry Season",          temp: "75-88°F", desc: "Sunny, low humidity -- ideal travel weather",   icon: "sun",    details: "Peak dry season — clear skies, low humidity, and the easiest travel conditions of the year." },
    1:  { label: "Dry Season",          temp: "77-90°F", desc: "Warm and sunny with light breezes",             icon: "sun",    details: "Still dry and sunny with slightly thinner crowds than January — a solid sweet spot." },
    2:  { label: "Dry Season",          temp: "80-93°F", desc: "Hot and clear -- pack light clothing",          icon: "sun",    details: "Hot and mostly clear, though occasional afternoon showers start creeping in by month's end." },
    3:  { label: "Transition",          temp: "82-95°F", desc: "Getting hotter, occasional showers",            icon: "partly", details: "Rising humidity and brief afternoon showers signal the shift toward rainy season — mornings stay clear." },
    4:  { label: "Rainy Season Begins", temp: "80-93°F", desc: "Short afternoon rain showers likely",           icon: "rain",   details: "Rainy season begins with daily afternoon showers (1-2 hrs), but mornings are usable and prices drop." },
    5:  { label: "Rainy Season",        temp: "78-90°F", desc: "Frequent showers, lush greenery",               icon: "rain",   details: "Frequent heavy showers but usually short — pack a waterproof jacket and enjoy the empty beaches." },
    6:  { label: "Rainy Season",        temp: "78-88°F", desc: "Wettest month -- pack a rain jacket",           icon: "rain",   details: "Wettest month — heavy afternoon storms, rock-bottom prices, and a lush, uncrowded destination." },
    7:  { label: "Rainy Season",        temp: "78-88°F", desc: "Warm with heavy showers",                       icon: "rain",   details: "Deep rainy season but manageable — mornings often clear, with indoor cultural sites as a great backup." },
    8:  { label: "Transition",          temp: "79-90°F", desc: "Rain tapering off, still warm",                 icon: "partly", details: "Rain tapering off — a transitional month with shoulder-season prices and increasingly reliable weather." },
    9:  { label: "Dry Season Begins",   temp: "79-91°F", desc: "Cooling down, less rain",                       icon: "partly", details: "Dry season returning — skies clearing, humidity dropping, and tourist crowds still thin." },
    10: { label: "Dry Season",          temp: "77-89°F", desc: "Pleasant and sunny",                            icon: "sun",    details: "Reliable dry season weather with pre-peak crowd levels — one of the year's best value months." },
    11: { label: "Dry Season",          temp: "75-88°F", desc: "Perfect weather, peak season",                  icon: "sun",    details: "Peak dry season with a festive atmosphere — book early; clear skies are guaranteed but so are the crowds." },
  },
  temperate_north: {
    0:  { label: "Winter",       temp: "28-45°F", desc: "Cold with possible snow -- bundle up",           icon: "snow",   details: "Coldest month — possible snow and short days, but fewer tourists, lower prices, and a cozy atmosphere." },
    1:  { label: "Winter",       temp: "30-47°F", desc: "Still cold but days getting longer",             icon: "snow",   details: "Still cold but days are visibly lengthening — thin crowds and the year's lowest hotel prices." },
    2:  { label: "Early Spring", temp: "40-58°F", desc: "Chilly and fresh, flowers starting to bloom",    icon: "partly", details: "Early spring transition — cool mornings, increasingly pleasant afternoons, and the city waking up." },
    3:  { label: "Spring",       temp: "50-65°F", desc: "Mild and pleasant with some rain",               icon: "partly", details: "Comfortable spring weather with some rain — longer days and popular sites starting to buzz again." },
    4:  { label: "Spring",       temp: "58-72°F", desc: "Warm and beautiful, great for sightseeing",      icon: "sun",    details: "Arguably the best month — warm, long days without peak summer crowds or prices." },
    5:  { label: "Early Summer", temp: "65-80°F", desc: "Warm and sunny -- peak season begins",           icon: "sun",    details: "Peak season begins — warm, long days with outdoor events, but book ahead as crowds pick up fast." },
    6:  { label: "Summer",       temp: "72-88°F", desc: "Hot and sunny, long daylight hours",             icon: "sun",    details: "Peak summer — hot days, long evenings, maximum energy, and maximum prices." },
    7:  { label: "Summer",       temp: "70-87°F", desc: "Peak summer heat -- stay hydrated",              icon: "sun",    details: "Still peak summer heat — excellent weather but crowded; go early to attractions to beat the rush." },
    8:  { label: "Early Fall",   temp: "62-78°F", desc: "Warm days, cooler evenings -- ideal weather",    icon: "partly", details: "Best-kept secret — summer crowds gone, prices dropped, but the weather is still excellent." },
    9:  { label: "Fall",         temp: "50-65°F", desc: "Crisp autumn air, stunning foliage",             icon: "partly", details: "Crisp autumn air and spectacular foliage — comfortable temperatures and a noticeable crowd drop." },
    10: { label: "Late Fall",    temp: "38-52°F", desc: "Getting chilly, bring a jacket",                 icon: "cloud",  details: "Getting cold and overcast — low season value with a quieter, more local atmosphere." },
    11: { label: "Winter",       temp: "30-45°F", desc: "Cold with festive holiday atmosphere",           icon: "snow",   details: "Cold with festive holiday magic — great in early December; prices spike close to Christmas." },
  },
  temperate_south: {
    0:  { label: "Summer",        temp: "72-88°F", desc: "Hot and sunny -- peak summer",               icon: "sun",    details: "Peak southern hemisphere summer — hot, busy, and festive; book everything well in advance." },
    1:  { label: "Summer",        temp: "70-87°F", desc: "Warm and dry, long evenings",                icon: "sun",    details: "Warm summer continues with slightly thinner crowds than January — great conditions at better value." },
    2:  { label: "Late Summer",   temp: "65-82°F", desc: "Warm with pleasant breezes",                 icon: "sun",    details: "Late summer sweet spot — comfortable heat, dropping crowds, and reasonable prices." },
    3:  { label: "Early Fall",    temp: "58-74°F", desc: "Mild and comfortable, less crowded",         icon: "partly", details: "Early autumn — mild, comfortable, and noticeably quieter as the summer rush fades." },
    4:  { label: "Fall",          temp: "50-65°F", desc: "Crisp air, beautiful autumn colors",         icon: "partly", details: "Crisp autumn weather with beautiful foliage and low crowds — an underrated time to visit." },
    5:  { label: "Winter Begins", temp: "42-57°F", desc: "Cooling down, quieter season",               icon: "cloud",  details: "Winter begins — cool and quiet with good value and a more authentic local atmosphere." },
    6:  { label: "Winter",        temp: "38-52°F", desc: "Cool and overcast -- pack layers",           icon: "cloud",  details: "Heart of winter — coldest month but blissfully uncrowded and at the year's lowest prices." },
    7:  { label: "Winter",        temp: "40-54°F", desc: "Cool days, cold nights",                     icon: "cloud",  details: "Still cold but days are lengthening — good value with occasional warm spells late in the month." },
    8:  { label: "Early Spring",  temp: "48-62°F", desc: "Warming up, wildflowers emerging",           icon: "partly", details: "Spring arrives — warming temperatures, wildflowers everywhere, and shoulder-season prices still in effect." },
    9:  { label: "Spring",        temp: "55-70°F", desc: "Lovely spring weather, great for outdoors",  icon: "sun",    details: "Prime spring travel — warm, lush, and before the summer price surge." },
    10: { label: "Late Spring",   temp: "62-78°F", desc: "Warm and sunny, pre-summer crowds",          icon: "sun",    details: "Warm late spring with long days — excellent conditions before December peak pricing kicks in." },
    11: { label: "Early Summer",  temp: "68-84°F", desc: "Hot and festive, peak holiday season",       icon: "sun",    details: "Summer kicks off with hot weather and festive energy — book early as the season fills fast." },
  },
};

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

function parseTempRange(temp: string): { low: number; high: number } | null {
  const match = temp.match(/(\d+)-(\d+)/);
  if (!match) return null;
  return { low: parseInt(match[1], 10), high: parseInt(match[2], 10) };
}

// ── Day temperature timeline ─────────────────────────────────────────────────
const TIME_SLOTS = [
  { icon: "🌅", label: "Morning",  fraction: 0.35 },
  { icon: "☀️",  label: "Noon",     fraction: 1.00 },
  { icon: "🌆", label: "Evening",  fraction: 0.60 },
  { icon: "🌙", label: "Night",    fraction: 0.00 },
];

const BAR_MAX_H = 36;
const BAR_MIN_H = 6;

function DayTempTimeline({ temp, accentColor, borderColor, theme }: {
  temp: string;
  accentColor: string;
  borderColor: string;
  theme: any;
}) {
  const range = parseTempRange(temp);
  if (!range) return null;
  const { low, high } = range;
  const span = high - low;

  const slots = TIME_SLOTS.map((s) => ({
    ...s,
    tempVal: Math.round(low + span * s.fraction),
  }));

  return (
    <View style={tlStyles.container}>
      {slots.map((slot, i) => {
        const barH = BAR_MIN_H + slot.fraction * (BAR_MAX_H - BAR_MIN_H);
        const isHigh = slot.fraction >= 0.9;
        return (
          <View key={i} style={tlStyles.col}>
            <Text style={[tlStyles.tempVal, { color: isHigh ? accentColor : theme.foreground }]}>
              {slot.tempVal}°
            </Text>
            <View style={tlStyles.barContainer}>
              <View
                style={[
                  tlStyles.bar,
                  {
                    height: barH,
                    backgroundColor: isHigh ? accentColor : borderColor,
                    opacity: isHigh ? 1 : 0.5 + slot.fraction * 0.5,
                  },
                ]}
              />
            </View>
            <Text style={tlStyles.slotIcon}>{slot.icon}</Text>
            <Text style={[tlStyles.slotLabel, { color: theme.mutedForeground }]}>{slot.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const tlStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: 4,
  },
  col: {
    flex: 1,
    alignItems: "center",
    gap: 3,
  },
  tempVal: {
    fontSize: 13,
    fontWeight: "700",
  },
  barContainer: {
    height: BAR_MAX_H,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  bar: {
    width: 10,
    borderRadius: 5,
  },
  slotIcon: {
    fontSize: 14,
  },
  slotLabel: {
    fontSize: 10,
    fontWeight: "600",
  },
});

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
  const accentColor = scheme === "dark" ? "#60a5fa" : "#2563eb";
  const borderColor = scheme === "dark" ? "rgba(30,58,138,0.5)" : "#dbeafe";
  const dividerColor = scheme === "dark" ? "rgba(30,58,138,0.4)" : "#dbeafe";

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => setExpanded((v) => !v)}
      style={[
        styles.container,
        {
          backgroundColor: scheme === "dark" ? "rgba(59,130,246,0.1)" : "#eff6ff",
          borderColor,
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
              <Text style={[styles.tempText, { color: accentColor }]}>{data.temp}</Text>
              {expanded
                ? <ChevronUp size={14} color={accentColor} />
                : <ChevronDown size={14} color={accentColor} />}
            </View>
          </View>
          <Text style={[styles.seasonLabel, { color: theme.foreground }]}>{data.label}</Text>
          <Text style={[styles.desc, { color: theme.mutedForeground }]}>{data.desc}</Text>
        </View>
      </View>

      {expanded && (
        <View style={[styles.expandedContent, { borderTopColor: dividerColor }]}>

          {/* Day temperature timeline */}
          <DayTempTimeline
            temp={data.temp}
            accentColor={accentColor}
            borderColor={borderColor}
            theme={theme}
          />

          {/* What to pack */}
          <View style={[styles.expandedRow, { borderTopColor: dividerColor }]}>
            <Text style={[styles.expandedLabel, { color: theme.mutedForeground }]}>What to pack</Text>
            <Text style={[styles.expandedValue, { color: theme.foreground }]}>{packingTip}</Text>
          </View>

          {/* Local climate */}
          <View style={[styles.expandedRow, { borderTopColor: dividerColor }]}>
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
    marginTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 14,
    gap: 14,
  },
  expandedRow: {
    gap: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
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
