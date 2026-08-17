import React, { useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, useColorScheme } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  FadeInUp,
  FadeOutUp,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme/colors";
import { getLevelInfo } from "../lib/constants";

interface LevelUpNotificationProps {
  level: number;
  swipeCount: number;
  visible: boolean;
  onDismiss: () => void;
}

/**
 * Slim top toast for a level-up.
 *
 * Was a full-screen Modal with a dark overlay, a spinning emoji, a progress
 * bar and a "tap anywhere to continue" hint — roughly a second and a half of
 * staged animation blocking the deck. In a swipe session that's an
 * interruption every 25 swipes, and it was reported as annoying long before
 * anyone looked at what triggered it.
 *
 * Matches BadgeUnlockNotification deliberately: both are rewards, both should
 * register peripherally and leave. Non-blocking (`pointerEvents="box-none"`),
 * auto-dismisses, tappable, and swipe-up-to-dismiss.
 */
export default function LevelUpNotification({
  level,
  swipeCount,
  visible,
  onDismiss,
}: LevelUpNotificationProps) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;
  const insets = useSafeAreaInsets();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dy = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      dy.value = 0;
      timerRef.current = setTimeout(onDismiss, 3000);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible, onDismiss, dy]);

  // Swipe up to dismiss early — the natural gesture for a top toast.
  const swipeUp = Gesture.Pan()
    .activeOffsetY([-10, 999])
    .onUpdate((e) => {
      dy.value = Math.min(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY < -28 || e.velocityY < -500) {
        dy.value = withTiming(-160, { duration: 150 }, () => runOnJS(onDismiss)());
        return;
      }
      dy.value = withTiming(0, { duration: 150 });
    });

  const animStyle = useAnimatedStyle(() => ({ transform: [{ translateY: dy.value }] }));

  if (!visible) return null;

  const { current } = getLevelInfo(level, swipeCount);

  return (
    <View style={[styles.wrap, { top: insets.top + 8 }]} pointerEvents="box-none">
      <GestureDetector gesture={swipeUp}>
        <Animated.View
          entering={FadeInUp.duration(220)}
          exiting={FadeOutUp.duration(200)}
          style={animStyle}
        >
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel={`Level ${level}: ${current.title}. Tap to dismiss.`}
            style={[
              styles.strip,
              { backgroundColor: theme.card, borderColor: colors.brand.amber400 },
            ]}
          >
            <Text style={styles.emoji}>{current.emoji}</Text>
            <View style={styles.textCol}>
              <Text style={styles.label}>LEVEL {level}</Text>
              <Text style={[styles.title, { color: theme.foreground }]} numberOfLines={1}>
                {current.title}
              </Text>
            </View>
          </TouchableOpacity>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 100,
    alignItems: "center",
  },
  strip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 999,
    borderWidth: 1.5,
    paddingVertical: 8,
    paddingHorizontal: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 6,
  },
  emoji: { fontSize: 20 },
  textCol: { justifyContent: "center" },
  label: {
    fontSize: 9,
    fontWeight: "800",
    color: colors.brand.amber600,
    letterSpacing: 0.8,
  },
  title: { fontSize: 14, fontWeight: "800" },
});
