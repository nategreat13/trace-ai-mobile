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

export default function DealTravelTips({ tips }: DealTravelTipsProps) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;

  if (!tips || tips.length === 0) return null;

  return (
    <View>
      <Text style={[styles.heading, { color: theme.foreground }]}>
        Travel Tips
      </Text>
      <View style={styles.list}>
        {tips.map((tip, i) => (
          <Animated.View
            key={i}
            entering={FadeInLeft.delay(i * 100).duration(400)}
            style={[
              styles.card,
              {
                backgroundColor: scheme === "dark"
                  ? "rgba(59,130,246,0.1)"
                  : "rgba(59,130,246,0.08)",
                borderColor: scheme === "dark"
                  ? "rgba(59,130,246,0.25)"
                  : "rgba(59,130,246,0.2)",
              },
            ]}
          >
            <Text style={[styles.title, { color: theme.foreground }]}>
              {tip.title}
            </Text>
            <Text style={[styles.description, { color: theme.mutedForeground }]}>
              {tip.description}
            </Text>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 12,
  },
  list: {
    gap: 10,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 6,
  },
  description: {
    fontSize: 13,
    lineHeight: 19,
  },
});
