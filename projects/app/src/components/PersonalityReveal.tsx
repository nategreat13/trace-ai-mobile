import React, { useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  useColorScheme,
} from "react-native";
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  withRepeat,
  withDelay,
  Easing,
} from "react-native-reanimated";
import { colors } from "../theme/colors";

interface Personality {
  title: string;
  description: string;
  emoji: string;
}

interface PersonalityRevealProps {
  visible: boolean;
  personality: string;
  onContinue: () => void;
}

// Delay before emoji animation fires (after card fades in)
const ANIM_DELAY = 900;

function AnimatedEmoji({ emoji }: { emoji: string }) {
  const rotate = useSharedValue(0);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const scaleX = useSharedValue(1);

  useEffect(() => {
    switch (emoji) {
      // 🎲 Dice — tumbling roll
      case "🎲":
        rotate.value = withDelay(
          ANIM_DELAY,
          withSequence(
            withTiming(360, { duration: 500, easing: Easing.out(Easing.cubic) }),
            withTiming(360, { duration: 200 }), // hold
            withTiming(720, { duration: 400, easing: Easing.inOut(Easing.ease) }),
          )
        );
        translateX.value = withDelay(
          ANIM_DELAY,
          withSequence(
            withTiming(18, { duration: 250 }),
            withTiming(-18, { duration: 250 }),
            withSpring(0, { damping: 10, stiffness: 300 }),
          )
        );
        scale.value = withDelay(
          ANIM_DELAY + 800,
          withSpring(1.25, { damping: 6, stiffness: 300 })
        );
        setTimeout(() => {
          scale.value = withSpring(1, { damping: 8, stiffness: 200 });
        }, ANIM_DELAY + 1050);
        break;

      // 🌍 Globe — simulate spin with scaleX squeeze
      case "🌍":
        scaleX.value = withDelay(
          ANIM_DELAY,
          withRepeat(
            withSequence(
              withTiming(0.15, { duration: 350, easing: Easing.inOut(Easing.ease) }),
              withTiming(1, { duration: 350, easing: Easing.inOut(Easing.ease) }),
            ),
            3,
            false
          )
        );
        break;

      // ✨ Sparkle — rapid multi-pulse
      case "✨":
        scale.value = withDelay(
          ANIM_DELAY,
          withSequence(
            withTiming(1.5, { duration: 150 }),
            withTiming(0.85, { duration: 100 }),
            withTiming(1.4, { duration: 150 }),
            withTiming(0.9, { duration: 100 }),
            withSpring(1, { damping: 8, stiffness: 250 }),
          )
        );
        rotate.value = withDelay(
          ANIM_DELAY,
          withSequence(
            withTiming(-20, { duration: 100 }),
            withTiming(20, { duration: 100 }),
            withTiming(-15, { duration: 80 }),
            withTiming(15, { duration: 80 }),
            withSpring(0, { damping: 10 }),
          )
        );
        break;

      // 🏔️ Thrill Chaser — big jump
      case "🏔️":
        translateY.value = withDelay(
          ANIM_DELAY,
          withSequence(
            withTiming(-40, { duration: 280, easing: Easing.out(Easing.quad) }),
            withTiming(6, { duration: 180, easing: Easing.in(Easing.quad) }),
            withSpring(0, { damping: 8, stiffness: 300 }),
            withDelay(200,
              withSequence(
                withTiming(-22, { duration: 200, easing: Easing.out(Easing.quad) }),
                withSpring(0, { damping: 10, stiffness: 300 }),
              )
            ),
          )
        );
        break;

      // 💰 Budget Genius — coin shake
      case "💰":
        translateX.value = withDelay(
          ANIM_DELAY,
          withSequence(
            withTiming(-12, { duration: 60 }),
            withTiming(12, { duration: 60 }),
            withTiming(-10, { duration: 60 }),
            withTiming(10, { duration: 60 }),
            withTiming(-8, { duration: 60 }),
            withTiming(8, { duration: 60 }),
            withSpring(0, { damping: 12, stiffness: 400 }),
          )
        );
        scale.value = withDelay(
          ANIM_DELAY,
          withSequence(
            withTiming(1.2, { duration: 200 }),
            withSpring(1, { damping: 8, stiffness: 250 }),
          )
        );
        break;

      // 🏖️ Beach — gentle wave sway
      case "🏖️":
        rotate.value = withDelay(
          ANIM_DELAY,
          withRepeat(
            withSequence(
              withTiming(-12, { duration: 350, easing: Easing.inOut(Easing.ease) }),
              withTiming(12, { duration: 350, easing: Easing.inOut(Easing.ease) }),
            ),
            3,
            true
          )
        );
        setTimeout(() => {
          rotate.value = withSpring(0, { damping: 10 });
        }, ANIM_DELAY + 2200);
        break;

      // 🏛️ Culture Collector — slow dignified pulse
      case "🏛️":
        scale.value = withDelay(
          ANIM_DELAY,
          withSequence(
            withTiming(1.2, { duration: 500, easing: Easing.inOut(Easing.ease) }),
            withTiming(1, { duration: 400, easing: Easing.inOut(Easing.ease) }),
            withTiming(1.1, { duration: 400, easing: Easing.inOut(Easing.ease) }),
            withSpring(1, { damping: 10, stiffness: 200 }),
          )
        );
        break;

      // 👨‍👩‍👧‍👦 Family — happy bounces
      case "👨‍👩‍👧‍👦":
        translateY.value = withDelay(
          ANIM_DELAY,
          withRepeat(
            withSequence(
              withTiming(-20, { duration: 220, easing: Easing.out(Easing.quad) }),
              withTiming(0, { duration: 220, easing: Easing.in(Easing.quad) }),
            ),
            3,
            false
          )
        );
        break;

      // Default — pop scale
      default:
        scale.value = withDelay(
          ANIM_DELAY,
          withSequence(
            withSpring(1.3, { damping: 6, stiffness: 300 }),
            withSpring(1, { damping: 8, stiffness: 200 }),
          )
        );
    }
  }, [emoji]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
      { scale: scale.value },
      { scaleX: scaleX.value },
    ],
  }));

  return (
    <Animated.Text style={[styles.emoji, style]}>
      {emoji}
    </Animated.Text>
  );
}

export default function PersonalityReveal({
  visible,
  personality,
  onContinue,
}: PersonalityRevealProps) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;

  let parsed: Personality | null = null;
  try {
    parsed = JSON.parse(personality) as Personality;
  } catch {
    parsed = null;
  }

  if (!parsed) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Animated.View
          entering={FadeIn.duration(600).delay(200)}
          style={[styles.card, { backgroundColor: theme.card }]}
        >
          <AnimatedEmoji emoji={parsed.emoji} />

          <Text style={[styles.title, { color: theme.foreground }]}>
            {parsed.title}
          </Text>

          <Text style={[styles.description, { color: theme.mutedForeground }]}>
            {parsed.description}
          </Text>

          <TouchableOpacity onPress={onContinue} style={styles.button}>
            <Text style={styles.buttonText}>Start Swiping</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  emoji: {
    fontSize: 80,
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
    marginBottom: 32,
  },
  button: {
    backgroundColor: "#FF655B",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 48,
    alignItems: "center",
    width: "100%",
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "700",
  },
});
