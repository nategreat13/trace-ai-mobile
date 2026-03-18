import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  useColorScheme,
} from "react-native";
import {
  Search,
  Bookmark,
  SlidersHorizontal,
  MousePointerClick,
  X,
} from "lucide-react-native";
import Animated, {
  FadeIn,
  FadeInLeft,
  FadeInUp,
  ZoomIn,
} from "react-native-reanimated";
import { colors } from "../../theme/colors";

interface HowToExploreModalProps {
  visible: boolean;
  onClose: () => void;
}

interface StepItem {
  iconBgLight: string;
  iconBgDark: string;
  iconColor: string;
  Icon: React.ComponentType<{ size: number; color: string }>;
  title: string;
  desc: string;
}

const STEPS: StepItem[] = [
  {
    iconBgLight: "#dbeafe",
    iconBgDark: "rgba(59,130,246,0.15)",
    iconColor: "#3b82f6",
    Icon: Search,
    title: "Search destinations",
    desc: "Type any city or airport to find specific deals",
  },
  {
    iconBgLight: "#f3e8ff",
    iconBgDark: "rgba(168,85,247,0.15)",
    iconColor: "#a855f7",
    Icon: SlidersHorizontal,
    title: "Filter & sort",
    desc: "Filter by month, deal type, destination, and more",
  },
  {
    iconBgLight: "#ffe4e6",
    iconBgDark: "rgba(244,63,94,0.15)",
    iconColor: "#f43f5e",
    Icon: Bookmark,
    title: "Save deals",
    desc: "Tap the heart icon to save a deal to your dashboard",
  },
  {
    iconBgLight: "#f5f5f5",
    iconBgDark: "rgba(255,255,255,0.08)",
    iconColor: "#737373",
    Icon: MousePointerClick,
    title: "Tap a card",
    desc: "See full deal details, AI insights & booking info",
  },
];

export default function HowToExploreModal({
  visible,
  onClose,
}: HowToExploreModalProps) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;
  const isDark = scheme === "dark";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        <Animated.View
          entering={FadeInUp.duration(350).springify().damping(20).stiffness(260)}
          style={[styles.card, { backgroundColor: theme.card }]}
        >
          <TouchableOpacity activeOpacity={1}>
            {/* Header */}
            <Animated.View
              entering={FadeIn.delay(100)}
              style={styles.headerRow}
            >
              <Text style={[styles.headerTitle, { color: theme.foreground }]}>
                How to Explore
              </Text>
              <TouchableOpacity
                onPress={onClose}
                style={[
                  styles.closeButton,
                  { backgroundColor: theme.muted },
                ]}
              >
                <X size={16} color={theme.mutedForeground} />
              </TouchableOpacity>
            </Animated.View>

            {/* Steps */}
            <View style={styles.stepsContainer}>
              {STEPS.map((step, index) => (
                <Animated.View
                  key={index}
                  entering={FadeInLeft.delay(150 + index * 100)
                    .springify()
                    .stiffness(300)
                    .damping(24)}
                  style={styles.stepRow}
                >
                  <Animated.View
                    entering={ZoomIn.delay(200 + index * 100)
                      .springify()
                      .stiffness(400)
                      .damping(18)}
                    style={[
                      styles.stepIconWrapper,
                      {
                        backgroundColor: isDark
                          ? step.iconBgDark
                          : step.iconBgLight,
                      },
                    ]}
                  >
                    <step.Icon size={22} color={step.iconColor} />
                  </Animated.View>
                  <View style={styles.stepTextContainer}>
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
                onPress={onClose}
                style={styles.ctaButton}
                activeOpacity={0.8}
              >
                <Text style={styles.ctaText}>Got it!</Text>
              </TouchableOpacity>
            </Animated.View>
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
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
  headerRow: {
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
  stepIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  stepTextContainer: {
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
    backgroundColor: colors.brand.traceRed,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
  },
  ctaText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
});
