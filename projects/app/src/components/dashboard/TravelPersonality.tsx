import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
} from "react-native";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withDelay,
} from "react-native-reanimated";
import { colors } from "../../theme/colors";

interface TravelPersonalityProps {
  personality: string | null;
  level: number;
  swipeCount: number;
}

interface ParsedPersonality {
  type?: string;
  title?: string;
  description?: string;
  emoji?: string;
}

export default function TravelPersonality({
  personality,
  level,
  swipeCount,
}: TravelPersonalityProps) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;

  const parsed: ParsedPersonality | null = useMemo(() => {
    if (!personality) return null;
    try {
      return JSON.parse(personality);
    } catch {
      return null;
    }
  }, [personality]);

  const progressInLevel = (swipeCount % 25) / 25;
  const swipesInLevel = swipeCount % 25;

  // Animated progress bar width
  const progressWidth = useSharedValue(0);
  React.useEffect(() => {
    progressWidth.value = withDelay(
      400,
      withTiming(progressInLevel, { duration: 800 })
    );
  }, [progressInLevel]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value * 100}%`,
  }));

  return (
    <Animated.View
      entering={FadeInDown.duration(400)}
      style={[
        styles.container,
        {
          borderColor: `${colors.brand.traceRed}30`,
        },
      ]}
    >
      {/* Gradient-like background using layered Views */}
      <View
        style={[
          styles.bgGlow,
          { backgroundColor: `${colors.brand.traceRed}10` },
        ]}
      />

      <View style={styles.content}>
        {/* Personality row */}
        <View style={styles.personalityRow}>
          <View
            style={[
              styles.emojiCircle,
              {
                backgroundColor: colors.brand.traceRed,
              },
            ]}
          >
            <Text style={styles.emojiText}>
              {parsed?.emoji || "✨"}
            </Text>
          </View>
          <View style={styles.personalityInfo}>
            <Text
              style={[styles.personalityTitle, { color: theme.foreground }]}
              numberOfLines={1}
            >
              {parsed?.title || parsed?.type || "Your Travel Style"}
            </Text>
            <Text
              style={[styles.personalityDesc, { color: theme.mutedForeground }]}
              numberOfLines={2}
            >
              {parsed?.description || "Discover your vibe by swiping"}
            </Text>
          </View>
        </View>

        {/* Level progress */}
        <View style={styles.levelSection}>
          <View style={styles.levelHeader}>
            <Text style={[styles.levelLabel, { color: theme.mutedForeground }]}>
              Level {level}
            </Text>
            <Text style={[styles.levelProgress, { color: theme.foreground }]}>
              {swipesInLevel}/25
            </Text>
          </View>
          <View
            style={[
              styles.progressTrack,
              {
                backgroundColor: scheme === "dark"
                  ? "rgba(255,255,255,0.1)"
                  : "rgba(255,255,255,0.6)",
              },
            ]}
          >
            <Animated.View
              style={[
                styles.progressFill,
                {
                  backgroundColor: colors.brand.traceRed,
                },
                progressStyle,
              ]}
            />
          </View>
          <Text style={[styles.levelName, { color: theme.mutedForeground }]}>
            Deal Hunter Level {level}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
  },
  bgGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    padding: 16,
  },
  personalityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  emojiCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  emojiText: {
    fontSize: 24,
  },
  personalityInfo: {
    flex: 1,
  },
  personalityTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 2,
  },
  personalityDesc: {
    fontSize: 11,
    lineHeight: 15,
  },
  levelSection: {
    gap: 6,
  },
  levelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  levelLabel: {
    fontSize: 10,
    fontWeight: "600",
  },
  levelProgress: {
    fontSize: 10,
    fontWeight: "700",
  },
  progressTrack: {
    height: 8,
    borderRadius: 99,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 99,
  },
  levelName: {
    fontSize: 10,
    fontWeight: "500",
    marginTop: 2,
  },
});
