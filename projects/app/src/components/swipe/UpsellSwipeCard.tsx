import React, { useCallback, useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  runOnJS,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Crown, Bell, ArrowRight } from "lucide-react-native";
import { colors } from "../../theme/colors";

// Same thresholds/exit mechanics as SwipeCard.tsx — this is a sibling
// component (not a shared refactor) so the proven deal-swiping gesture
// code in SwipeCard.tsx stays completely untouched.
const SWIPE_X_THRESHOLD = 80;
const VELOCITY_THRESHOLD = 300;
const EXIT_X = 500;
const EXIT_X_DURATION = 300;
const ROTATION_INPUT = [-300, 0, 300];
const ROTATION_OUTPUT = [-30, 0, 30];
const SCALE_INPUT = [-300, 0, 300];
const SCALE_OUTPUT = [0.95, 1, 0.95];

interface UpsellSwipeCardProps {
  variant: "premium" | "business";
  onDismiss: () => void;
  onUpgrade: () => void;
  triggerSwipe: "left" | "right" | null;
}

const CONTENT = {
  premium: {
    eyebrow: "TRACE PREMIUM",
    Icon: Bell,
    headline: "Get notified the\nmoment deals drop",
    sub: "Deal alerts for any destination — we'll watch for you, so you don't have to keep checking.",
    cta: "Tap to unlock alerts",
    gradient: [colors.brand.traceRed, colors.brand.tracePink] as const,
  },
  business: {
    eyebrow: "TRACE BUSINESS",
    Icon: Crown,
    headline: "Fly business.\nPay economy.",
    sub: "Lie-flat business class deals at a fraction of the price, right in your deck.",
    cta: "Tap to see Business",
    gradient: ["#8a5a00", colors.brand.amber500] as const,
  },
};

export default function UpsellSwipeCard({
  variant,
  onDismiss,
  onUpgrade,
  triggerSwipe,
}: UpsellSwipeCardProps) {
  const content = CONTENT[variant];

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const handleDismiss = useCallback(() => onDismiss(), [onDismiss]);
  const handleUpgrade = useCallback(() => onUpgrade(), [onUpgrade]);

  // Programmatic swipe via the bottom X/heart buttons — same pattern as
  // SwipeCard's triggerSwipe prop, so those buttons dismiss this card too.
  useEffect(() => {
    if (!triggerSwipe) return;
    const exitX = triggerSwipe === "left" ? -EXIT_X : EXIT_X;
    translateX.value = withTiming(exitX, { duration: EXIT_X_DURATION }, () => {
      runOnJS(handleDismiss)();
    });
  }, [triggerSwipe, translateX, handleDismiss]);

  const tapScale = useSharedValue(1);

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY;
    })
    .onEnd((event) => {
      const { translationX, velocityX } = event;
      if (translationX < -SWIPE_X_THRESHOLD || velocityX < -VELOCITY_THRESHOLD) {
        translateX.value = withTiming(-EXIT_X, { duration: EXIT_X_DURATION }, () => {
          runOnJS(handleDismiss)();
        });
        return;
      }
      if (translationX > SWIPE_X_THRESHOLD || velocityX > VELOCITY_THRESHOLD) {
        translateX.value = withTiming(EXIT_X, { duration: EXIT_X_DURATION }, () => {
          runOnJS(handleDismiss)();
        });
        return;
      }
      translateX.value = withTiming(0, { duration: 200 });
      translateY.value = withTiming(0, { duration: 200 });
    });

  const tapGesture = Gesture.Tap()
    .onBegin(() => {
      tapScale.value = withTiming(0.965, { duration: 80 });
    })
    .onEnd(() => {
      tapScale.value = withTiming(1, { duration: 150 });
      runOnJS(handleUpgrade)();
    })
    .onFinalize(() => {
      tapScale.value = withTiming(1, { duration: 150 });
    });

  const composedGesture = Gesture.Race(panGesture, tapGesture);

  const cardAnimatedStyle = useAnimatedStyle(() => {
    const rotation = interpolate(translateX.value, ROTATION_INPUT, ROTATION_OUTPUT);
    const scale = interpolate(translateX.value, SCALE_INPUT, SCALE_OUTPUT);
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotation}deg` },
        { scale: scale * tapScale.value },
      ],
    };
  });

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View style={[styles.card, cardAnimatedStyle]}>
        <LinearGradient
          colors={content.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.content}>
          <View style={styles.eyebrowPill}>
            <content.Icon color="#fff" size={14} />
            <Text style={styles.eyebrowText}>{content.eyebrow}</Text>
          </View>
          <Text style={styles.headline}>{content.headline}</Text>
          <Text style={styles.sub}>{content.sub}</Text>
          <View style={styles.ctaRow}>
            <Text style={styles.ctaText}>{content.cta}</Text>
            <ArrowRight color="#fff" size={18} />
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: {
    position: "absolute",
    top: 0,
    left: 4,
    right: 4,
    bottom: 0,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  content: {
    flex: 1,
    justifyContent: "flex-end",
    padding: 24,
    paddingBottom: 32,
  },
  eyebrowPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 16,
  },
  eyebrowText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.5,
  },
  headline: {
    fontSize: 30,
    fontWeight: "900",
    color: "#fff",
    lineHeight: 34,
    marginBottom: 12,
    textShadowColor: "rgba(0,0,0,0.25)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  sub: {
    fontSize: 14,
    color: "rgba(255,255,255,0.9)",
    lineHeight: 20,
    marginBottom: 24,
  },
  ctaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  ctaText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#fff",
  },
});
