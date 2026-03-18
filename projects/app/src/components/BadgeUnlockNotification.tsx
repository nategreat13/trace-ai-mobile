import React, { useEffect, useRef } from "react";
import { Text, StyleSheet, useColorScheme } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  SlideInUp,
  SlideOutUp,
} from "react-native-reanimated";
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
      timerRef.current = setTimeout(() => {
        onDismiss();
      }, 3000);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [badge, onDismiss]);

  if (!badge) return null;

  return (
    <Animated.View
      entering={SlideInUp.springify().damping(20).stiffness(300)}
      exiting={SlideOutUp.springify().damping(20).stiffness(300)}
      style={styles.container}
      pointerEvents="box-none"
    >
      <Animated.View
        entering={FadeIn.duration(300)}
        exiting={FadeOut.duration(200)}
        style={[
          styles.toast,
          {
            backgroundColor: theme.card,
            borderColor: colors.brand.amber400,
          },
        ]}
      >
        {/* Badge emoji */}
        <Text style={styles.emoji}>{badge.emoji}</Text>

        {/* Content */}
        <Animated.View
          entering={FadeIn.duration(300).delay(150)}
          style={styles.content}
        >
          {/* Badge Unlocked label */}
          <Animated.View style={styles.labelRow}>
            <Sparkles size={12} color={colors.brand.amber500} />
            <Text style={styles.label}>Badge Unlocked!</Text>
            <Sparkles size={12} color={colors.brand.amber500} />
          </Animated.View>

          {/* Badge name */}
          <Text
            style={[styles.name, { color: theme.foreground }]}
            numberOfLines={1}
          >
            {badge.name}
          </Text>

          {/* Badge description */}
          <Text
            style={[styles.description, { color: theme.mutedForeground }]}
            numberOfLines={2}
          >
            {badge.description}
          </Text>
        </Animated.View>
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
    zIndex: 100,
    paddingHorizontal: 16,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 16,
    borderWidth: 2,
    paddingVertical: 14,
    paddingHorizontal: 16,
    width: "100%",
    maxWidth: 380,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },
  emoji: {
    fontSize: 40,
  },
  content: {
    flex: 1,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 2,
  },
  label: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.brand.amber600,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  name: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 2,
  },
  description: {
    fontSize: 13,
    lineHeight: 17,
  },
});
