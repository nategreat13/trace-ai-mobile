import React, { useEffect, useRef } from "react";
import { View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";

const LOGOS = [
  require("../../assets/Bluelogo.png"),
  require("../../assets/TraceLogoLight.png"),
  require("../../assets/TraceLogoDark.png"),
];

let loadCount = 0;

export default function TraceLoader({ size = 72 }: { size?: number }) {
  const logoIndex = useRef(loadCount % LOGOS.length);

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
      <Animated.Image
        source={LOGOS[logoIndex.current]}
        style={[{ width: size, height: size, resizeMode: "contain" }, animStyle]}
      />
    </View>
  );
}
