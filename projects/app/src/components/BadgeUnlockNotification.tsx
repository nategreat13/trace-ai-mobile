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
import { Sparkles } from "lucide-react-native";
import { colors } from "../theme/colors";

interface Badge {
  name: string;
  emoji: string;
  description: string;
}

interface BadgeUnlockNotificationProps {
  badge: Badge | null;
  onDismiss: () => void;
}

/**
 * Slim top toast for a badge unlock.
 *
 * Was a centered modal card over a 45%-black full-screen backdrop. Two
 * problems with that, both reported from real use: it interrupted an active
 * swipe session for its full 2.5s, and because the backdrop swallowed every
 * touch, the app felt frozen rather than "tap to continue" — the dismiss
 * affordance read as the only way out even though the backdrop was tappable.
 *
 * A badge is a reward, not a decision. It should register in peripheral
 * vision and get out of the way, so this is now a non-blocking strip: the
 * container is pointerEvents="box-none" and only the strip itself is
 * touchable, which leaves the deck underneath fully swipeable while it's up.
 */
export default function BadgeUnlockNotification({
  badge,
  onDismiss,
}: BadgeUnlockNotificationProps) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;
  const insets = useSafeAreaInsets();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dy = useSharedValue(0);

  useEffect(() => {
    if (badge) {
      dy.value = 0;
      timerRef.current = setTimeout(onDismiss, 2600);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [badge, onDismiss, dy]);

  // Swipe up to dismiss early — the natural gesture for a top toast, and it
  // means the user never has to wait out the timer.
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

  if (!badge) return null;

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
          accessibilityLabel={`Badge unlocked: ${badge.name}. Tap to dismiss.`}
          style={[
            styles.strip,
            { backgroundColor: theme.card, borderColor: colors.brand.amber400 },
          ]}
        >
          <Text style={styles.emoji}>{badge.emoji}</Text>
          <View style={styles.textCol}>
            <View style={styles.labelRow}>
              <Sparkles size={9} color={colors.brand.amber500} />
              <Text style={styles.label}>Badge unlocked</Text>
            </View>
            {/* Name only — the description was the main thing making the old
                card tall, and it's available on the profile screen anyway. */}
            <Text style={[styles.name, { color: theme.foreground }]} numberOfLines={1}>
              {badge.name}
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
  emoji: {
    fontSize: 20,
  },
  textCol: {
    justifyContent: "center",
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  label: {
    fontSize: 9,
    fontWeight: "800",
    color: colors.brand.amber600,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  name: {
    fontSize: 14,
    fontWeight: "800",
  },
});
