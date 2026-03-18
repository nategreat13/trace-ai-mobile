import React from "react";
import { View, Text, StyleSheet, useColorScheme } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Zap } from "lucide-react-native";
import { colors } from "../../theme/colors";

interface DealQuickTipsProps {
  tips: string[];
}

export default function DealQuickTips({ tips }: DealQuickTipsProps) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;

  if (!tips || tips.length === 0) return null;

  return (
    <Animated.View
      entering={FadeInDown.duration(400)}
      style={[
        styles.container,
        {
          backgroundColor: scheme === "dark"
            ? "rgba(245,158,11,0.1)"
            : "rgba(245,158,11,0.08)",
          borderColor: scheme === "dark"
            ? "rgba(245,158,11,0.3)"
            : "rgba(245,158,11,0.25)",
        },
      ]}
    >
      <View style={styles.headerRow}>
        <Zap size={20} color={colors.brand.amber500} />
        <Text style={[styles.heading, { color: theme.foreground }]}>
          Quick Tips
        </Text>
      </View>
      <View style={styles.list}>
        {tips.map((tip, i) => (
          <View key={i} style={styles.tipRow}>
            <Text style={styles.bullet}>{"\u2022"}</Text>
            <Text style={[styles.tipText, { color: theme.mutedForeground }]}>
              {tip}
            </Text>
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  heading: {
    fontSize: 17,
    fontWeight: "800",
  },
  list: {
    gap: 8,
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  bullet: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.brand.amber500,
    marginTop: 1,
  },
  tipText: {
    fontSize: 13,
    lineHeight: 19,
    flex: 1,
  },
});
