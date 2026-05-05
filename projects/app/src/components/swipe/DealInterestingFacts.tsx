import React from "react";
import { View, Text, StyleSheet, useColorScheme } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
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
  const accentColor = scheme === "dark" ? "#a78bfa" : "#7c3aed";

  if (!facts || facts.length === 0) return null;

  return (
    <View>
      <View style={styles.headerRow}>
        <View style={[styles.headerBar, { backgroundColor: accentColor }]} />
        <Text style={[styles.heading, { color: theme.foreground }]}>
          Did You Know?
        </Text>
      </View>

      <View>
        {facts.map((fact, i) => (
          <Animated.View
            key={i}
            entering={FadeInUp.delay(i * 90).duration(400)}
            style={[
              styles.factRow,
              i < facts.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
            ]}
          >
            <Text style={[styles.number, { color: accentColor }]}>
              {String(i + 1).padStart(2, "0")}
            </Text>
            <View style={styles.factContent}>
              {!!fact.title && (
                <Text style={[styles.factTitle, { color: theme.foreground }]}>
                  {fact.title}
                </Text>
              )}
              <Text style={[styles.factDesc, { color: theme.mutedForeground }]}>
                {fact.description}
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
  factRow: {
    flexDirection: "row",
    gap: 16,
    paddingVertical: 18,
  },
  number: {
    fontSize: 30,
    fontWeight: "900",
    lineHeight: 34,
    width: 42,
    letterSpacing: -1.5,
    opacity: 0.85,
  },
  factContent: {
    flex: 1,
    paddingTop: 4,
    gap: 5,
  },
  factTitle: {
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 19,
  },
  factDesc: {
    fontSize: 13,
    lineHeight: 19,
  },
});
