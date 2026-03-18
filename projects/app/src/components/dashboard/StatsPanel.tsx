import React from "react";
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import {
  TrendingUp,
  DollarSign,
  Flame,
  BarChart,
} from "lucide-react-native";
import { colors } from "../../theme/colors";
import type { UserProfile, SwipeRecord } from "@trace/shared";

interface StatsPanelProps {
  profile: UserProfile;
  swipeActions: SwipeRecord[];
}

interface StatItem {
  label: string;
  value: string | number;
  icon: React.ComponentType<any>;
  iconColor: string;
  bgColor: string;
}

export default function StatsPanel({ profile, swipeActions }: StatsPanelProps) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;

  // Calculate swipes this week
  const now = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const swipesThisWeek = (swipeActions || []).filter((s) => {
    const t = new Date(s.createdAt).getTime();
    return !isNaN(t) && now - t <= sevenDaysMs;
  }).length;

  // Best deal: find lowest price among right/super swipes
  const savedSwipes = (swipeActions || []).filter(
    (s) => s.action === "right" || s.action === "super"
  );
  const bestDealPrice =
    savedSwipes.length > 0
      ? Math.min(...savedSwipes.map((s) => s.price).filter((p) => p > 0))
      : 0;

  // Savings potential: estimate based on profile swipe count
  const savingsPotential = savedSwipes.reduce((sum, s) => {
    // Estimate 20% savings on average for each saved deal
    return sum + Math.round(s.price * 0.2);
  }, 0);

  const stats: StatItem[] = [
    {
      label: "Weekly Swipes",
      value: swipesThisWeek,
      icon: BarChart,
      iconColor: "#a855f7",
      bgColor: "rgba(168,85,247,0.12)",
    },
    {
      label: "Best Deal",
      value: bestDealPrice > 0 ? `$${bestDealPrice}` : "--",
      icon: DollarSign,
      iconColor: "#22c55e",
      bgColor: "rgba(34,197,94,0.12)",
    },
    {
      label: "Savings Potential",
      value: `$${savingsPotential.toLocaleString()}`,
      icon: TrendingUp,
      iconColor: "#06b6d4",
      bgColor: "rgba(6,182,212,0.12)",
    },
    {
      label: "Day Streak",
      value: profile?.streakDays || 0,
      icon: Flame,
      iconColor: "#f97316",
      bgColor: "rgba(249,115,22,0.12)",
    },
  ];

  return (
    <Animated.View
      entering={FadeInDown.duration(400)}
      style={[styles.container, { backgroundColor: theme.card, borderColor: theme.border }]}
    >
      <Text style={[styles.sectionTitle, { color: theme.mutedForeground }]}>
        QUICK STATS
      </Text>
      <View style={styles.grid}>
        {stats.map((stat, i) => {
          const IconComponent = stat.icon;
          return (
            <Animated.View
              key={stat.label}
              entering={FadeInDown.delay(i * 80).duration(300)}
              style={[
                styles.statCard,
                { backgroundColor: theme.muted, borderColor: theme.border },
              ]}
            >
              <View
                style={[styles.iconContainer, { backgroundColor: stat.bgColor }]}
              >
                <IconComponent size={18} color={stat.iconColor} />
              </View>
              <Text style={[styles.statValue, { color: theme.foreground }]}>
                {stat.value}
              </Text>
              <Text
                style={[styles.statLabel, { color: theme.mutedForeground }]}
                numberOfLines={1}
              >
                {stat.label}
              </Text>
            </Animated.View>
          );
        })}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 12,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statCard: {
    width: "48%",
    flexGrow: 1,
    flexBasis: "46%",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    alignItems: "flex-start",
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "800",
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 2,
  },
});
