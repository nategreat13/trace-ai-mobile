import React, { useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
  Image,
  useColorScheme,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  withSpring,
  withRepeat,
  Easing,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../theme/colors";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// ─── Confetti ─────────────────────────────────────────────────────────────────

const CONFETTI_COLORS = [
  "#FF655B", "#FD297B", "#00D665", "#FFD700", "#01ADFF",
  "#FF9500", "#AF52DE", "#FF3B30",
];

type ConfettiPieceData = {
  id: number;
  x: number;
  color: string;
  size: number;
  delay: number;
  duration: number;
  isSquare: boolean;
  driftDir: number;
};

// Generated once at module load so they're stable across re-renders.
const PIECES: ConfettiPieceData[] = Array.from({ length: 45 }, (_, i) => ({
  id: i,
  x: (SCREEN_WIDTH / 45) * i + Math.random() * (SCREEN_WIDTH / 45),
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  size: 6 + (i % 5) * 2,
  delay: (i % 12) * 120,
  duration: 2800 + (i % 7) * 300,
  isSquare: i % 3 !== 0,
  driftDir: i % 2 === 0 ? 1 : -1,
}));

function ConfettiPiece({ piece }: { piece: ConfettiPieceData }) {
  const y = useSharedValue(-20);
  const x = useSharedValue(0);
  const rot = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(
      piece.delay,
      withSequence(
        withTiming(0.9, { duration: 150 }),
        withDelay(piece.duration - 500, withTiming(0, { duration: 400 }))
      )
    );
    y.value = withDelay(
      piece.delay,
      withTiming(SCREEN_HEIGHT + 60, {
        duration: piece.duration,
        easing: Easing.in(Easing.quad),
      })
    );
    x.value = withDelay(
      piece.delay,
      withRepeat(
        withSequence(
          withTiming(14 * piece.driftDir, { duration: 450 }),
          withTiming(-14 * piece.driftDir, { duration: 450 })
        ),
        -1,
        true
      )
    );
    rot.value = withDelay(
      piece.delay,
      withRepeat(
        withTiming(360, {
          duration: 700 + (piece.id % 5) * 100,
          easing: Easing.linear,
        }),
        -1
      )
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: y.value },
      { translateX: x.value },
      { rotate: `${rot.value}deg` },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        style,
        {
          position: "absolute",
          left: piece.x,
          top: 0,
          width: piece.size,
          height: piece.size,
          borderRadius: piece.isSquare ? 2 : piece.size / 2,
          backgroundColor: piece.color,
        },
      ]}
    />
  );
}

// ─── Feature row ──────────────────────────────────────────────────────────────

type Feature = { emoji: string; label: string; hint: string };

function FeatureRow({
  feature,
  delay,
  accentColor,
}: {
  feature: Feature;
  delay: number;
  accentColor: string;
}) {
  const isDark = useColorScheme() === "dark";
  const theme = isDark ? colors.dark : colors.light;
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(16);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 350 }));
    translateY.value = withDelay(delay, withSpring(0, { damping: 18, stiffness: 200 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View
      style={[
        style,
        {
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.85)",
          borderRadius: 14,
          padding: 12,
          gap: 12,
          borderWidth: 1,
          borderColor: accentColor + "28",
        },
      ]}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: accentColor + "1A",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: 20 }}>{feature.emoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: "700", color: theme.foreground, marginBottom: 2 }}>
          {feature.label}
        </Text>
        <Text style={{ fontSize: 12, color: theme.mutedForeground, lineHeight: 16 }}>
          {feature.hint}
        </Text>
      </View>
    </Animated.View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface UpgradeCelebrationProps {
  tier: "premium" | "business";
  onContinue: () => void;
}

export default function UpgradeCelebration({ tier, onContinue }: UpgradeCelebrationProps) {
  const isDark = useColorScheme() === "dark";
  const theme = isDark ? colors.dark : colors.light;
  const isPremium = tier === "premium";

  const accentColor = isPremium ? colors.brand.traceRed : colors.brand.amber500;
  const accentColor2 = isPremium ? colors.brand.tracePink : "#FBBF24";

  const gradientColors: [string, string] = isPremium
    ? isDark ? ["#1c0809", "#2a0d10"] : ["#fff6f6", "#fff0f4"]
    : isDark ? ["#1c1500", "#2a2000"] : ["#fffdf5", "#fff8e1"];

  // Premium uses the Trace blue icon; Business uses the "2" tier icon.
  const heroLogo = isPremium
    ? require("../../assets/Bluelogo.png")
    : require("../../assets/2.png");

  const title = isPremium ? "Welcome to\nPremium" : "Welcome to\nBusiness Class";
  const subtitle = isPremium
    ? "You're officially a deal hunter. The world just got a whole lot more affordable."
    : "You've unlocked the best seats in the house — business class deals at prices that shouldn't exist.";

  const features: Feature[] = isPremium
    ? [
        { emoji: "♾️", label: "Unlimited swipes", hint: "No daily cap — swipe as much as you want" },
        { emoji: "💾", label: "Save any deal", hint: "Tap the Trace button while swiping to save" },
        { emoji: "🔍", label: "Explore tab", hint: "Browse deals by destination — bottom nav" },
        { emoji: "🔔", label: "Deal alerts", hint: "Open any deal → tap Set Alert" },
      ]
    : [
        { emoji: "✈️", label: "Business class deals", hint: "They'll appear right in your swipe deck" },
        { emoji: "⏰", label: "48-hour early access", hint: "You see new deals before anyone else" },
        { emoji: "🔍", label: "Explore tab", hint: "Browse deals by destination — bottom nav" },
        { emoji: "🔔", label: "Deal alerts", hint: "Open any deal → tap Set Alert" },
      ];

  const heroScale = useSharedValue(0);
  const heroOpacity = useSharedValue(0);
  const glowScale = useSharedValue(1);
  const titleOpacity = useSharedValue(0);
  const titleY = useSharedValue(24);
  const lineWidth = useSharedValue(0);
  const subtitleOpacity = useSharedValue(0);
  const subtitleY = useSharedValue(16);
  const buttonScale = useSharedValue(0.8);
  const buttonOpacity = useSharedValue(0);

  useEffect(() => {
    heroScale.value = withDelay(150, withSpring(1, { damping: 11, stiffness: 160 }));
    heroOpacity.value = withDelay(150, withTiming(1, { duration: 250 }));

    glowScale.value = withDelay(
      600,
      withRepeat(
        withSequence(
          withTiming(1.2, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );

    titleOpacity.value = withDelay(400, withTiming(1, { duration: 400 }));
    titleY.value = withDelay(400, withSpring(0, { damping: 16, stiffness: 180 }));

    lineWidth.value = withDelay(650, withTiming(48, { duration: 400, easing: Easing.out(Easing.quad) }));

    subtitleOpacity.value = withDelay(650, withTiming(1, { duration: 400 }));
    subtitleY.value = withDelay(650, withSpring(0, { damping: 16, stiffness: 180 }));

    buttonScale.value = withDelay(1300, withSpring(1, { damping: 14, stiffness: 220 }));
    buttonOpacity.value = withDelay(1300, withTiming(1, { duration: 300 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const heroStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heroScale.value }],
    opacity: heroOpacity.value,
  }));
  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: glowScale.value }],
  }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleY.value }],
  }));
  const lineStyle = useAnimatedStyle(() => ({
    width: lineWidth.value,
  }));
  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
    transform: [{ translateY: subtitleY.value }],
  }));
  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
    opacity: buttonOpacity.value,
  }));

  return (
    <View style={{ flex: 1 }}>
      {/* Confetti — rendered behind everything */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {PIECES.map((p) => (
          <ConfettiPiece key={p.id} piece={p} />
        ))}
      </View>

      <LinearGradient colors={gradientColors} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
          >
            {/* Hero icon */}
            <View style={styles.heroContainer}>
              <Animated.View
                style={[
                  glowStyle,
                  {
                    position: "absolute",
                    width: 120,
                    height: 120,
                    borderRadius: 60,
                    backgroundColor: accentColor,
                    opacity: 0.12,
                  },
                ]}
              />
              <Animated.View
                style={[
                  heroStyle,
                  {
                    width: 100,
                    height: 100,
                    borderRadius: 50,
                    backgroundColor: accentColor + "1E",
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 2,
                    borderColor: accentColor + "40",
                  },
                ]}
              >
                <Image
                  source={heroLogo}
                  style={{ width: 56, height: 56, resizeMode: "contain" }}
                />
              </Animated.View>
            </View>

            {/* Title */}
            <Animated.Text
              style={[
                titleStyle,
                {
                  fontSize: 34,
                  fontWeight: "900",
                  color: theme.foreground,
                  textAlign: "center",
                  lineHeight: 40,
                  marginBottom: 10,
                },
              ]}
            >
              {title}
            </Animated.Text>

            {/* Accent line */}
            <Animated.View
              style={[
                lineStyle,
                {
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: accentColor,
                  marginBottom: 12,
                },
              ]}
            />

            {/* Subtitle */}
            <Animated.Text
              style={[
                subtitleStyle,
                {
                  fontSize: 14,
                  color: theme.mutedForeground,
                  textAlign: "center",
                  lineHeight: 21,
                  marginBottom: 24,
                  paddingHorizontal: 8,
                },
              ]}
            >
              {subtitle}
            </Animated.Text>

            {/* Features */}
            <View style={{ width: "100%", gap: 8, marginBottom: 24 }}>
              {features.map((f, i) => (
                <FeatureRow
                  key={i}
                  feature={f}
                  accentColor={accentColor}
                  delay={900 + i * 110}
                />
              ))}
            </View>

            {/* CTA */}
            <Animated.View style={[buttonStyle, { width: "100%" }]}>
              <TouchableOpacity
                onPress={onContinue}
                activeOpacity={0.85}
                style={{ borderRadius: 16, overflow: "hidden" }}
              >
                <LinearGradient
                  colors={[accentColor, accentColor2]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{
                    paddingVertical: 18,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: "#fff", fontSize: 17, fontWeight: "800" }}>
                    {isPremium ? "Start Swiping ✈️" : "Enter Business Class 👑"}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
    paddingTop: 48,
    paddingBottom: 32,
  },
  heroContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
    height: 120,
    width: 120,
  },
});
