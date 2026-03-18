import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  useColorScheme,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { colors } from "../theme/colors";

interface Personality {
  title: string;
  description: string;
  emoji: string;
}

interface PersonalityRevealProps {
  visible: boolean;
  personality: string;
  onContinue: () => void;
}

export default function PersonalityReveal({
  visible,
  personality,
  onContinue,
}: PersonalityRevealProps) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;

  let parsed: Personality | null = null;
  try {
    parsed = JSON.parse(personality) as Personality;
  } catch {
    parsed = null;
  }

  if (!parsed) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Animated.View
          entering={FadeIn.duration(600).delay(200)}
          style={[styles.card, { backgroundColor: theme.card }]}
        >
          <Text style={styles.emoji}>{parsed.emoji}</Text>

          <Text style={[styles.title, { color: theme.foreground }]}>
            {parsed.title}
          </Text>

          <Text style={[styles.description, { color: theme.mutedForeground }]}>
            {parsed.description}
          </Text>

          <TouchableOpacity onPress={onContinue} style={styles.button}>
            <Text style={styles.buttonText}>Start Swiping</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  emoji: {
    fontSize: 80,
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
    marginBottom: 32,
  },
  button: {
    backgroundColor: "#FF655B",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 48,
    alignItems: "center",
    width: "100%",
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "700",
  },
});
