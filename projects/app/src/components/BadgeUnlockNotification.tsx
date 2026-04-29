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
      timerRef.current = setTimeout(onDismiss, 3000);
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
          entering={ZoomIn.duration(220).springify().damping(18).stiffness(260)}
          exiting={ZoomOut.duration(180)}
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
    maxWidth: 320,
    borderRadius: 24,
    borderWidth: 2,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 14,
  },
  emoji: {
    fontSize: 52,
    marginBottom: 12,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.brand.amber600,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  name: {
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 6,
  },
  description: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  dismissBtn: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  dismissText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
