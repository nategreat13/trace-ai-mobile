import React from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  Pressable,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInLeft,
  FadeInUp,
  ZoomIn,
} from "react-native-reanimated";
import { X, Heart, Star, Eye } from "lucide-react-native";
import { colors } from "../../theme/colors";

interface HowToSwipeModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function HowToSwipeModal({
  visible,
  onClose,
}: HowToSwipeModalProps) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;
  const isDark = scheme === "dark";

  const steps = [
    {
      bgColor: isDark ? "rgba(239, 68, 68, 0.15)" : "#FEE2E2",
      icon: <X size={24} color={colors.brand.traceRed} strokeWidth={3} />,
      title: "Swipe left or tap X",
      desc: "Skip this deal",
    },
    {
      bgColor: isDark ? "rgba(0, 214, 101, 0.15)" : "#DCFCE7",
      icon: (
        <Heart
          size={24}
          color={colors.brand.traceGreen}
          fill={colors.brand.traceGreen}
        />
      ),
      title: "Swipe right or tap heart",
      desc: "Like this deal",
    },
    {
      bgColor: isDark ? "rgba(1, 173, 255, 0.15)" : "#DBEAFE",
      icon: <Star size={24} color="#01ADFF" fill="#01ADFF" />,
      title: "Tap the center button",
      desc: "Save deal to your list",
    },
    {
      bgColor: isDark ? theme.muted : "#F5F5F5",
      icon: <Eye size={24} color={theme.mutedForeground} />,
      title: "Tap a card",
      desc: "See full deal details",
    },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Animated.View
          entering={FadeInUp.springify().damping(20).stiffness(260)}
          style={[styles.card, { backgroundColor: theme.card }]}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            {/* Header */}
            <Animated.View
              entering={FadeIn.delay(100)}
              style={styles.header}
            >
              <Text style={[styles.title, { color: theme.foreground }]}>
                How it works
              </Text>
              <TouchableOpacity
                style={[styles.closeButton, { backgroundColor: theme.muted }]}
                onPress={onClose}
                hitSlop={8}
              >
                <X size={16} color={theme.mutedForeground} />
              </TouchableOpacity>
            </Animated.View>

            {/* Steps */}
            <View style={styles.stepsContainer}>
              {steps.map((step, i) => (
                <Animated.View
                  key={i}
                  entering={FadeInLeft.delay(150 + i * 100)
                    .springify()
                    .stiffness(300)
                    .damping(24)}
                  style={styles.stepRow}
                >
                  <Animated.View
                    entering={ZoomIn.delay(200 + i * 100)
                      .springify()
                      .stiffness(400)
                      .damping(18)}
                    style={[
                      styles.iconCircle,
                      { backgroundColor: step.bgColor },
                    ]}
                  >
                    {step.icon}
                  </Animated.View>
                  <View style={styles.stepText}>
                    <Text
                      style={[
                        styles.stepTitle,
                        { color: theme.foreground },
                      ]}
                    >
                      {step.title}
                    </Text>
                    <Text
                      style={[
                        styles.stepDesc,
                        { color: theme.mutedForeground },
                      ]}
                    >
                      {step.desc}
                    </Text>
                  </View>
                </Animated.View>
              ))}
            </View>

            {/* CTA Button */}
            <Animated.View entering={FadeIn.delay(600)}>
              <TouchableOpacity
                style={styles.ctaButton}
                onPress={onClose}
                activeOpacity={0.85}
              >
                <Text style={styles.ctaText}>Got it, let's go!</Text>
              </TouchableOpacity>
            </Animated.View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 24,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  stepsContainer: {
    gap: 16,
    marginBottom: 24,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  stepText: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  stepDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  ctaButton: {
    backgroundColor: "#FF655B",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
});
