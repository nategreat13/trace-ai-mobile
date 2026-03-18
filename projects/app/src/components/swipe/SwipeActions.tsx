import React from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
} from "react-native";
import Animated, {
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { X, Heart, Bookmark } from "lucide-react-native";
import { colors } from "../../theme/colors";

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

interface SwipeActionsProps {
  onSwipe: (action: "left" | "right" | "super") => void;
  disabled?: boolean;
}

export default function SwipeActions({ onSwipe, disabled }: SwipeActionsProps) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;

  const scaleLeft = useSharedValue(1);
  const scaleCenter = useSharedValue(1);
  const scaleRight = useSharedValue(1);

  const animatedLeftStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleLeft.value }],
  }));

  const animatedCenterStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleCenter.value }],
  }));

  const animatedRightStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleRight.value }],
  }));

  const handlePressIn = (scale: SharedValue<number>) => {
    scale.value = withSpring(0.95, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = (scale: SharedValue<number>) => {
    scale.value = withSpring(1.05, { damping: 15, stiffness: 400 });
  };

  return (
    <View style={styles.container}>
      {/* Pass (X) button */}
      <AnimatedTouchable
        style={[
          styles.button,
          styles.sideButton,
          { backgroundColor: theme.card, borderColor: theme.border, opacity: disabled ? 0.3 : 1 },
          animatedLeftStyle,
        ]}
        activeOpacity={0.8}
        onPressIn={() => handlePressIn(scaleLeft)}
        onPressOut={() => handlePressOut(scaleLeft)}
        onPress={() => !disabled && onSwipe("left")}
        disabled={disabled}
      >
        <X size={28} color={colors.brand.traceRed} strokeWidth={2.5} />
      </AnimatedTouchable>

      {/* Super (Star) button - center, larger */}
      <AnimatedTouchable
        style={[
          styles.button,
          styles.centerButton,
          { opacity: disabled ? 0.3 : 1 },
          animatedCenterStyle,
        ]}
        activeOpacity={0.8}
        onPressIn={() => handlePressIn(scaleCenter)}
        onPressOut={() => handlePressOut(scaleCenter)}
        onPress={() => !disabled && onSwipe("super")}
        disabled={disabled}
      >
        <Bookmark size={30} color="#FFFFFF" strokeWidth={2} fill="#FFFFFF" />
      </AnimatedTouchable>

      {/* Like (Heart) button */}
      <AnimatedTouchable
        style={[
          styles.button,
          styles.sideButton,
          { backgroundColor: theme.card, borderColor: theme.border, opacity: disabled ? 0.3 : 1 },
          animatedRightStyle,
        ]}
        activeOpacity={0.8}
        onPressIn={() => handlePressIn(scaleRight)}
        onPressOut={() => handlePressOut(scaleRight)}
        onPress={() => !disabled && onSwipe("right")}
        disabled={disabled}
      >
        <Heart
          size={28}
          color={colors.brand.traceGreen}
          strokeWidth={2}
          fill={colors.brand.traceGreen}
        />
      </AnimatedTouchable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingVertical: 8,
  },
  button: {
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  sideButton: {
    width: 64,
    height: 64,
    borderWidth: 2,
    borderColor: colors.dark.border,
  },
  centerButton: {
    width: 72,
    height: 72,
    backgroundColor: "#01ADFF",
  },
});
