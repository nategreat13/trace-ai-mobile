import React, { useMemo } from "react";
import { View, StyleSheet, useWindowDimensions } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  interpolate,
  Easing,
} from "react-native-reanimated";
import { colors } from "../theme/colors";

/**
 * A one-shot confetti burst.
 *
 * Hand-rolled rather than pulled in as a dependency: this is ~60 lines of
 * transforms, and a new native module would have meant a runtimeVersion bump
 * and a fresh binary before any of it could ship over the air.
 *
 * Renders nothing interactive and is `pointerEvents="none"`, so it can be
 * layered over a live screen without stealing a single tap.
 */
const PIECES = 34;
const COLORS = [
  colors.brand.traceRed,
  colors.brand.tracePink,
  colors.brand.traceGreen,
  colors.brand.amber400,
  colors.brand.orange500,
];

interface ConfettiProps {
  /** Vertical origin as a fraction of screen height (0 = top, 1 = bottom). */
  originY?: number;
  /** Rendered only when true; mount it fresh to replay. */
  active: boolean;
}

function Piece({
  index,
  originY,
  width,
  height,
}: {
  index: number;
  originY: number;
  width: number;
  height: number;
}) {
  // Deterministic pseudo-random per piece so the burst is stable across
  // re-renders but still looks scattered.
  const seed = (index * 9301 + 49297) % 233280;
  const rnd = seed / 233280;
  const rnd2 = ((index * 4801 + 9973) % 233280) / 233280;

  const spreadX = (rnd - 0.5) * width * 1.15;
  const rise = 120 + rnd2 * 190;
  const fall = height * (1 - originY) + 160;
  const size = 7 + rnd2 * 7;
  const color = COLORS[index % COLORS.length];
  const duration = 1500 + rnd * 900;

  const t = useSharedValue(0);
  React.useEffect(() => {
    t.value = withDelay(
      index * 12,
      withTiming(1, { duration, easing: Easing.out(Easing.quad) }),
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 0.75, 1], [1, 1, 0]),
    transform: [
      { translateX: interpolate(t.value, [0, 1], [0, spreadX]) },
      // Up, then down — a real arc rather than a straight fall.
      {
        translateY: interpolate(t.value, [0, 0.32, 1], [0, -rise, fall]),
      },
      { rotate: `${interpolate(t.value, [0, 1], [0, 540 + rnd * 540])}deg` },
      { scale: interpolate(t.value, [0, 0.1, 1], [0.4, 1, 0.85]) },
    ],
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          width: size,
          height: size * 1.7,
          borderRadius: 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

export default function Confetti({ active, originY = 0.45 }: ConfettiProps) {
  const { width, height } = useWindowDimensions();
  const pieces = useMemo(() => Array.from({ length: PIECES }, (_, i) => i), []);

  if (!active) return null;

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { alignItems: "center" }]}
    >
      <View style={{ position: "absolute", top: height * originY }}>
        {pieces.map((i) => (
          <Piece
            key={i}
            index={i}
            originY={originY}
            width={width}
            height={height}
          />
        ))}
      </View>
    </View>
  );
}
