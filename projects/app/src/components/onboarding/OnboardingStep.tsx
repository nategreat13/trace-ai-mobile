import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../../theme/colors";

interface OnboardingStepProps {
  step: number;
  totalSteps: number;
  title: string;
  subtitle: string;
  canProceed: boolean;
  onNext: () => void;
  onBack: () => void;
  children: React.ReactNode;
}

export default function OnboardingStep({
  step,
  totalSteps,
  title,
  subtitle,
  canProceed,
  onNext,
  onBack,
  children,
}: OnboardingStepProps) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(18);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [step]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Progress dots */}
      <View style={styles.progressRow}>
        {Array.from({ length: totalSteps }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i <= step
                ? [styles.dotActive, { backgroundColor: colors.brand.traceRed }]
                : { backgroundColor: theme.border },
            ]}
          />
        ))}
      </View>

      {/* Animated header + content */}
      <Animated.View
        style={[
          styles.animatedBody,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.foreground }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: theme.mutedForeground }]}>
            {subtitle}
          </Text>
        </View>
        <View style={styles.content}>{children}</View>
      </Animated.View>

      {/* Footer buttons */}
      <View style={styles.footer}>
        {step > 0 && (
          <TouchableOpacity
            onPress={onBack}
            style={[styles.backButton, { borderColor: theme.border }]}
          >
            <Text style={[styles.backButtonText, { color: theme.foreground }]}>
              Back
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={onNext}
          disabled={!canProceed}
          style={[
            styles.continueButton,
            step === 0 && styles.continueButtonFull,
            { opacity: canProceed ? 1 : 0.4 },
          ]}
        >
          <Text style={styles.continueButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingTop: 20,
    paddingHorizontal: 24,
  },
  dot: {
    height: 8,
    width: 8,
    borderRadius: 4,
  },
  dotActive: {
    width: 22,
    height: 8,
    borderRadius: 4,
  },
  animatedBody: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  footer: {
    flexDirection: "row",
    paddingHorizontal: 24,
    paddingBottom: 16,
    gap: 12,
  },
  continueButtonFull: {
    flex: 1,
  },
  backButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  continueButton: {
    flex: 2,
    backgroundColor: "#FF655B",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  continueButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
});
