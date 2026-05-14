import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableWithoutFeedback,
  Modal,
  StyleSheet,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInUp,
  ZoomIn,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { colors } from "../theme/colors";
import { getLevelInfo, SWIPES_PER_LEVEL } from "../lib/constants";

interface LevelUpNotificationProps {
  level: number;
  swipeCount: number;
  visible: boolean;
  onDismiss: () => void;
}

export default function LevelUpNotification({
  level,
  swipeCount,
  visible,
  onDismiss,
}: LevelUpNotificationProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      rotation.value = withRepeat(
        withTiming(360, { duration: 3000, easing: Easing.linear }),
        -1,
        false
      );
      timerRef.current = setTimeout(onDismiss, 4500);
    } else {
      rotation.value = 0;
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible, onDismiss, rotation]);

  const emojiStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const { current, next, isMax, swipesToNext } = getLevelInfo(level, swipeCount);
  // Right after leveling up, swipeCount % 25 === 0 so progress = 0 (fresh start)
  const progress = (swipeCount % SWIPES_PER_LEVEL) / SWIPES_PER_LEVEL;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <TouchableWithoutFeedback onPress={onDismiss}>
        <View style={styles.overlay}>
          <Animated.View
            entering={ZoomIn.springify().damping(14).stiffness(120)}
            style={styles.card}
          >
            {/* Spinning emoji */}
            <Animated.View entering={FadeIn.duration(300)} style={emojiStyle}>
              <Text style={styles.emoji}>{current.emoji}</Text>
            </Animated.View>

            {/* Level label */}
            <Animated.Text
              entering={FadeInUp.duration(400).delay(150)}
              style={styles.levelLabel}
            >
              LEVEL {level}
            </Animated.Text>

            {/* Title — the main moment */}
            <Animated.Text
              entering={ZoomIn.springify().damping(12).stiffness(180).delay(300)}
              style={styles.title}
            >
              {current.title}
            </Animated.Text>

            {/* Divider */}
            <Animated.View
              entering={FadeIn.duration(300).delay(500)}
              style={styles.divider}
            />

            {/* Next level teaser */}
            {!isMax ? (
              <Animated.View
                entering={FadeInUp.duration(400).delay(600)}
                style={styles.nextWrap}
              >
                <Text style={styles.nextLabel}>Next up</Text>
                <View style={styles.nextRow}>
                  <Text style={styles.nextEmoji}>{next.emoji}</Text>
                  <Text style={styles.nextTitle}>{next.title}</Text>
                </View>
                {/* Progress bar */}
                <View style={styles.barTrack}>
                  <Animated.View
                    entering={FadeIn.duration(600).delay(800)}
                    style={[styles.barFill, { width: `${Math.round(progress * 100)}%` }]}
                  />
                </View>
                <Text style={styles.swipesHint}>
                  {swipesToNext === SWIPES_PER_LEVEL
                    ? `${SWIPES_PER_LEVEL} swipes to unlock`
                    : `${swipesToNext} more swipe${swipesToNext === 1 ? "" : "s"} to unlock`}
                </Text>
              </Animated.View>
            ) : (
              <Animated.Text
                entering={FadeIn.duration(400).delay(600)}
                style={styles.maxText}
              >
                You've reached the top. Legend.
              </Animated.Text>
            )}

            <Animated.Text
              entering={FadeIn.duration(400).delay(900)}
              style={styles.hint}
            >
              Tap anywhere to continue
            </Animated.Text>
          </Animated.View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  card: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 24,
    paddingVertical: 36,
    paddingHorizontal: 28,
    alignItems: "center",
    backgroundColor: colors.brand.amber500,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 30,
    elevation: 16,
    gap: 4,
  },
  emoji: {
    fontSize: 52,
    marginBottom: 8,
  },
  levelLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "rgba(255,255,255,0.7)",
    letterSpacing: 2,
    marginBottom: 4,
  },
  title: {
    fontSize: 34,
    fontWeight: "900",
    color: "#ffffff",
    textAlign: "center",
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  divider: {
    width: 40,
    height: 2,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderRadius: 1,
    marginVertical: 16,
  },
  nextWrap: {
    width: "100%",
    alignItems: "center",
    gap: 6,
    marginBottom: 16,
  },
  nextLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.6)",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  nextRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  nextEmoji: {
    fontSize: 18,
  },
  nextTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "rgba(255,255,255,0.9)",
  },
  barTrack: {
    width: "100%",
    height: 5,
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 3,
    overflow: "hidden",
    marginTop: 4,
  },
  barFill: {
    height: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 3,
  },
  swipesHint: {
    fontSize: 12,
    color: "rgba(255,255,255,0.65)",
    fontWeight: "500",
  },
  maxText: {
    fontSize: 15,
    fontWeight: "600",
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
    marginBottom: 16,
  },
  hint: {
    fontSize: 12,
    fontWeight: "500",
    color: "rgba(255,255,255,0.5)",
    marginTop: 8,
  },
});
