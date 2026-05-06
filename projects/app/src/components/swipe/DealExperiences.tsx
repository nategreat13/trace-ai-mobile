import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  useColorScheme,
  TouchableOpacity,
} from "react-native";
import Animated, { FadeInRight, FadeIn } from "react-native-reanimated";
import { colors } from "../../theme/colors";

interface Experience {
  title: string;
  description: string;
}

interface DealExperiencesProps {
  experiences: Experience[];
  month?: string;
}

const ACCENT_COLORS = [
  colors.brand.traceRed,
  "#8b5cf6",
  colors.brand.traceGreen,
  colors.brand.amber500,
  colors.brand.tracePink,
  "#3b82f6",
];

function splitIntoBullets(text: string): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  return sentences.map((s) => s.trim()).filter(Boolean);
}

export default function DealExperiences({ experiences, month }: DealExperiencesProps) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  if (!experiences || experiences.length === 0) return null;

  const selected = selectedIndex !== null ? experiences[selectedIndex] : null;
  const selectedAccent = selectedIndex !== null ? ACCENT_COLORS[selectedIndex % ACCENT_COLORS.length] : null;
  const bullets = selected ? splitIntoBullets(selected.description) : [];

  return (
    <View>
      <View style={styles.headerRow}>
        <View style={[styles.headerBar, { backgroundColor: colors.brand.traceRed }]} />
        <Text style={[styles.heading, { color: theme.foreground }]}>
          Top Experiences{month ? ` in ${month}` : ""}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        decelerationRate="fast"
        snapToInterval={192}
        snapToAlignment="start"
      >
        {experiences.map((exp, i) => {
          const accent = ACCENT_COLORS[i % ACCENT_COLORS.length];
          const isActive = selectedIndex === i;
          return (
            <Animated.View
              key={i}
              entering={FadeInRight.delay(i * 70).duration(350)}
            >
              <TouchableOpacity
                onPress={() => setSelectedIndex(isActive ? null : i)}
                activeOpacity={0.75}
                style={[
                  styles.card,
                  { backgroundColor: isActive ? `${accent}18` : theme.card, borderColor: isActive ? accent : theme.border },
                ]}
              >
                <Text style={[styles.title, { color: theme.foreground }]} numberOfLines={3}>
                  {exp.title}
                </Text>
                <View style={[styles.bottomStripe, { backgroundColor: accent }]} />
              </TouchableOpacity>
            </Animated.View>
          );
        })}
        <View style={{ width: 20 }} />
      </ScrollView>

      {selected && selectedAccent && (
        <Animated.View
          key={selectedIndex}
          entering={FadeIn.duration(200)}
          style={[styles.detail, { borderColor: selectedAccent, backgroundColor: `${selectedAccent}0D` }]}
        >
          <View style={[styles.detailBar, { backgroundColor: selectedAccent }]} />
          <Text style={[styles.detailTitle, { color: theme.foreground }]}>{selected.title}</Text>
          <View style={styles.bulletList}>
            {bullets.map((bullet, bi) => (
              <Animated.View
                key={bi}
                entering={FadeIn.delay(bi * 50).duration(200)}
                style={styles.bulletRow}
              >
                <View style={[styles.bulletDot, { backgroundColor: selectedAccent }]} />
                <Text style={[styles.bulletText, { color: theme.foreground }]}>{bullet}</Text>
              </Animated.View>
            ))}
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    marginBottom: 14,
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
  scrollContent: {
    paddingLeft: 20,
    gap: 12,
  },
  card: {
    width: 180,
    borderRadius: 16,
    padding: 16,
    paddingBottom: 22,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 72,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 19,
  },
  bottomStripe: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  detail: {
    marginHorizontal: 20,
    marginTop: 14,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
    overflow: "hidden",
  },
  detailBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  detailTitle: {
    fontSize: 15,
    fontWeight: "800",
    marginTop: 4,
  },
  bulletList: {
    gap: 10,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 7,
    flexShrink: 0,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
  },
});
