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
            ? "rgba(245,158,11,0.10)"
            : "rgba(245,158,11,0.07)",
          borderColor: scheme === "dark"
            ? "rgba(245,158,11,0.28)"
            : "rgba(245,158,11,0.22)",
        },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={[styles.iconWrap, { backgroundColor: colors.brand.amber500 }]}>
          <Zap size={14} color="#ffffff" fill="#ffffff" />
        </View>
        <Text style={[styles.heading, { color: theme.foreground }]}>
          Quick Tips
        </Text>
      </View>

      <View style={styles.list}>
        {tips.map((tip, i) => (
          <View key={i} style={styles.tipRow}>
            <View style={[styles.checkWrap, { backgroundColor: "rgba(245,158,11,0.20)" }]}>
              <Text style={[styles.checkMark, { color: colors.brand.amber500 }]}>✓</Text>
            </View>
            <Text style={[styles.tipText, { color: theme.mutedForeground }]}>{tip}</Text>
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 18,
    borderWidth: 1.5,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  heading: {
    fontSize: 16,
    fontWeight: "800",
  },
  list: {
    gap: 10,
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  checkWrap: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 1,
    flexShrink: 0,
  },
  checkMark: {
    fontSize: 11,
    fontWeight: "900",
  },
  tipText: {
    fontSize: 13,
    lineHeight: 19,
    flex: 1,
  },
});
