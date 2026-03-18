import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  StyleSheet,
  useColorScheme,
} from "react-native";
import Animated, { FadeInLeft, FadeInDown, ZoomIn } from "react-native-reanimated";
import { Bookmark, Bell, Trophy, ArrowDown, X } from "lucide-react-native";
import { colors } from "../../theme/colors";

interface HowToDashboardModalProps {
  visible: boolean;
  onClose: () => void;
}

interface TutorialStep {
  icon: React.ReactNode;
  iconBgColor: string;
  title: string;
  desc: string;
}

export default function HowToDashboardModal({
  visible,
  onClose,
}: HowToDashboardModalProps) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;
  const isDark = scheme === "dark";

  const steps: TutorialStep[] = [
    {
      icon: <Bookmark size={22} color={colors.brand.traceRed} />,
      iconBgColor: isDark ? "rgba(244,63,94,0.15)" : "rgba(244,63,94,0.1)",
      title: "Your saved deals",
      desc: "All deals you've saved from Swipe & Explore appear here",
    },
    {
      icon: <Bell size={22} color={colors.brand.amber500} />,
      iconBgColor: isDark ? "rgba(245,158,11,0.15)" : "rgba(245,158,11,0.1)",
      title: "Deal alerts",
      desc: "Get notified when deals drop for your dream destinations",
    },
    {
      icon: <Trophy size={22} color="#a855f7" />,
      iconBgColor: isDark ? "rgba(168,85,247,0.15)" : "rgba(168,85,247,0.1)",
      title: "Stats & badges",
      desc: "Track your deal hunting progress and unlock rewards",
    },
    {
      icon: <ArrowDown size={22} color={theme.mutedForeground} />,
      iconBgColor: theme.muted,
      title: "Pull to refresh",
      desc: "Pull down to sync your latest deals and alerts",
    },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.card,
            {
              backgroundColor: isDark ? "#1e1e26" : theme.card,
              borderColor: theme.border,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <Animated.View
            entering={FadeInDown.delay(100).duration(300)}
            style={styles.header}
          >
            <Text style={[styles.headerTitle, { color: theme.foreground }]}>
              Your Dashboard
            </Text>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeButton, { backgroundColor: theme.muted }]}
            >
              <X size={16} color={theme.mutedForeground} />
            </TouchableOpacity>
          </Animated.View>

          {/* Steps */}
          <View style={styles.stepsContainer}>
            {steps.map((step, i) => (
              <Animated.View
                key={i}
                entering={FadeInLeft.delay(200 + i * 100).duration(350)}
                style={styles.stepRow}
              >
                <Animated.View
                  entering={ZoomIn.delay(250 + i * 100).duration(300)}
                  style={[
                    styles.stepIcon,
                    { backgroundColor: step.iconBgColor },
                  ]}
                >
                  {step.icon}
                </Animated.View>
                <View style={styles.stepText}>
                  <Text
                    style={[styles.stepTitle, { color: theme.foreground }]}
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

          {/* CTA */}
          <Animated.View entering={FadeInDown.delay(650).duration(300)}>
            <TouchableOpacity
              style={[
                styles.ctaButton,
                { backgroundColor: colors.brand.traceRed },
              ]}
              onPress={onClose}
              activeOpacity={0.85}
            >
              <Text style={styles.ctaText}>Got it!</Text>
            </TouchableOpacity>
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  headerTitle: {
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
    gap: 14,
  },
  stepIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  stepText: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },
  stepDesc: {
    fontSize: 12,
    lineHeight: 17,
  },
  ctaButton: {
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: "center",
  },
  ctaText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
});
