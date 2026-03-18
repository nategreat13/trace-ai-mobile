import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Modal,
  StyleSheet,
  useColorScheme,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInLeft,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from "react-native-reanimated";
import { Brain, Check } from "lucide-react-native";
import { colors } from "../../theme/colors";

interface AILearningModalProps {
  visible: boolean;
  onClose: () => void;
}

const insights = [
  { icon: "\u2708\uFE0F", text: "Learning your style" },
  { icon: "\u{1F4B0}", text: "Analyzing price signals" },
  { icon: "\u{1F3AF}", text: "Tuning your feed" },
];

export default function AILearningModal({
  visible,
  onClose,
}: AILearningModalProps) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;

  const [activeInsight, setActiveInsight] = useState(0);
  const [progress, setProgress] = useState(0);

  const brainScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0);

  const brainAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: brainScale.value }],
  }));

  const pulseAnimatedStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  const progressWidth = useAnimatedStyle(() => ({
    width: `${progress}%` as any,
  }));

  useEffect(() => {
    if (!visible) {
      setActiveInsight(0);
      setProgress(0);
      return;
    }

    // Brain pulsing animation
    brainScale.value = withRepeat(
      withSequence(
        withTiming(1.07, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) })
      ),
      -1
    );

    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(0.3, { duration: 700 }),
        withTiming(0, { duration: 700 })
      ),
      -1
    );

    // Each insight shows for 1200ms
    const insightInterval = setInterval(() => {
      setActiveInsight((prev) => {
        if (prev >= insights.length - 1) {
          clearInterval(insightInterval);
          return prev;
        }
        return prev + 1;
      });
    }, 1200);

    // Progress: 0 to 100 in steps of 2 every 80ms = 4000ms total
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          setTimeout(onClose, 500);
          return 100;
        }
        return prev + 2;
      });
    }, 80);

    return () => {
      clearInterval(insightInterval);
      clearInterval(progressInterval);
    };
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Animated.View
          entering={FadeIn.springify().damping(22).stiffness(280)}
          style={styles.card}
        >
          {/* Header */}
          <View style={styles.header}>
            {/* Gradient overlay effect */}
            <View style={styles.gradientOverlay} />

            {/* Brain icon */}
            <Animated.View style={[styles.brainContainer, brainAnimatedStyle]}>
              <Brain size={32} color="#FFFFFF" />
              <Animated.View
                style={[styles.brainPulse, pulseAnimatedStyle]}
              />
            </Animated.View>

            <Text style={styles.headerTitle}>AI Is Learning</Text>
            <Text style={styles.headerSubtitle}>Personalizing your feed</Text>
          </View>

          {/* Insights */}
          <View style={styles.insightsContainer}>
            {insights.map((insight, i) => (
              <Animated.View
                key={i}
                entering={FadeInLeft.delay(i * 80).duration(350)}
                style={[
                  styles.insightRow,
                  i === activeInsight && styles.insightActive,
                  { opacity: i <= activeInsight ? 1 : 0.2 },
                ]}
              >
                <Text style={styles.insightIcon}>{insight.icon}</Text>
                <Text
                  style={[
                    styles.insightText,
                    {
                      color:
                        i <= activeInsight
                          ? "#FFFFFF"
                          : "rgba(255,255,255,0.3)",
                    },
                  ]}
                >
                  {insight.text}
                </Text>

                {/* Checkmark for completed insights */}
                {i < activeInsight && (
                  <Animated.View
                    entering={ZoomIn.springify()}
                    style={styles.checkCircle}
                  >
                    <Check size={10} color="#FFFFFF" strokeWidth={3} />
                  </Animated.View>
                )}

                {/* Pulsing dot for active insight */}
                {i === activeInsight && (
                  <Animated.View
                    entering={FadeIn}
                    style={styles.activeDot}
                  />
                )}
              </Animated.View>
            ))}
          </View>

          {/* Progress bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <View
                style={[styles.progressFill, { width: `${progress}%` }]}
              />
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.80)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  card: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: "#1a1a2e",
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 16,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 12,
    alignItems: "center",
    overflow: "hidden",
  },
  gradientOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    backgroundColor: "rgba(139, 92, 246, 0.15)",
  },
  brainContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    overflow: "hidden",
    // Violet gradient approximation
    backgroundColor: "#7c3aed",
    shadowColor: "#8b5cf6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  brainPulse: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: "500",
    color: "#c4b5fd",
    marginTop: 2,
  },
  insightsContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 6,
  },
  insightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  insightActive: {
    backgroundColor: "rgba(139, 92, 246, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.4)",
  },
  insightIcon: {
    fontSize: 16,
  },
  insightText: {
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
  },
  checkCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#22c55e",
    alignItems: "center",
    justifyContent: "center",
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#a78bfa",
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    paddingTop: 12,
  },
  progressTrack: {
    height: 6,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
    // Gradient approximation: violet to pink
    backgroundColor: "#8b5cf6",
  },
});
