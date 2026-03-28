import React, { useEffect } from "react";
import { View, Text, TouchableOpacity, useColorScheme, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  withSequence,
  withRepeat,
  Easing,
  FadeIn,
} from "react-native-reanimated";
import { colors } from "../theme/colors";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const PARTICLES = [
  { emoji: "⭐", x: 0.15, delay: 0 },
  { emoji: "✨", x: 0.75, delay: 120 },
  { emoji: "🎉", x: 0.35, delay: 60 },
  { emoji: "⭐", x: 0.88, delay: 200 },
  { emoji: "✨", x: 0.55, delay: 80 },
  { emoji: "🎉", x: 0.08, delay: 160 },
  { emoji: "⭐", x: 0.65, delay: 40 },
  { emoji: "✨", x: 0.92, delay: 100 },
];

function Particle({ emoji, x, delay }: { emoji: string; x: number; delay: number }) {
  const translateY = useSharedValue(SCREEN_HEIGHT * 0.6);
  const opacity = useSharedValue(0);

  useEffect(() => {
    translateY.value = withDelay(
      delay,
      withRepeat(
        withTiming(-SCREEN_HEIGHT * 0.15, { duration: 2200 + delay * 2, easing: Easing.out(Easing.quad) }),
        -1,
        false
      )
    );
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 400 }),
          withTiming(1, { duration: 1400 }),
          withTiming(0, { duration: 400 })
        ),
        -1,
        false
      )
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
    position: "absolute",
    left: SCREEN_WIDTH * x,
    top: SCREEN_HEIGHT * 0.2,
  }));

  return <Animated.Text style={[{ fontSize: 22 }, style]}>{emoji}</Animated.Text>;
}

export default function UpgradeWelcomeScreen() {
  const navigation = useNavigation<Nav>();
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;

  const rocketScale = useSharedValue(0);
  const rocketRotate = useSharedValue(-20);

  useEffect(() => {
    rocketScale.value = withSpring(1, { damping: 10, stiffness: 200 });
    rocketRotate.value = withSpring(0, { damping: 12, stiffness: 180 });

    // Gentle float after entrance
    setTimeout(() => {
      rocketScale.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 700, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
    }, 600);
  }, []);

  const rocketStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: rocketScale.value },
      { rotate: `${rocketRotate.value}deg` },
    ],
  }));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background, justifyContent: "center", paddingHorizontal: 24, overflow: "hidden" }}>
      {/* Floating particles */}
      {PARTICLES.map((p, i) => (
        <Particle key={i} emoji={p.emoji} x={p.x} delay={p.delay} />
      ))}

      <View style={{ alignItems: "center" }}>
        <Animated.Text style={[{ fontSize: 88, marginBottom: 24 }, rocketStyle]}>
          🚀
        </Animated.Text>

        <Animated.Text
          entering={FadeIn.delay(300).duration(400)}
          style={{ fontSize: 32, fontWeight: "900", color: theme.foreground, textAlign: "center", marginBottom: 12 }}
        >
          Upgrade Complete!
        </Animated.Text>

        <Animated.Text
          entering={FadeIn.delay(500).duration(400)}
          style={{ fontSize: 16, color: theme.mutedForeground, textAlign: "center", marginBottom: 40, lineHeight: 24 }}
        >
          Your plan has been upgraded. Enjoy all the new features!
        </Animated.Text>

        <Animated.View entering={FadeIn.delay(700).duration(400)} style={{ width: "100%" }}>
          <TouchableOpacity
            onPress={() => navigation.replace("MainTabs", { screen: "SwipeDeck" })}
            style={{
              width: "100%",
              paddingVertical: 18,
              borderRadius: 16,
              backgroundColor: colors.brand.traceRed,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>Let's Go</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}
