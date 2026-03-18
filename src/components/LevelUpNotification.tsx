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
import { Sparkles } from "lucide-react-native";
import { colors } from "../theme/colors";

interface LevelUpNotificationProps {
  level: number;
  visible: boolean;
  onDismiss: () => void;
}

export default function LevelUpNotification({
  level,
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

      timerRef.current = setTimeout(() => {
        onDismiss();
      }, 3000);
    } else {
      rotation.value = 0;
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [visible, onDismiss, rotation]);

  const crownStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

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
            {/* Spinning crown emoji */}
            <Animated.View
              entering={FadeIn.duration(300)}
              style={[styles.crownContainer, crownStyle]}
            >
              <Text style={styles.crownEmoji}>{"\u{1F451}"}</Text>
            </Animated.View>

            {/* Level Up heading */}
            <Animated.Text
              entering={FadeInUp.duration(400).delay(200)}
              style={styles.heading}
            >
              Level Up!
            </Animated.Text>

            {/* Level number */}
            <Animated.Text
              entering={ZoomIn.springify().damping(12).stiffness(200).delay(400)}
              style={styles.levelNumber}
            >
              {level}
            </Animated.Text>

            {/* Subtitle */}
            <Animated.Text
              entering={FadeIn.duration(400).delay(500)}
              style={styles.subtitle}
            >
              Deal Hunter Level {level}!
            </Animated.Text>

            {/* Sparkle row */}
            <Animated.View
              entering={FadeIn.duration(400).delay(600)}
              style={styles.sparkleRow}
            >
              {Array.from({ length: 5 }).map((_, i) => (
                <Animated.View
                  key={i}
                  entering={ZoomIn.delay(700 + i * 100)}
                >
                  <Sparkles
                    size={20}
                    color="#ffffff"
                    fill="#ffffff"
                  />
                </Animated.View>
              ))}
            </Animated.View>

            {/* Tap to dismiss hint */}
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
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  card: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 24,
    paddingVertical: 40,
    paddingHorizontal: 32,
    alignItems: "center",
    backgroundColor: colors.brand.amber500,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 30,
    elevation: 16,
  },
  crownContainer: {
    marginBottom: 16,
  },
  crownEmoji: {
    fontSize: 48,
  },
  heading: {
    fontSize: 32,
    fontWeight: "800",
    color: "#ffffff",
    marginBottom: 8,
  },
  levelNumber: {
    fontSize: 72,
    fontWeight: "900",
    color: "#ffffff",
    marginBottom: 8,
    lineHeight: 80,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.9)",
    marginBottom: 20,
  },
  sparkleRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 20,
  },
  hint: {
    fontSize: 12,
    fontWeight: "500",
    color: "rgba(255, 255, 255, 0.6)",
  },
});
