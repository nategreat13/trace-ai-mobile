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
  budget:   { accommodation: [20, 55],   food: [12, 30],  transport: [4, 12],  activities: [10, 25]  },
  moderate: { accommodation: [80, 160],  food: [35, 75],  transport: [15, 30], activities: [25, 60]  },
  premium:  { accommodation: [180, 380], food: [75, 150], transport: [25, 55], activities: [50, 120] },
};

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

function getRanges(tier: Tier, deal: Deal): TierRanges {
  const base = { ...TIER_COSTS[tier] };
  if (deal.deal_type === "adventure") base.activities = [base.activities[0] + 20, base.activities[1] + 50];
  if (deal.deal_type === "relaxation" || deal.deal_type === "romantic") base.accommodation = [base.accommodation[0] + 30, base.accommodation[1] + 80];
  return base;
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

export default function DealBudgetPreview({ deal }: { deal: Deal }) {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const theme = isDark ? colors.dark : colors.light;
  const [openTier, setOpenTier] = useState<Tier | null>(null);

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
              onPress={() => setOpenTier(isActive ? null : tier)}
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
                return (
                  <View
                    key={row.key}
                    style={[
                      styles.row,
                      i < ROWS.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
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
