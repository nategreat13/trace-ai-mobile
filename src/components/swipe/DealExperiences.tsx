import React from "react";
import { View, Text, StyleSheet, useColorScheme } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { colors } from "../../theme/colors";

interface Experience {
  title: string;
  description: string;
}

interface DealExperiencesProps {
  experiences: Experience[];
}

export default function DealExperiences({ experiences }: DealExperiencesProps) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;

  if (!experiences || experiences.length === 0) return null;

  return (
    <View>
      <Text style={[styles.heading, { color: theme.foreground }]}>
        Top Experiences
      </Text>
      <View style={styles.list}>
        {experiences.map((exp, i) => (
          <Animated.View
            key={i}
            entering={FadeInDown.delay(i * 100).duration(400)}
            style={[
              styles.card,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
              },
            ]}
          >
            <Text style={[styles.title, { color: theme.foreground }]}>
              {exp.title}
            </Text>
            <Text style={[styles.description, { color: theme.mutedForeground }]}>
              {exp.description}
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
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
  },
  description: {
    fontSize: 13,
    lineHeight: 19,
  },
});
