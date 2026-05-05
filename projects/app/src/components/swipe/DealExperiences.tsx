import React from "react";
import { View, Text, ScrollView, StyleSheet, useColorScheme } from "react-native";
import Animated, { FadeInRight } from "react-native-reanimated";
import { colors } from "../../theme/colors";

interface Experience {
  title: string;
  description: string;
}

interface DealExperiencesProps {
  experiences: Experience[];
  month?: string;
}

const EMOJI_MAP: { keywords: string[]; emoji: string }[] = [
  { keywords: ["food", "eat", "cuisine", "restaurant", "dining", "taste", "cook", "culinary"], emoji: "🍜" },
  { keywords: ["hike", "trek", "trail", "mountain", "climb", "summit"], emoji: "🏔️" },
  { keywords: ["beach", "swim", "snorkel", "surf", "coast", "sea", "island"], emoji: "🏖️" },
  { keywords: ["museum", "art", "gallery", "history", "cultural", "heritage", "ancient"], emoji: "🏛️" },
  { keywords: ["market", "shop", "bazaar", "souk", "shopping", "craft"], emoji: "🛍️" },
  { keywords: ["temple", "church", "cathedral", "mosque", "shrine", "sacred", "spiritual"], emoji: "⛩️" },
  { keywords: ["festival", "carnival", "celebration", "parade", "event"], emoji: "🎉" },
  { keywords: ["wine", "drink", "brewery", "vineyard", "tasting", "cocktail"], emoji: "🍷" },
  { keywords: ["sunset", "sunrise", "viewpoint", "lookout", "panorama", "view"], emoji: "🌅" },
  { keywords: ["dive", "scuba", "underwater", "reef", "coral"], emoji: "🤿" },
  { keywords: ["safari", "wildlife", "animal", "nature", "jungle", "forest"], emoji: "🦁" },
  { keywords: ["boat", "kayak", "river", "cruise", "sailing", "ferry"], emoji: "🚣" },
  { keywords: ["night", "bar", "club", "nightlife", "entertainment"], emoji: "🌃" },
  { keywords: ["spa", "relax", "wellness", "yoga", "massage"], emoji: "🧘" },
  { keywords: ["tour", "walk", "city", "explore", "discover", "wander"], emoji: "🗺️" },
  { keywords: ["photo", "photography", "scenic", "landscape"], emoji: "📸" },
  { keywords: ["ski", "snow", "winter", "ice"], emoji: "⛷️" },
  { keywords: ["music", "concert", "jazz", "live"], emoji: "🎵" },
];

const ACCENT_COLORS = [
  colors.brand.traceRed,
  "#8b5cf6",
  colors.brand.traceGreen,
  colors.brand.amber500,
  colors.brand.tracePink,
  "#3b82f6",
];

function firstSentence(text: string): string {
  const match = text.match(/^[^.!?]+[.!?]/);
  return match ? match[0].trim() : text.slice(0, 100).trim();
}

function getEmoji(title: string): string {
  const lower = title.toLowerCase();
  for (const entry of EMOJI_MAP) {
    if (entry.keywords.some((k) => lower.includes(k))) return entry.emoji;
  }
  return "✈️";
}

export default function DealExperiences({ experiences, month }: DealExperiencesProps) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;

  if (!experiences || experiences.length === 0) return null;

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
        snapToInterval={228}
        snapToAlignment="start"
      >
        {experiences.map((exp, i) => {
          const accent = ACCENT_COLORS[i % ACCENT_COLORS.length];
          const emoji = getEmoji(exp.title);
          return (
            <Animated.View
              key={i}
              entering={FadeInRight.delay(i * 70).duration(350)}
              style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
            >
              <View style={[styles.emojiWrap, { backgroundColor: `${accent}1A` }]}>
                <Text style={styles.emoji}>{emoji}</Text>
                <View style={[styles.numberBadge, { backgroundColor: accent }]}>
                  <Text style={styles.numberText}>{i + 1}</Text>
                </View>
              </View>

              <Text style={[styles.title, { color: theme.foreground }]} numberOfLines={2}>
                {exp.title}
              </Text>
              <Text style={[styles.description, { color: theme.mutedForeground }]}>
                {firstSentence(exp.description)}
              </Text>

              <View style={[styles.bottomStripe, { backgroundColor: accent }]} />
            </Animated.View>
          );
        })}
        <View style={{ width: 20 }} />
      </ScrollView>
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
    width: 216,
    borderRadius: 16,
    padding: 16,
    paddingBottom: 22,
    borderWidth: 1,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  emojiWrap: {
    width: 54,
    height: 54,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  emoji: {
    fontSize: 26,
  },
  numberBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  numberText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#ffffff",
  },
  title: {
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 19,
  },
  description: {
    fontSize: 12,
    lineHeight: 17,
  },
  bottomStripe: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
  },
});
