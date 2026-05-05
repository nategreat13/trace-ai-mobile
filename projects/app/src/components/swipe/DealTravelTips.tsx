import React from "react";
import { View, Text, StyleSheet, useColorScheme } from "react-native";
import Animated, { FadeInLeft } from "react-native-reanimated";
import { colors } from "../../theme/colors";

interface TravelTip {
  title: string;
  description: string;
}

interface DealTravelTipsProps {
  tips: TravelTip[];
}

const ACCENT = "#3b82f6";

export default function DealTravelTips({ tips }: DealTravelTipsProps) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;

  if (!tips || tips.length === 0) return null;

  return (
    <View>
      <View style={styles.headerRow}>
        <View style={[styles.headerBar, { backgroundColor: ACCENT }]} />
        <Text style={[styles.heading, { color: theme.foreground }]}>
          Travel Tips
        </Text>
      </View>

      <View>
        {tips.map((tip, i) => (
          <Animated.View
            key={i}
            entering={FadeInLeft.delay(i * 80).duration(350)}
            style={styles.tipItem}
          >
            {/* Timeline column */}
            <View style={styles.dotColumn}>
              <View style={[styles.dot, { backgroundColor: ACCENT }]} />
              {i < tips.length - 1 && (
                <View style={[styles.line, { backgroundColor: theme.border }]} />
              )}
            </View>

            {/* Content */}
            <View style={styles.tipContent}>
              {!!tip.title && (
                <Text style={[styles.tipTitle, { color: theme.foreground }]}>
                  {tip.title}
                </Text>
              )}
              <Text style={[styles.tipDesc, { color: theme.mutedForeground }]}>
                {tip.description}
              </Text>
            </View>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  headerBar: {
    width: 4,
    height: 18,
    borderRadius: 2,
  },
  heading: {
    fontSize: 18,
    fontWeight: "800",
  },
  tipItem: {
    flexDirection: "row",
    gap: 14,
    minHeight: 20,
  },
  dotColumn: {
    alignItems: "center",
    width: 16,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 5,
  },
  line: {
    width: 2,
    flex: 1,
    marginTop: 6,
    marginBottom: 0,
    borderRadius: 1,
    minHeight: 24,
  },
  tipContent: {
    flex: 1,
    paddingBottom: 22,
    gap: 4,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 19,
  },
  tipDesc: {
    fontSize: 13,
    lineHeight: 19,
  },
});
