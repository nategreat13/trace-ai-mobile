import React, { useEffect, useRef } from "react";
import { Text, TouchableOpacity, StyleSheet, useColorScheme } from "react-native";
import Animated, { FadeIn, FadeOut, ZoomIn, ZoomOut } from "react-native-reanimated";
import { Sparkles } from "lucide-react-native";
import { colors } from "../theme/colors";

interface Badge {
  name: string;
  emoji: string;
  description: string;
}

interface BadgeUnlockNotificationProps {
  badge: Badge | null;
  onDismiss: () => void;
}

export default function BadgeUnlockNotification({
  badge,
  onDismiss,
}: BadgeUnlockNotificationProps) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (badge) {
      timerRef.current = setTimeout(onDismiss, 2500);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [badge, onDismiss]);

  if (!badge) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(250)}
      style={styles.backdrop}
      pointerEvents="box-none"
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={onDismiss}
        style={styles.backdrop}
      >
        <Animated.View
          entering={ZoomIn.duration(160)}
          exiting={ZoomOut.duration(140)}
          style={[styles.card, { backgroundColor: theme.card, borderColor: colors.brand.amber400 }]}
        >
          <Text style={styles.emoji}>{badge.emoji}</Text>

          <Animated.View style={styles.labelRow}>
            <Sparkles size={11} color={colors.brand.amber500} />
            <Text style={styles.label}>Badge Unlocked!</Text>
            <Sparkles size={11} color={colors.brand.amber500} />
          </Animated.View>

          <Text style={[styles.name, { color: theme.foreground }]}>{badge.name}</Text>
          <Text style={[styles.description, { color: theme.mutedForeground }]}>{badge.description}</Text>

          <TouchableOpacity onPress={onDismiss} style={[styles.dismissBtn, { borderColor: theme.border }]}>
            <Text style={[styles.dismissText, { color: theme.mutedForeground }]}>Tap to dismiss</Text>
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
    paddingHorizontal: 32,
  },
  card: {
    width: "100%",
    maxWidth: 270,
    borderRadius: 20,
    borderWidth: 2,
    paddingVertical: 20,
    paddingHorizontal: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 10,
  },
  emoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 6,
  },
  label: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.brand.amber600,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  name: {
    fontSize: 17,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 4,
  },
  description: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 16,
  },
  dismissBtn: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  dismissText: {
    fontSize: 12,
    fontWeight: "600",
  },
});
