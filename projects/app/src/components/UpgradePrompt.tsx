import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  useColorScheme,
} from "react-native";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { Crown, Sparkles } from "lucide-react-native";
import { colors } from "../theme/colors";
import { useFreeTrial } from "../context/TrialContext";

interface UpgradePromptProps {
  visible: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  feature?: string;
}

const PERKS = [
  "Unlimited deal swipes",
  "Unlimited saved deals",
  "Full Explore page access",
  "Real-time deal alerts",
];

export default function UpgradePrompt({
  visible,
  onClose,
  onUpgrade,
  feature,
}: UpgradePromptProps) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;
  const { available: trialAvailable, label: trialLabel } = useFreeTrial();

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        style={styles.overlay}
      >
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <Animated.View
            entering={FadeInUp.springify().damping(20).stiffness(200)}
            style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
          >
            {/* Crown icon */}
            <Animated.View
              entering={FadeIn.duration(400).delay(200)}
              style={styles.iconContainer}
            >
              <Crown size={28} color="#ffffff" />
            </Animated.View>

            {/* Title */}
            <Text style={[styles.title, { color: theme.foreground }]}>
              {feature || (trialAvailable ? "Try Premium Free" : "Upgrade to Premium")}
            </Text>
            <Text style={[styles.subtitle, { color: theme.mutedForeground }]}>
              {trialAvailable
                ? `Start your ${trialLabel} free trial — cancel anytime`
                : "Unlock unlimited access to all features"}
            </Text>

            {/* Perks list */}
            <View style={styles.perksContainer}>
              {PERKS.map((perk, index) => (
                <Animated.View
                  key={perk}
                  entering={FadeInUp.duration(300).delay(300 + index * 80)}
                  style={styles.perkRow}
                >
                  <Sparkles size={16} color={colors.brand.rose500} />
                  <Text style={[styles.perkText, { color: theme.foreground }]}>
                    {perk}
                  </Text>
                </Animated.View>
              ))}
            </View>

            {/* CTA button */}
            <TouchableOpacity
              onPress={onUpgrade}
              style={styles.ctaButton}
              activeOpacity={0.85}
            >
              <Text style={styles.ctaText}>
                {trialAvailable ? `Start ${trialLabel} free trial` : "View Plans"}
              </Text>
            </TouchableOpacity>

            {/* Dismiss */}
            <TouchableOpacity onPress={onClose} style={styles.dismissButton}>
              <Text style={[styles.dismissText, { color: theme.mutedForeground }]}>
                Maybe Later
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    backgroundColor: colors.brand.rose500,
  },
  title: {
    fontSize: 21,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 20,
  },
  perksContainer: {
    width: "100%",
    gap: 10,
    marginBottom: 20,
  },
  perkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  perkText: {
    fontSize: 14,
    fontWeight: "500",
  },
  ctaButton: {
    width: "100%",
    backgroundColor: colors.brand.rose500,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  ctaText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  dismissButton: {
    paddingVertical: 4,
  },
  dismissText: {
    fontSize: 14,
    fontWeight: "500",
  },
});
