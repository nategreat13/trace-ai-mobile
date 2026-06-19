import React, { useEffect } from "react";
import { View, Text, useWindowDimensions, useColorScheme } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { colors } from "../../theme/colors";

interface DashboardTooltipProps {
  visible: boolean;
  tabCount: number;
  dashboardTabIndex: number;
}

// Points an animated bubble + arrow at the Dashboard tab icon after first save.
export default function DashboardTooltip({ visible, tabCount, dashboardTabIndex }: DashboardTooltipProps) {
  const { width } = useWindowDimensions();
  const scheme = useColorScheme();

  const bounce = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      bounce.value = withRepeat(
        withSequence(
          withTiming(6, { duration: 400 }),
          withTiming(0, { duration: 400 })
        ),
        4,
        false
      );
    }
  }, [visible]);

  const animatedArrow = useAnimatedStyle(() => ({
    transform: [{ translateY: bounce.value }],
  }));

  if (!visible) return null;

  // Center of each tab = (tabIndex + 0.5) / tabCount * screenWidth
  const tabCenterX = ((dashboardTabIndex + 0.5) / tabCount) * width;
  const BUBBLE_WIDTH = 196;

  // Keep bubble from clipping left/right edges
  const bubbleLeft = Math.min(
    Math.max(tabCenterX - BUBBLE_WIDTH / 2, 12),
    width - BUBBLE_WIDTH - 12
  );

  // Arrow horizontal position relative to bubble
  const arrowLeft = tabCenterX - bubbleLeft - 8;

  const accent = colors.brand.traceRed;

  return (
    <Animated.View
      entering={FadeIn.delay(400).duration(300)}
      exiting={FadeOut.duration(200)}
      pointerEvents="none"
      style={{
        position: "absolute",
        bottom: 8,
        left: bubbleLeft,
        width: BUBBLE_WIDTH,
        alignItems: "flex-start",
        zIndex: 999,
      }}
    >
      {/* Bubble */}
      <View
        style={{
          backgroundColor: accent,
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 10,
          shadowColor: accent,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 10,
          elevation: 10,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Text style={{ fontSize: 16 }}>🧭</Text>
        <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600", lineHeight: 18, flexShrink: 1 }}>
          Find your saved deals in Dashboard
        </Text>
      </View>

      {/* Downward arrow pointing at tab */}
      <Animated.View style={[{ marginLeft: arrowLeft }, animatedArrow]}>
        <View
          style={{
            width: 0,
            height: 0,
            borderLeftWidth: 8,
            borderRightWidth: 8,
            borderTopWidth: 8,
            borderLeftColor: "transparent",
            borderRightColor: "transparent",
            borderTopColor: accent,
          }}
        />
      </Animated.View>
    </Animated.View>
  );
}
