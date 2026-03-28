import React, { useEffect, useCallback } from "react";
import { View, Text, Dimensions, StyleSheet } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
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
  isUndone?: boolean;
}

export default function SwipeCard({
  deal,
  onSwipe,
  isTop,
  onExpand,
  triggerSwipe,
  isSwipeDisabled,
  isUndone = false,
}: SwipeCardProps) {
  // ── Shared values ───────────────────────────────────────────────────
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const isDragging = useSharedValue(false);
  const undoScale = useSharedValue(isUndone ? 0.82 : 1);
  const undoOpacity = useSharedValue(isUndone ? 0 : 1);

  useEffect(() => {
    if (isUndone) {
      undoScale.value = withSpring(1, { damping: 14, stiffness: 260 });
      undoOpacity.value = withTiming(1, { duration: 220 });
    }
  }, [isUndone]);

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

  const tapScale = useSharedValue(1);

  const tapGesture = Gesture.Tap()
    .onBegin(() => {
      tapScale.value = withTiming(0.965, { duration: 80 });
    })
    .onEnd(() => {
      tapScale.value = withSpring(1, { damping: 12, stiffness: 300 });
      runOnJS(handleExpand)();
    })
    .onFinalize(() => {
      tapScale.value = withSpring(1, { damping: 12, stiffness: 300 });
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
      opacity: undoOpacity.value,
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotation}deg` },
        { scale: scale * undoScale.value * tapScale.value },
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

  const upIndicatorStyle = useAnimatedStyle(() => {
    const progress = interpolate(translateY.value, UP_INDICATOR_INPUT, UP_INDICATOR_OUTPUT);
    return {
      opacity: progress,
      transform: [{ scale: interpolate(progress, [0, 1], [0.7, 1.15]) }],
    };
  });

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

        {/* ── Top row: route pill ──────────────────────────────────── */}
        <View style={styles.topRow}>
          {deal.origin && (
            <View style={styles.originPill}>
              <Text style={styles.originText}>✈️  {deal.origin} → {deal.destination_code || deal.destination}</Text>
            </View>
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

        {/* Up swipe → logo fade */}
        <Animated.View style={[styles.indicatorUp, upIndicatorStyle]}>
          <Image source={require("../../../assets/Bluelogo.png")} style={{ width: 72, height: 72, resizeMode: "contain" }} />
        </Animated.View>

        {/* ── Bottom content ───────────────────────────────────────── */}
        <View style={styles.content}>
          {/* Destination */}
          <Text style={styles.destination} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {deal.destination}
          </Text>

          {/* Price row */}
          <View style={styles.priceRow}>
            <View style={styles.priceLeft}>
              <Text style={styles.price}>{formattedPrice}</Text>
              {deal.original_price > deal.price && (
                <Text style={styles.originalPrice}>${deal.original_price}</Text>
              )}
            </View>
            <View style={styles.priceRight}>
              {deal.discount_pct > 0 && (
                <View style={styles.discountBadge}>
                  <Text style={styles.discountBadgeText}>{deal.discount_pct}% OFF</Text>
                </View>
              )}
              <Text style={[styles.trendArrow, { color: trendColor }]}>{trendArrow}</Text>
            </View>
          </View>

          {/* Meta row: airline · duration · month */}
          {(!!deal.airlines || !!deal.duration || !!deal.travel_window) && (
            <View style={styles.metaRow}>
              {!!deal.airlines && (
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>✈️</Text>
                  <Text style={styles.metaValue} numberOfLines={1}>{deal.airlines}</Text>
                </View>
              )}
              {!!deal.airlines && (!!deal.duration || !!deal.travel_window) && (
                <View style={styles.metaDivider} />
              )}
              {!!deal.duration && (
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>⏱</Text>
                  <Text style={styles.metaValue}>{deal.duration}</Text>
                </View>
              )}
              {!!deal.duration && !!deal.travel_window && (
                <View style={styles.metaDivider} />
              )}
              {!!deal.travel_window && (
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>📅</Text>
                  <Text style={styles.metaValue} numberOfLines={1}>{deal.travel_window}</Text>
                </View>
              )}
            </View>
          )}
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
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.3,
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
  destination: {
    fontSize: 34,
    fontWeight: "900",
    color: "#ffffff",
    marginBottom: 6,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
    letterSpacing: -0.5,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  priceLeft: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },
  priceRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  price: {
    fontSize: 28,
    fontWeight: "900",
    color: "#ffffff",
  },
  originalPrice: {
    fontSize: 16,
    fontWeight: "500",
    color: "rgba(255,255,255,0.5)",
    textDecorationLine: "line-through",
  },
  discountBadge: {
    backgroundColor: colors.brand.traceGreen,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  discountBadgeText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#fff",
  },
  trendArrow: {
    fontSize: 18,
    fontWeight: "800",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 0,
  },
  metaItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaLabel: {
    fontSize: 16,
  },
  metaValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "rgba(255,255,255,0.95)",
    flex: 1,
  },
  metaDivider: {
    width: 1,
    height: 16,
    backgroundColor: "rgba(255,255,255,0.25)",
    marginHorizontal: 8,
  },
});
