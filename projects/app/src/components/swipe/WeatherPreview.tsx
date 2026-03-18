import React from "react";
import { View, Text, StyleSheet, useColorScheme } from "react-native";
import { Cloud, Sun, CloudRain, CloudSnow } from "lucide-react-native";
import { Deal } from "@trace/shared";
import { colors } from "../../theme/colors";

// ── Weather data by region and month ────────────────────────────────────────
const WEATHER_DATA: Record<string, Record<number, WeatherEntry>> = {
  tropical: {
    0:  { label: "Dry Season",          temp: "75-88\u00B0F", desc: "Sunny, low humidity -- ideal travel weather",   icon: "sun"   },
    1:  { label: "Dry Season",          temp: "77-90\u00B0F", desc: "Warm and sunny with light breezes",             icon: "sun"   },
    2:  { label: "Dry Season",          temp: "80-93\u00B0F", desc: "Hot and clear -- pack light clothing",          icon: "sun"   },
    3:  { label: "Transition",          temp: "82-95\u00B0F", desc: "Getting hotter, occasional showers",            icon: "partly"},
    4:  { label: "Rainy Season Begins", temp: "80-93\u00B0F", desc: "Short afternoon rain showers likely",           icon: "rain"  },
    5:  { label: "Rainy Season",        temp: "78-90\u00B0F", desc: "Frequent showers, lush greenery",               icon: "rain"  },
    6:  { label: "Rainy Season",        temp: "78-88\u00B0F", desc: "Wettest month -- pack a rain jacket",           icon: "rain"  },
    7:  { label: "Rainy Season",        temp: "78-88\u00B0F", desc: "Warm with heavy showers",                       icon: "rain"  },
    8:  { label: "Transition",          temp: "79-90\u00B0F", desc: "Rain tapering off, still warm",                 icon: "partly"},
    9:  { label: "Dry Season Begins",   temp: "79-91\u00B0F", desc: "Cooling down, less rain",                       icon: "partly"},
    10: { label: "Dry Season",          temp: "77-89\u00B0F", desc: "Pleasant and sunny",                            icon: "sun"   },
    11: { label: "Dry Season",          temp: "75-88\u00B0F", desc: "Perfect weather, peak season",                  icon: "sun"   },
  },
  temperate_north: {
    0:  { label: "Winter",       temp: "28-45\u00B0F", desc: "Cold with possible snow -- bundle up",           icon: "snow"  },
    1:  { label: "Winter",       temp: "30-47\u00B0F", desc: "Still cold but days getting longer",             icon: "snow"  },
    2:  { label: "Early Spring", temp: "40-58\u00B0F", desc: "Chilly and fresh, flowers starting to bloom",    icon: "partly"},
    3:  { label: "Spring",       temp: "50-65\u00B0F", desc: "Mild and pleasant with some rain",               icon: "partly"},
    4:  { label: "Spring",       temp: "58-72\u00B0F", desc: "Warm and beautiful, great for sightseeing",      icon: "sun"   },
    5:  { label: "Early Summer", temp: "65-80\u00B0F", desc: "Warm and sunny -- peak season begins",           icon: "sun"   },
    6:  { label: "Summer",       temp: "72-88\u00B0F", desc: "Hot and sunny, long daylight hours",             icon: "sun"   },
    7:  { label: "Summer",       temp: "70-87\u00B0F", desc: "Peak summer heat -- stay hydrated",              icon: "sun"   },
    8:  { label: "Early Fall",   temp: "62-78\u00B0F", desc: "Warm days, cooler evenings -- ideal weather",    icon: "partly"},
    9:  { label: "Fall",         temp: "50-65\u00B0F", desc: "Crisp autumn air, stunning foliage",             icon: "partly"},
    10: { label: "Late Fall",    temp: "38-52\u00B0F", desc: "Getting chilly, bring a jacket",                 icon: "cloud" },
    11: { label: "Winter",       temp: "30-45\u00B0F", desc: "Cold with festive holiday atmosphere",           icon: "snow"  },
  },
  temperate_south: {
    0:  { label: "Summer",        temp: "72-88\u00B0F", desc: "Hot and sunny -- peak summer",               icon: "sun"   },
    1:  { label: "Summer",        temp: "70-87\u00B0F", desc: "Warm and dry, long evenings",                icon: "sun"   },
    2:  { label: "Late Summer",   temp: "65-82\u00B0F", desc: "Warm with pleasant breezes",                 icon: "sun"   },
    3:  { label: "Early Fall",    temp: "58-74\u00B0F", desc: "Mild and comfortable, less crowded",         icon: "partly"},
    4:  { label: "Fall",          temp: "50-65\u00B0F", desc: "Crisp air, beautiful autumn colors",         icon: "partly"},
    5:  { label: "Winter Begins", temp: "42-57\u00B0F", desc: "Cooling down, quieter season",               icon: "cloud" },
    6:  { label: "Winter",        temp: "38-52\u00B0F", desc: "Cool and overcast -- pack layers",           icon: "cloud" },
    7:  { label: "Winter",        temp: "40-54\u00B0F", desc: "Cool days, cold nights",                     icon: "cloud" },
    8:  { label: "Early Spring",  temp: "48-62\u00B0F", desc: "Warming up, wildflowers emerging",           icon: "partly"},
    9:  { label: "Spring",        temp: "55-70\u00B0F", desc: "Lovely spring weather, great for outdoors",  icon: "sun"   },
    10: { label: "Late Spring",   temp: "62-78\u00B0F", desc: "Warm and sunny, pre-summer crowds",          icon: "sun"   },
    11: { label: "Early Summer",  temp: "68-84\u00B0F", desc: "Hot and festive, peak holiday season",       icon: "sun"   },
  },
};

interface WeatherEntry {
  label: string;
  temp: string;
  desc: string;
  icon: "sun" | "rain" | "snow" | "cloud" | "partly";
}

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

  const monthIdx = getMonthIndex(deal.travel_window || deal.dateString);
  const region = getRegion(deal.continent, deal.destination);
  const data = monthIdx !== null ? WEATHER_DATA[region]?.[monthIdx] : null;

  if (!data) return null;

  const monthLabel = deal.travel_window?.split(" - ")[0]?.split(" ")[0] || "";

  return (
    <View
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
            <Text style={[styles.tempText, { color: scheme === "dark" ? "#60a5fa" : "#2563eb" }]}>
              {data.temp}
            </Text>
          </View>
          <Text style={[styles.seasonLabel, { color: theme.foreground }]}>{data.label}</Text>
          <Text style={[styles.desc, { color: theme.mutedForeground }]}>{data.desc}</Text>
        </View>
      </View>
    </View>
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
});
