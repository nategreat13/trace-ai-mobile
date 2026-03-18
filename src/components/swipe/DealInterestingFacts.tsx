import React from "react";
import { View, Text, StyleSheet, useColorScheme } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { colors } from "../../theme/colors";

interface Fact {
  title: string;
  description: string;
}

interface DealInterestingFactsProps {
  facts: Fact[];
}

export default function DealInterestingFacts({ facts }: DealInterestingFactsProps) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;

  if (!facts || facts.length === 0) return null;

  return (
    <View>
      <Text style={[styles.heading, { color: theme.foreground }]}>
        Interesting Facts
      </Text>
      <View style={styles.list}>
        {facts.map((fact, i) => (
          <Animated.View
            key={i}
            entering={FadeInDown.delay(i * 100).duration(400)}
            style={[
              styles.card,
              {
                backgroundColor: scheme === "dark"
                  ? "rgba(139,92,246,0.1)"
                  : "rgba(139,92,246,0.08)",
                borderColor: scheme === "dark"
                  ? "rgba(139,92,246,0.25)"
                  : "rgba(139,92,246,0.2)",
              },
            ]}
          >
            <Text style={[styles.title, { color: theme.foreground }]}>
              {fact.title}
            </Text>
            <Text style={[styles.description, { color: theme.mutedForeground }]}>
              {fact.description}
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
