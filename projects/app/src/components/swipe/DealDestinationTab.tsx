import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  ActivityIndicator,
} from "react-native";
import { Deal } from "@trace/shared";
import { colors } from "../../theme/colors";
import { useDestinationInfo } from "../../hooks/useDestinationInfo";

type Theme = typeof colors.dark | typeof colors.light;

interface Props {
  deal: Deal;
}

const PRICE_LEVELS: Record<"budget" | "moderate" | "premium", { label: string; symbol: string }> = {
  budget: { label: "Low-key", symbol: "$" },
  moderate: { label: "Mid-range", symbol: "$$" },
  premium: { label: "Splurge", symbol: "$$$" },
};

export default function DealDestinationTab({ deal }: Props) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;
  const { info, loading, error } = useDestinationInfo(deal);
  const [expandedNeighbourhood, setExpandedNeighbourhood] = useState<string | null>(null);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.brand.traceRed} />
        <Text style={[styles.loadingText, { color: theme.mutedForeground }]}>Loading destination guide…</Text>
      </View>
    );
  }

  if (error || !info) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={[styles.loadingText, { color: theme.mutedForeground }]}>Couldn't load destination info. Try again later.</Text>
      </View>
    );
  }

  const hasEssentialsGrid = !!(info.essentials.flag || info.essentials.currency || info.essentials.language || info.essentials.timezone || info.essentials.plug);

  return (
    <View style={styles.root}>

      {/* ── Essentials ──────────────────────────────────────────── */}
      <Section title="Essentials" theme={theme}>
        {hasEssentialsGrid && (
          <View style={[styles.essentialsGrid, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {!!info.essentials.flag && <EssRow label="Flag" value={info.essentials.flag} theme={theme} />}
            {!!info.essentials.currency && <EssRow label="Currency" value={info.essentials.currency} theme={theme} />}
            {!!info.essentials.language && <EssRow label="Language" value={info.essentials.language} theme={theme} />}
            {!!info.essentials.timezone && <EssRow label="Timezone" value={info.essentials.timezone} theme={theme} />}
            {!!info.essentials.plug && (
              <EssRow
                label="Power plug"
                value={`${info.essentials.plug}${info.essentials.needsAdapter ? " — adapter needed" : " — no adapter"}`}
                theme={theme}
                last
              />
            )}
          </View>
        )}
        {!!info.essentials.insiderNote && (
          <View style={[styles.insiderCard, { backgroundColor: scheme === "dark" ? "rgba(245,158,11,0.10)" : "rgba(245,158,11,0.07)", borderColor: scheme === "dark" ? "rgba(245,158,11,0.28)" : "rgba(245,158,11,0.20)" }]}>
            <Text style={styles.insiderIcon}>💡</Text>
            <Text style={[styles.insiderText, { color: theme.foreground }]}>{info.essentials.insiderNote}</Text>
          </View>
        )}
      </Section>

      {/* ── Neighbourhoods ──────────────────────────────────────── */}
      <Section title="Neighbourhoods" theme={theme}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalRow}
        >
          {info.neighborhoods.map((n) => {
            const isExpanded = expandedNeighbourhood === n.name;
            return (
              <TouchableOpacity
                key={n.name}
                activeOpacity={0.8}
                onPress={() => setExpandedNeighbourhood(isExpanded ? null : n.name)}
                style={[
                  styles.hoodCard,
                  { backgroundColor: theme.card, borderColor: isExpanded ? colors.brand.traceRed : theme.border },
                ]}
              >
                <Text style={styles.hoodEmoji}>{n.emoji}</Text>
                <Text style={[styles.hoodName, { color: theme.foreground }]}>{n.name}</Text>
                <Text style={[styles.hoodVibe, { color: theme.mutedForeground }]}>{n.vibe}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        {expandedNeighbourhood && (() => {
          const n = info.neighborhoods.find((x) => x.name === expandedNeighbourhood);
          if (!n) return null;
          return (
            <View style={[styles.hoodExpanded, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.hoodExpandedTitle, { color: theme.foreground }]}>
                {n.emoji} {n.name}
              </Text>
              <Text style={[styles.hoodExpandedDesc, { color: theme.mutedForeground }]}>
                {n.description}
              </Text>
            </View>
          );
        })()}
      </Section>

      {/* ── Attractions ─────────────────────────────────────────── */}
      <Section title="Don't Miss" theme={theme}>
        <View style={[styles.listCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {info.attractions.map((a, i) => (
            <View
              key={a.name}
              style={[
                styles.listRow,
                { borderBottomColor: theme.border },
                i === info.attractions.length - 1 && { borderBottomWidth: 0 },
              ]}
            >
              <Text style={styles.listEmoji}>{a.emoji}</Text>
              <Text style={[styles.listLabel, { color: theme.foreground }]}>{a.name}</Text>
            </View>
          ))}
        </View>
      </Section>

      {/* ── Dining ──────────────────────────────────────────────── */}
      <Section title="Where to Eat" theme={theme}>
        {(["budget", "moderate", "premium"] as const).map((tier) => {
          const places = info.dining[tier];
          if (!places || places.length === 0) return null;
          const { label, symbol } = PRICE_LEVELS[tier];
          return (
            <View key={tier} style={styles.diningBlock}>
              <View style={styles.diningTierHeader}>
                <Text style={[styles.diningSymbol, { color: scheme === "dark" ? "#a78bfa" : "#7c3aed" }]}>{symbol}</Text>
                <Text style={[styles.diningTierLabel, { color: theme.mutedForeground }]}>{label}</Text>
              </View>
              <View style={[styles.listCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                {places.map((p, i) => (
                  <View
                    key={p.name}
                    style={[
                      styles.diningRow,
                      { borderBottomColor: theme.border },
                      i === places.length - 1 && { borderBottomWidth: 0 },
                    ]}
                  >
                    <Text style={[styles.diningName, { color: theme.foreground }]}>{p.name}</Text>
                    <Text style={[styles.diningType, { color: theme.mutedForeground }]}>{p.type}</Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })}
      </Section>

      {/* ── Day Trips ───────────────────────────────────────────── */}
      <Section title="Day Trips" theme={theme}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalRow}
        >
          {info.dayTrips.map((d) => (
            <View
              key={d.name}
              style={[styles.dayTripCard, { backgroundColor: theme.card, borderColor: theme.border }]}
            >
              <Text style={styles.dayTripEmoji}>{d.emoji}</Text>
              <Text style={[styles.dayTripName, { color: theme.foreground }]}>{d.name}</Text>
              <Text style={[styles.dayTripTime, { color: theme.mutedForeground }]}>{d.time}</Text>
            </View>
          ))}
        </ScrollView>
      </Section>

      {/* ── Getting Around ──────────────────────────────────────── */}
      <Section title="Getting Around" theme={theme}>
        {info.gettingAround.map((g, i) => (
          <View
            key={i}
            style={[styles.aroundCard, { backgroundColor: theme.card, borderColor: theme.border }]}
          >
            <View style={styles.aroundHeader}>
              <Text style={styles.aroundIcon}>{g.icon}</Text>
              <Text style={[styles.aroundMode, { color: theme.foreground }]}>{g.mode}</Text>
              {!!g.cost && (
                <View style={[styles.aroundCostBadge, { backgroundColor: scheme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)" }]}>
                  <Text style={[styles.aroundCostText, { color: theme.mutedForeground }]}>{g.cost}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.aroundTip, { color: theme.mutedForeground }]}>{g.tip}</Text>
          </View>
        ))}
      </Section>

    </View>
  );
}

function Section({
  title,
  children,
  theme,
}: {
  title: string;
  children: React.ReactNode;
  theme: Theme;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.mutedForeground }]}>{title.toUpperCase()}</Text>
      {children}
    </View>
  );
}

function EssRow({
  label,
  value,
  theme,
  last,
}: {
  label: string;
  value: string;
  theme: Theme;
  last?: boolean;
}) {
  return (
    <View style={[styles.essRow, { borderBottomColor: theme.border }, last && { borderBottomWidth: 0 }]}>
      <Text style={[styles.essLabel, { color: theme.mutedForeground }]}>{label}</Text>
      <Text style={[styles.essValue, { color: theme.foreground }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingVertical: 8 },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 12,
  },
  loadingText: { fontSize: 14 },

  section: { paddingHorizontal: 20, marginBottom: 28 },
  sectionTitle: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.4,
    marginBottom: 10,
  },

  // Essentials
  essentialsGrid: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  essRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  essLabel: { fontSize: 13, fontWeight: "500", flexShrink: 0 },
  essValue: { fontSize: 13, fontWeight: "600", flex: 1, textAlign: "right" },
  insiderCard: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  insiderIcon: { fontSize: 14, lineHeight: 20 },
  insiderText: { fontSize: 13, lineHeight: 19, flex: 1 },

  // Neighbourhoods
  horizontalRow: { paddingRight: 20, gap: 10 },
  hoodCard: {
    width: 130,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 4,
  },
  hoodEmoji: { fontSize: 24, marginBottom: 4 },
  hoodName: { fontSize: 14, fontWeight: "700" },
  hoodVibe: { fontSize: 11, fontWeight: "500" },
  hoodExpanded: {
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  hoodExpandedTitle: { fontSize: 15, fontWeight: "700" },
  hoodExpandedDesc: { fontSize: 13, lineHeight: 20 },

  // Attractions / generic list
  listCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  listEmoji: { fontSize: 18, width: 28, textAlign: "center" },
  listLabel: { fontSize: 14, fontWeight: "600", flex: 1 },

  // Dining
  diningBlock: { marginBottom: 12 },
  diningTierHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  diningSymbol: { fontSize: 14, fontWeight: "800", width: 36 },
  diningTierLabel: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8 },
  diningRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
  diningName: { fontSize: 14, fontWeight: "600" },
  diningType: { fontSize: 12 },

  // Day trips
  dayTripCard: {
    width: 140,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 4,
  },
  dayTripEmoji: { fontSize: 24, marginBottom: 4 },
  dayTripName: { fontSize: 13, fontWeight: "700" },
  dayTripTime: { fontSize: 11, fontWeight: "500" },

  // Getting around
  aroundCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 10,
    gap: 8,
  },
  aroundHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  aroundIcon: { fontSize: 22 },
  aroundMode: { fontSize: 15, fontWeight: "700", flex: 1 },
  aroundCostBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  aroundCostText: { fontSize: 11, fontWeight: "600" },
  aroundTip: { fontSize: 13, lineHeight: 20 },
});
