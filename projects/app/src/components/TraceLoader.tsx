import React, { useEffect, useRef } from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";

const ICON = require("../../assets/android-icon-monochrome.png");

const COLORS = ["#FF655B", "#FD297B", "#00D665", "#8b5cf6", "#F59E0B"];

let loadCount = 0;

export default function TraceLoader({ size = 72 }: { size?: number }) {
  const colorIndex = useRef(loadCount % COLORS.length);

  useEffect(() => {
    loadCount += 1;
  }, []);

  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.65);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 750, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 750, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 750, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.5, { duration: 750, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Animated.View style={animStyle}>
        <Image
          source={ICON}
          style={{ width: size, height: size }}
          contentFit="contain"
          tintColor={COLORS[colorIndex.current]}
        />
      </Animated.View>
    </View>
  );
}
