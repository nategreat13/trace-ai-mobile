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
import { X, Heart } from "lucide-react-native";
import { Deal, SwipeAction } from "../../types/deal";
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
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
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
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
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

        {/* Gradient overlay */}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.2)", "rgba(0,0,0,0.8)"]}
          locations={[0, 0.5, 1]}
          style={styles.gradient}
        />

        {/* ── Swipe indicators ─────────────────────────────────────── */}

        {/* Left indicator (NOPE) */}
        <Animated.View style={[styles.indicatorLeft, leftIndicatorStyle]}>
          <View style={styles.indicatorBox}>
            <X size={56} color={colors.brand.traceRed} strokeWidth={3} />
          </View>
        </Animated.View>

        {/* Right indicator (LIKE) */}
        <Animated.View style={[styles.indicatorRight, rightIndicatorStyle]}>
          <View style={styles.indicatorBox}>
            <Heart
              size={56}
              color={colors.brand.traceGreen}
              fill={colors.brand.traceGreen}
              strokeWidth={3}
            />
          </View>
        </Animated.View>

        {/* Up indicator (SAVE / Super) */}
        <Animated.View style={[styles.indicatorUp, upIndicatorStyle]}>
          <View style={styles.superBadge}>
            <Text style={styles.superText}>SAVE</Text>
          </View>
        </Animated.View>

        {/* ── Bottom content ───────────────────────────────────────── */}
        <View style={styles.content}>
          {/* Header row: destination + price */}
          <View style={styles.headerRow}>
            <Text style={styles.destination} numberOfLines={1}>
              {deal.destination}
            </Text>
            <View style={styles.priceContainer}>
              {deal.original_price > deal.price && (
                <Text style={styles.originalPrice}>
                  ${deal.original_price}
                </Text>
              )}
              <Text style={styles.price}>{formattedPrice}</Text>
              <Text style={[styles.trendArrow, { color: trendColor }]}>
                {trendArrow}
              </Text>
            </View>
          </View>

          {/* Vibe description */}
          <Text style={styles.vibe} numberOfLines={2}>
            {deal.vibe_description}
          </Text>

          {/* Badges row */}
          <View style={styles.badges}>
            {deal.discount_pct > 0 && (
              <LinearGradient
                colors={["#00D665", "#00B84D"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.badge, styles.discountBadge]}
              >
                <Text style={styles.discountBadgeText}>
                  {deal.discount_pct}% off
                </Text>
              </LinearGradient>
            )}
            {!!deal.duration && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{deal.duration}</Text>
              </View>
            )}
            {!!deal.travel_window && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{deal.travel_window}</Text>
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
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#1a1a1a",
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
  },

  // ── Swipe indicators ───────────────────────────────────────────────
  indicatorLeft: {
    position: "absolute",
    top: "40%",
    right: 32,
    zIndex: 10,
  },
  indicatorRight: {
    position: "absolute",
    top: "40%",
    left: 32,
    zIndex: 10,
  },
  indicatorUp: {
    position: "absolute",
    top: "30%",
    alignSelf: "center",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10,
  },
  indicatorBox: {
    width: 96,
    height: 96,
    borderRadius: 24,
    backgroundColor: "#ffffff",
    borderWidth: 5,
    borderColor: "rgba(255,255,255,0.95)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  superBadge: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.95)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  superText: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.dark.primary,
    letterSpacing: 4,
  },

  // ── Bottom content ─────────────────────────────────────────────────
  content: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 12,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 6,
  },
  destination: {
    flex: 1,
    fontSize: 28,
    fontWeight: "800",
    color: "#ffffff",
    marginRight: 12,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  priceContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  originalPrice: {
    fontSize: 14,
    fontWeight: "500",
    color: "rgba(255,255,255,0.5)",
    textDecorationLine: "line-through",
  },
  price: {
    fontSize: 26,
    fontWeight: "800",
    color: "#ffffff",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  trendArrow: {
    fontSize: 16,
    fontWeight: "700",
    marginLeft: 2,
  },
  vibe: {
    fontSize: 14,
    fontWeight: "500",
    color: "rgba(255,255,255,0.8)",
    marginBottom: 12,
    lineHeight: 20,
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255,255,255,0.9)",
  },
  discountBadge: {
    backgroundColor: undefined,
  },
  discountBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#ffffff",
  },
});
