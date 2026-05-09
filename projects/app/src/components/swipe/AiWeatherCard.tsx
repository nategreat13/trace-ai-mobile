import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Cloud, Sun, CloudRain, CloudSnow, ChevronDown, ChevronUp } from "lucide-react-native";
import { WeatherInfo } from "../../lib/destinationData";

// ── Icon helpers ─────────────────────────────────────────────────────────────
const ICON_COLORS: Record<string, string> = {
  sun: "#f59e0b",
  rain: "#3b82f6",
  snow: "#38bdf8",
  cloud: "#94a3b8",
  partly: "#60a5fa",
};

function WeatherIcon({ type }: { type: string }) {
  const color = ICON_COLORS[type] || ICON_COLORS.cloud;
  if (type === "sun") return <Sun size={24} color={color} />;
  if (type === "rain") return <CloudRain size={24} color={color} />;
  if (type === "snow") return <CloudSnow size={24} color={color} />;
  return <Cloud size={24} color={color} />;
}

// ── Day temperature timeline ─────────────────────────────────────────────────
function parseTempRange(temp: string): { low: number; high: number } | null {
  const match = temp.match(/(\d+)-(\d+)/);
  if (!match) return null;
  return { low: parseInt(match[1], 10), high: parseInt(match[2], 10) };
}

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

  return (
    <View style={tlStyles.container}>
      {TIME_SLOTS.map((slot, i) => {
        const barH = BAR_MIN_H + slot.fraction * (BAR_MAX_H - BAR_MIN_H);
        const isHigh = slot.fraction >= 0.9;
        return (
          <View key={i} style={tlStyles.col}>
            <Text style={[tlStyles.tempVal, { color: isHigh ? accentColor : theme.foreground }]}>
              {Math.round(low + span * slot.fraction)}°
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
  col: { flex: 1, alignItems: "center", gap: 3 },
  tempVal: { fontSize: 13, fontWeight: "700" },
  barContainer: { height: BAR_MAX_H, justifyContent: "flex-end", alignItems: "center" },
  bar: { width: 10, borderRadius: 5 },
  slotIcon: { fontSize: 14 },
  slotLabel: { fontSize: 10, fontWeight: "600" },
});

// ── AiWeatherCard ────────────────────────────────────────────────────────────
interface Props {
  weather: WeatherInfo;
  scheme: "dark" | "light" | null | undefined;
  theme: any;
}

export default function AiWeatherCard({ weather, scheme, theme }: Props) {
  const [expanded, setExpanded] = useState(false);

  const accentColor = scheme === "dark" ? "#60a5fa" : "#2563eb";
  const borderColor = scheme === "dark" ? "rgba(30,58,138,0.5)" : "#dbeafe";
  const dividerColor = scheme === "dark" ? "rgba(30,58,138,0.4)" : "#dbeafe";
  const bgColor = scheme === "dark" ? "rgba(59,130,246,0.1)" : "#eff6ff";

  const h = weather.humidity;
  const humidityLevel = h < 55 ? "Low" : h < 70 ? "Moderate" : "High";
  const humidityColor = h < 55 ? "#0ea5e9" : h < 70 ? "#f59e0b" : "#3b82f6";

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => setExpanded((v) => !v)}
      style={[styles.container, { backgroundColor: bgColor, borderColor }]}
    >
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <WeatherIcon type={weather.icon} />
        </View>
        <View style={styles.textContent}>
          <View style={styles.topRow}>
            <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>Weather</Text>
            <View style={styles.topRowRight}>
              <Text style={[styles.tempText, { color: accentColor }]}>{weather.temp}</Text>
              {expanded
                ? <ChevronUp size={14} color={accentColor} />
                : <ChevronDown size={14} color={accentColor} />}
            </View>
          </View>
          <Text style={[styles.seasonLabel, { color: theme.foreground }]}>{weather.label}</Text>
          <Text style={[styles.desc, { color: theme.mutedForeground }]}>{weather.desc}</Text>
        </View>
      </View>

      {expanded && (
        <View style={[styles.expandedContent, { borderTopColor: dividerColor }]}>
          <DayTempTimeline
            temp={weather.temp}
            accentColor={accentColor}
            borderColor={borderColor}
            theme={theme}
          />

          <View style={[styles.expandedRow, { borderTopColor: dividerColor }]}>
            <View style={styles.humidityHeader}>
              <Text style={[styles.expandedLabel, { color: theme.mutedForeground }]}>Humidity</Text>
              <Text style={[styles.humidityBadge, { color: humidityColor }]}>{humidityLevel} · {h}%</Text>
            </View>
            <View style={[styles.humidityTrack, { backgroundColor: scheme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)" }]}>
              <View style={[styles.humidityFill, { width: `${h}%` as any, backgroundColor: humidityColor }]} />
            </View>
          </View>

          <View style={[styles.expandedRow, { borderTopColor: dividerColor }]}>
            <Text style={[styles.expandedLabel, { color: theme.mutedForeground }]}>What to pack</Text>
            <Text style={[styles.expandedValue, { color: theme.foreground }]}>{weather.packingTip}</Text>
          </View>

          <View style={[styles.expandedRow, { borderTopColor: dividerColor }]}>
            <Text style={[styles.expandedLabel, { color: theme.mutedForeground }]}>Local climate</Text>
            <Text style={[styles.expandedValue, { color: theme.foreground }]}>{weather.details}</Text>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 16, padding: 16, borderWidth: 1 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  iconWrap: { marginTop: 2 },
  textContent: { flex: 1 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 2 },
  topRowRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  sectionLabel: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  tempText: { fontSize: 11, fontWeight: "700" },
  seasonLabel: { fontSize: 14, fontWeight: "700" },
  desc: { fontSize: 12, marginTop: 2 },
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
  expandedLabel: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8 },
  expandedValue: { fontSize: 13, lineHeight: 19 },
  humidityHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  humidityBadge: { fontSize: 11, fontWeight: "700" },
  humidityTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  humidityFill: { height: 6, borderRadius: 3 },
});
