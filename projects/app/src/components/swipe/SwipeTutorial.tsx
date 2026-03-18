import React from "react";
import { Text, StyleSheet, useColorScheme } from "react-native";
import Animated, { FadeIn, FadeOut, SlideInUp, SlideOutUp } from "react-native-reanimated";
import { colors } from "../../theme/colors";

interface SwipeTutorialProps {
  action: "left" | "right" | "super" | null;
}

const messages: Record<string, { emoji: string; text: string }> = {
  left: { emoji: "\u{1F44B}", text: "Passed" },
  right: { emoji: "\u2764\uFE0F", text: "Liked" },
  super: { emoji: "\u{1F680}", text: "Saved" },
};

export default function SwipeTutorial({ action }: SwipeTutorialProps) {
  const scheme = useColorScheme();

  if (!action) return null;

  const message = messages[action];
  if (!message) return null;

  return (
    <Animated.View
      entering={SlideInUp.springify().damping(30).stiffness(400)}
      exiting={SlideOutUp.springify().damping(30).stiffness(400)}
      style={styles.container}
      pointerEvents="none"
    >
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(200)}
        style={styles.toast}
      >
        <Text style={styles.emoji}>{message.emoji}</Text>
        <Text style={styles.text}>{message.text}</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 60,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 50,
  },
  toast: {
    backgroundColor: "rgba(17, 17, 27, 0.95)",
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  emoji: {
    fontSize: 16,
  },
  text: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
});
