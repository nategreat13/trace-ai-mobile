import React, { useEffect, useCallback } from "react";
import { View, Text, Dimensions, StyleSheet } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  runOnJS,
} from "react-native-reanimated";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Deal, SwipeAction } from "@trace/shared";
import { colors } from "../../theme/colors";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ── Thresholds ──────────────────────────────────────────────────────────
const SWIPE_X_THRESHOLD = 80;
const SWIPE_Y_THRESHOLD = 80;
const VELOCITY_THRESHOLD = 300;
const EXIT_X = 500;
const EXIT_Y = -800;
const EXIT_X_DURATION = 300;
const EXIT_Y_DURATION = 400;

// ── Indicator interpolation anchors ─────────────────────────────────────
const LEFT_INDICATOR_INPUT = [-150, -50, 0];
const LEFT_INDICATOR_OUTPUT = [1, 0, 0];
const RIGHT_INDICATOR_INPUT = [0, 50, 150];
const RIGHT_INDICATOR_OUTPUT = [0, 0, 1];
const UP_INDICATOR_INPUT = [-150, -60, 0];
const UP_INDICATOR_OUTPUT = [1, 0, 0];

// ── Rotation / scale ────────────────────────────────────────────────────
const ROTATION_INPUT = [-300, 0, 300];
const ROTATION_OUTPUT = [-30, 0, 30];
const SCALE_INPUT = [-300, 0, 300];
const SCALE_OUTPUT = [0.95, 1, 0.95];

// ── Props ───────────────────────────────────────────────────────────────
interface SwipeCardProps {
  deal: Deal;
  onSwipe: (action: SwipeAction) => void;
  isTop: boolean;
  onExpand: () => void;
  triggerSwipe: "left" | "right" | "super" | null;
  isSwipeDisabled: boolean;
}

export default function SwipeCard({
  deal,
  onSwipe,
  isTop,
  onExpand,
  triggerSwipe,
  isSwipeDisabled,
}: SwipeCardProps) {
  // ── Shared values ───────────────────────────────────────────────────
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const isDragging = useSharedValue(false);

  // ── Callbacks (must be plain JS for runOnJS) ────────────────────────
  const handleSwipe = useCallback(
    (action: SwipeAction) => {
      onSwipe(action);
    },
    [onSwipe],
  );

  const handleExpand = useCallback(() => {
    onExpand();
  }, [onExpand]);

  // ── Programmatic swipe via triggerSwipe prop ────────────────────────
  useEffect(() => {
    if (!triggerSwipe || !isTop) return;

    if (triggerSwipe === "left") {
      translateX.value = withTiming(-EXIT_X, { duration: EXIT_X_DURATION }, () => {
        runOnJS(handleSwipe)("left");
      });
    } else if (triggerSwipe === "right") {
      translateX.value = withTiming(EXIT_X, { duration: EXIT_X_DURATION }, () => {
        runOnJS(handleSwipe)("right");
      });
    } else if (triggerSwipe === "super") {
      translateY.value = withTiming(EXIT_Y, { duration: EXIT_Y_DURATION }, () => {
        runOnJS(handleSwipe)("super");
      });
    }
  }, [triggerSwipe, isTop, translateX, translateY, handleSwipe]);

  // ── Gesture ─────────────────────────────────────────────────────────
  const panGesture = Gesture.Pan()
    .enabled(isTop)
    .onStart(() => {
      isDragging.value = true;
    })
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY;
    })
    .onEnd((event) => {
      isDragging.value = false;
      const { translationX, translationY, velocityX, velocityY } = event;

      // ── Disabled swipe: record intent but snap back ──────────────
      if (isSwipeDisabled) {
        if (
          translationX < -SWIPE_X_THRESHOLD ||
          velocityX < -VELOCITY_THRESHOLD
        ) {
          runOnJS(handleSwipe)("left");
        } else if (
          translationX > SWIPE_X_THRESHOLD ||
          velocityX > VELOCITY_THRESHOLD
        ) {
          runOnJS(handleSwipe)("right");
        } else if (
          translationY < -SWIPE_Y_THRESHOLD ||
          velocityY < -VELOCITY_THRESHOLD
        ) {
          runOnJS(handleSwipe)("super");
        }
        translateX.value = withTiming(0, { duration: 200 });
        translateY.value = withTiming(0, { duration: 200 });
        return;
      }

      // ── Left swipe ──────────────────────────────────────────────
      if (
        translationX < -SWIPE_X_THRESHOLD ||
        velocityX < -VELOCITY_THRESHOLD
      ) {
        translateX.value = withTiming(
          -EXIT_X,
          { duration: EXIT_X_DURATION },
          () => {
            runOnJS(handleSwipe)("left");
          },
        );
        return;
      }

      // ── Right swipe ─────────────────────────────────────────────
      if (
        translationX > SWIPE_X_THRESHOLD ||
        velocityX > VELOCITY_THRESHOLD
      ) {
        translateX.value = withTiming(
          EXIT_X,
          { duration: EXIT_X_DURATION },
          () => {
            runOnJS(handleSwipe)("right");
          },
        );
        return;
      }

      // ── Super swipe (up) ────────────────────────────────────────
      if (
        translationY < -SWIPE_Y_THRESHOLD ||
        velocityY < -VELOCITY_THRESHOLD
      ) {
        translateY.value = withTiming(
          EXIT_Y,
          { duration: EXIT_Y_DURATION },
          () => {
            runOnJS(handleSwipe)("super");
          },
        );
        return;
      }

      // ── Snap back ──────────────────────────────────────────────
      translateX.value = withTiming(0, { duration: 200 });
      translateY.value = withTiming(0, { duration: 200 });
    });

  const tapGesture = Gesture.Tap().onEnd(() => {
    runOnJS(handleExpand)();
  });

  const composedGesture = Gesture.Race(panGesture, tapGesture);

  // ── Animated styles ─────────────────────────────────────────────────
  const cardAnimatedStyle = useAnimatedStyle(() => {
    const rotation = interpolate(
      translateX.value,
      ROTATION_INPUT,
      ROTATION_OUTPUT,
    );
    const scale = interpolate(
      translateX.value,
      SCALE_INPUT,
      SCALE_OUTPUT,
    );

    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotation}deg` },
        { scale },
      ],
    };
  });

  const leftIndicatorStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      LEFT_INDICATOR_INPUT,
      LEFT_INDICATOR_OUTPUT,
    ),
  }));

  const rightIndicatorStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      RIGHT_INDICATOR_INPUT,
      RIGHT_INDICATOR_OUTPUT,
    ),
  }));

  const upIndicatorStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateY.value,
      UP_INDICATOR_INPUT,
      UP_INDICATOR_OUTPUT,
    ),
  }));

  // ── Derived display values ──────────────────────────────────────────
  const formattedPrice = `$${deal.price}`;
  const trendArrow =
    deal.price_trend === "dropping"
      ? "↓"
      : deal.price_trend === "rising"
        ? "↑"
        : "→";
  const trendColor =
    deal.price_trend === "dropping"
      ? colors.brand.traceGreen
      : deal.price_trend === "rising"
        ? colors.brand.traceRed
        : colors.brand.amber500;

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View style={[styles.card, cardAnimatedStyle]}>
        {/* Background image */}
        <Image
          source={{ uri: deal.image_url }}
          style={styles.image}
          contentFit="cover"
          transition={200}
        />

        {/* Gradient overlay — heavy at bottom like Tinder */}
        <LinearGradient
          colors={["rgba(0,0,0,0.0)", "rgba(0,0,0,0.0)", "rgba(0,0,0,0.55)", "rgba(0,0,0,0.92)"]}
          locations={[0, 0.45, 0.72, 1]}
          style={styles.gradient}
        />

        {/* ── Top row: origin pill + discount badge ────────────────── */}
        <View style={styles.topRow}>
          {deal.origin && (
            <View style={styles.originPill}>
              <Text style={styles.originText}>✈️  {deal.origin} → {deal.destination_code || deal.destination}</Text>
            </View>
          )}
          {deal.discount_pct > 0 && (
            <LinearGradient
              colors={["#00D665", "#00B84D"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.discountPill}
            >
              <Text style={styles.discountPillText}>{deal.discount_pct}% OFF</Text>
            </LinearGradient>
          )}
        </View>

        {/* ── Swipe indicators — Tinder stamp style ────────────────── */}

        {/* Left swipe → NOPE stamp (top-right, tilted) */}
        <Animated.View style={[styles.indicatorLeft, leftIndicatorStyle]}>
          <View style={styles.nopeStamp}>
            <Text style={styles.nopeText}>NOPE</Text>
          </View>
        </Animated.View>

        {/* Right swipe → LIKE stamp (top-left, tilted) */}
        <Animated.View style={[styles.indicatorRight, rightIndicatorStyle]}>
          <View style={styles.likeStamp}>
            <Text style={styles.likeText}>LIKE</Text>
          </View>
        </Animated.View>

        {/* Up swipe → SAVE stamp */}
        <Animated.View style={[styles.indicatorUp, upIndicatorStyle]}>
          <View style={styles.saveStamp}>
            <Image source={require("../../../assets/Bluelogo.png")} style={{ width: 28, height: 28, resizeMode: "contain", marginBottom: 4 }} />
            <Text style={styles.saveText}>SAVE</Text>
          </View>
        </Animated.View>

        {/* ── Bottom content ───────────────────────────────────────── */}
        <View style={styles.content}>
          {/* Destination + price */}
          <View style={styles.headerRow}>
            <Text style={styles.destination} numberOfLines={1}>
              {deal.destination}
            </Text>
            <View style={styles.pricePill}>
              {deal.original_price > deal.price && (
                <Text style={styles.originalPrice}>${deal.original_price}</Text>
              )}
              <Text style={styles.price}>{formattedPrice}</Text>
              <Text style={[styles.trendArrow, { color: trendColor }]}>{trendArrow}</Text>
            </View>
          </View>

          {/* Vibe description */}
          <Text style={styles.vibe} numberOfLines={2}>
            {deal.vibe_description}
          </Text>

          {/* Info chips */}
          <View style={styles.chips}>
            {!!deal.airlines && (
              <View style={styles.chip}>
                <Text style={styles.chipText}>{deal.airlines}</Text>
              </View>
            )}
            {!!deal.duration && (
              <View style={styles.chip}>
                <Text style={styles.chipText}>⏱ {deal.duration}</Text>
              </View>
            )}
            {!!deal.travel_window && (
              <View style={styles.chip}>
                <Text style={styles.chipText}>📅 {deal.travel_window}</Text>
              </View>
            )}
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  card: {
    position: "absolute",
    top: 0,
    left: 4,
    right: 4,
    bottom: 0,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#1a1a1a",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
  },

  // ── Top row ────────────────────────────────────────────────────────
  topRow: {
    position: "absolute",
    top: 16,
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 10,
  },
  originPill: {
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  originText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.3,
  },
  discountPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  discountPillText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#fff",
  },

  // ── Swipe stamp indicators ─────────────────────────────────────────
  indicatorLeft: {
    position: "absolute",
    top: 52,
    right: 24,
    zIndex: 10,
    transform: [{ rotate: "15deg" }],
  },
  indicatorRight: {
    position: "absolute",
    top: 52,
    left: 24,
    zIndex: 10,
    transform: [{ rotate: "-15deg" }],
  },
  indicatorUp: {
    position: "absolute",
    top: "28%",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10,
  },
  nopeStamp: {
    borderWidth: 4,
    borderColor: colors.brand.traceRed,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  nopeText: {
    fontSize: 28,
    fontWeight: "900",
    color: colors.brand.traceRed,
    letterSpacing: 3,
  },
  likeStamp: {
    borderWidth: 4,
    borderColor: colors.brand.traceGreen,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  likeText: {
    fontSize: 28,
    fontWeight: "900",
    color: colors.brand.traceGreen,
    letterSpacing: 3,
  },
  saveStamp: {
    borderWidth: 4,
    borderColor: colors.brand.amber500,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "rgba(0,0,0,0.15)",
    alignItems: "center",
  },
  saveText: {
    fontSize: 26,
    fontWeight: "900",
    color: colors.brand.amber500,
    letterSpacing: 3,
  },

  // ── Bottom content ─────────────────────────────────────────────────
  content: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 26,
    paddingTop: 16,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 6,
  },
  destination: {
    flex: 1,
    fontSize: 32,
    fontWeight: "900",
    color: "#ffffff",
    marginRight: 12,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  pricePill: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 3,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  originalPrice: {
    fontSize: 12,
    fontWeight: "500",
    color: "rgba(255,255,255,0.5)",
    textDecorationLine: "line-through",
  },
  price: {
    fontSize: 22,
    fontWeight: "900",
    color: "#ffffff",
  },
  trendArrow: {
    fontSize: 14,
    fontWeight: "700",
  },
  vibe: {
    fontSize: 14,
    fontWeight: "500",
    color: "rgba(255,255,255,0.82)",
    marginBottom: 12,
    lineHeight: 20,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  chipText: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255,255,255,0.9)",
  },
});
