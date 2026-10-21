import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  useWindowDimensions,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Animated, {
  type SharedValue,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
  withSequence,
  withDelay,
  withRepeat,
  cancelAnimation,
  interpolate,
  Extrapolation,
  Easing,
  runOnJS,
  runOnUI,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { MapPin, Heart, X, Hand, BookmarkCheck } from "lucide-react-native";
import { colors } from "../../theme/colors";
import type { Deal } from "@trace/shared";

/**
 * The first thing a new user does in Trace: swipe real deals from their
 * airport.
 *
 * Every ad ends on "download it free and start swiping", and the old flow
 * made people answer ten screens of questions before they could. This is the
 * real mechanic — not the looping demo that used to sit on screen eight.
 * It's finite (the parent picks the cards) and entirely user-driven: nothing
 * swipes itself once the first card is touched, because what's swiped here
 * is the user's actual choices and gets saved.
 */
const FLING_MS = 280;
const SWIPE_THRESHOLD = 70;
const ENTRANCE_MS = 500;

interface FirstSwipeDeckProps {
  deals: Deal[];
  /** True until the airport's deals have loaded. */
  loading: boolean;
  /** Load failed or came back empty; the parent retries. */
  onRetry?: () => void;
  onSwipe?: (deal: Deal, saved: boolean, index: number) => void;
  /** Fires once, after the last card. */
  onDone: (saved: Deal[]) => void;
}

export default function FirstSwipeDeck({
  deals,
  loading,
  onRetry,
  onSwipe,
  onDone,
}: FirstSwipeDeckProps) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;
  const { width, height } = useWindowDimensions();
  const cardW = Math.min(width - 48, 340);
  // Sized to leave room for the tray, the buttons and the chrome's CTA under
  // it: at 0.44 of the screen the buttons sat on top of "See my feed".
  const cardH = Math.max(220, Math.min(cardW * 1.2, height * 0.33));
  const flingX = cardW + 90;

  const [index, setIndex] = useState(0);
  const [savedCount, setSavedCount] = useState(0);
  const [interacted, setInteracted] = useState(false);
  const savedRef = useRef<Deal[]>([]);
  const doneRef = useRef(false);

  const pos = useSharedValue(0);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const flinging = useSharedValue(false);
  const trayPop = useSharedValue(0);

  const onCommitted = (dir: number, i: number) => {
    const deal = deals[i];
    if (!deal) return;
    const saved = dir > 0;
    Haptics.impactAsync(
      saved ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light,
    ).catch(() => {});
    if (saved) {
      savedRef.current.push(deal);
      setSavedCount((c) => c + 1);
      trayPop.value = withSequence(
        withTiming(1, { duration: 160, easing: Easing.out(Easing.back(2.4)) }),
        withTiming(0, { duration: 420, easing: Easing.out(Easing.cubic) }),
      );
    }
    onSwipe?.(deal, saved, i);
    setIndex(i + 1);
    if (i + 1 >= deals.length && !doneRef.current) {
      doneRef.current = true;
      // A beat for the last card to clear and the tray to pop before moving on.
      setTimeout(() => onDone([...savedRef.current]), 450);
    }
  };

  const fling = (dir: number) => {
    "worklet";
    if (flinging.value) return;
    flinging.value = true;
    const i = Math.round(pos.value);
    dragX.value = withTiming(
      dir * flingX,
      { duration: FLING_MS, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (!finished) {
          flinging.value = false;
          return;
        }
        pos.value = pos.value + 1;
        dragX.value = 0;
        dragY.value = 0;
        flinging.value = false;
        runOnJS(onCommitted)(dir, i);
      },
    );
  };

  const markInteracted = () => {
    if (!interacted) setInteracted(true);
  };

  const pan = Gesture.Pan()
    .onBegin(() => {
      runOnJS(markInteracted)();
    })
    .onUpdate((e) => {
      if (flinging.value) return;
      dragX.value = e.translationX;
      dragY.value = e.translationY * 0.25;
    })
    .onEnd((e) => {
      if (flinging.value) return;
      const dir = dragX.value >= 0 ? 1 : -1;
      if (Math.abs(dragX.value) > SWIPE_THRESHOLD || Math.abs(e.velocityX) > 700) {
        fling(dir);
      } else {
        dragX.value = withSpring(0, { damping: 18, stiffness: 220 });
        dragY.value = withSpring(0, { damping: 18, stiffness: 220 });
      }
    });

  const pressButton = (dir: number) => {
    if (index >= deals.length) return;
    markInteracted();
    runOnUI(fling)(dir);
  };

  // "You can swipe this" hint until the first touch.
  const hint = useSharedValue(0);
  const nudge = useSharedValue(0);
  const showHint = !interacted && !loading && deals.length > 0;
  useEffect(() => {
    if (!showHint) {
      cancelAnimation(hint);
      cancelAnimation(nudge);
      hint.value = 0;
      nudge.value = withTiming(0, { duration: 180 });
      return;
    }
    const loop = (to: number, out: number) =>
      withDelay(
        ENTRANCE_MS + 200,
        withRepeat(
          withSequence(
            withTiming(to, { duration: out, easing: Easing.inOut(Easing.quad) }),
            withTiming(0, { duration: 450, easing: Easing.inOut(Easing.quad) }),
            withTiming(0, { duration: 700 }),
          ),
          -1,
          false,
        ),
      );
    hint.value = loop(1, 1000);
    nudge.value = loop(18, 700);
  }, [showHint]);

  const handStyle = useAnimatedStyle(() => ({
    opacity: interpolate(hint.value, [0, 0.15, 0.8, 1], [0, 1, 1, 0], Extrapolation.CLAMP),
    transform: [{ translateX: interpolate(hint.value, [0, 1], [-30, 70]) }],
  }));
  const trayStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + trayPop.value * 0.16 }],
  }));

  if (loading || deals.length === 0) {
    return (
      <View style={[styles.wrap, { height: cardH + 120, justifyContent: "center" }]}>
        {loading ? (
          <>
            <ActivityIndicator color={colors.brand.traceRed} />
            <Text style={[styles.status, { color: theme.mutedForeground }]}>
              Finding today's best deals…
            </Text>
          </>
        ) : (
          <>
            <Text style={[styles.status, { color: theme.foreground, fontWeight: "700" }]}>
              We couldn't load deals just now
            </Text>
            {!!onRetry && (
              <TouchableOpacity
                onPress={onRetry}
                style={[styles.retry, { backgroundColor: colors.brand.traceRed }]}
              >
                <Text style={styles.retryText}>Try again</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    );
  }

  const remaining = Math.max(deals.length - index, 0);

  return (
    <View style={styles.wrap}>
      <View style={styles.topRow}>
        <Animated.View
          style={[styles.tray, { borderColor: theme.border, backgroundColor: theme.card }]}
        >
          <Animated.View style={trayStyle}>
            <BookmarkCheck
              size={16}
              color={savedCount > 0 ? colors.brand.traceGreen : theme.mutedForeground}
            />
          </Animated.View>
          <Text
            style={[
              styles.trayText,
              { color: savedCount > 0 ? theme.foreground : theme.mutedForeground },
            ]}
          >
            {savedCount === 0
              ? "Nothing saved yet"
              : `${savedCount} trip${savedCount === 1 ? "" : "s"} saved`}
          </Text>
        </Animated.View>
        <Text style={[styles.counter, { color: theme.mutedForeground }]}>
          {Math.min(index + 1, deals.length)} / {deals.length}
        </Text>
      </View>

      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.stage, { height: cardH }]}>
          {deals
            .map((deal, i) => ({ deal, i }))
            .filter(({ i }) => i >= index - 1 && i < index + 3)
            .reverse()
            .map(({ deal, i }) => (
              <DeckCard
                key={deal.id || `${deal.destination}-${i}`}
                index={i}
                pos={pos}
                dragX={dragX}
                dragY={dragY}
                nudge={nudge}
                width={cardW}
                cardH={cardH}
                flingX={flingX}
                deal={deal}
              />
            ))}
          {showHint && (
            <Animated.View pointerEvents="none" style={[styles.hand, handStyle]}>
              <Hand size={24} color="#ffffff" strokeWidth={2.4} />
            </Animated.View>
          )}
        </Animated.View>
      </GestureDetector>

      <Animated.View entering={FadeIn.duration(300)} style={styles.buttons}>
        <TouchableOpacity
          onPress={() => pressButton(-1)}
          disabled={remaining === 0}
          accessibilityLabel="Skip this deal"
          style={[styles.roundBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
        >
          <X size={26} color={colors.brand.rose500} strokeWidth={3} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => pressButton(1)}
          disabled={remaining === 0}
          accessibilityLabel="Save this deal"
          style={[styles.roundBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
        >
          <Heart size={24} color={colors.brand.traceGreen} fill={colors.brand.traceGreen} />
        </TouchableOpacity>
      </Animated.View>
      <Text style={[styles.legend, { color: theme.mutedForeground }]}>
        Swipe right to save · left to skip
      </Text>
    </View>
  );
}

function DeckCard({
  index,
  pos,
  dragX,
  dragY,
  nudge,
  width,
  cardH,
  flingX,
  deal,
}: {
  index: number;
  pos: SharedValue<number>;
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
  nudge: SharedValue<number>;
  width: number;
  cardH: number;
  flingX: number;
  deal: Deal;
}) {
  const style = useAnimatedStyle(() => {
    const s = index - pos.value;
    if (s < 0) return { opacity: 0, transform: [{ translateX: 0 }] };
    if (s === 0) {
      const x = dragX.value + nudge.value;
      const p = Math.min(Math.abs(dragX.value) / flingX, 1);
      return {
        opacity: interpolate(p, [0.7, 1], [1, 0], Extrapolation.CLAMP),
        transform: [
          { translateX: x },
          { translateY: dragY.value },
          { rotate: `${(x / flingX) * 0.16}rad` },
          { scale: 1 },
        ],
      };
    }
    const lift = s === 1 ? Math.min(Math.abs(dragX.value) / flingX, 1) : 0;
    const base = interpolate(Math.min(s, 3), [1, 2, 3], [0.945, 0.9, 0.86]);
    const ty = interpolate(Math.min(s, 3), [1, 2, 3], [12, 23, 33]);
    return {
      opacity: s >= 3 ? 0 : 1,
      transform: [
        { translateX: 0 },
        { translateY: ty * (1 - lift) },
        { rotate: "0rad" },
        { scale: base + (1 - base) * lift },
      ],
    };
  });
  const saveStyle = useAnimatedStyle(() => ({
    opacity:
      index - pos.value === 0 && dragX.value > 0
        ? interpolate(dragX.value, [15, 90], [0, 1], Extrapolation.CLAMP)
        : 0,
  }));
  const passStyle = useAnimatedStyle(() => ({
    opacity:
      index - pos.value === 0 && dragX.value < 0
        ? interpolate(-dragX.value, [15, 90], [0, 1], Extrapolation.CLAMP)
        : 0,
  }));

  return (
    <Animated.View style={[styles.card, { width, height: cardH }, style]}>
      {!!deal.image_url && (
        <Image
          source={{ uri: deal.image_url }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={220}
        />
      )}
      <LinearGradient
        colors={["rgba(0,0,0,0.04)", "rgba(0,0,0,0.82)"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.faceBody}>
        <View style={styles.destRow}>
          <MapPin size={15} color="#ffffff" />
          <Text style={styles.destText} numberOfLines={1}>
            {deal.destination}
          </Text>
        </View>
        <View style={styles.priceRow}>
          <Text style={styles.priceText}>${Math.round(deal.price)}</Text>
          {deal.original_price > deal.price && (
            <Text style={styles.wasText}>${Math.round(deal.original_price)}</Text>
          )}
          {deal.discount_pct > 0 && (
            <View style={styles.offPill}>
              <Text style={styles.offText}>{Math.round(deal.discount_pct)}% off</Text>
            </View>
          )}
        </View>
        {!!deal.travel_window && (
          <Text style={styles.windowText} numberOfLines={1}>
            {deal.travel_window}
          </Text>
        )}
      </View>
      <Animated.View style={[styles.badge, styles.badgeSave, saveStyle]}>
        <Text style={styles.badgeText}>SAVED</Text>
      </Animated.View>
      <Animated.View style={[styles.badge, styles.badgePass, passStyle]}>
        <Text style={styles.badgeText}>SKIP</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 14 },
  topRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tray: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  trayText: { fontSize: 13.5, fontWeight: "700" },
  counter: { fontSize: 14, fontWeight: "700" },
  stage: { width: "100%", alignItems: "center", justifyContent: "center" },
  card: {
    position: "absolute",
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "#00000010",
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  faceBody: { position: "absolute", left: 18, right: 18, bottom: 18, gap: 7 },
  destRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  destText: { color: "#fff", fontSize: 26, fontWeight: "800", flex: 1, letterSpacing: -0.4 },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  priceText: { color: "#fff", fontSize: 32, fontWeight: "800", letterSpacing: -0.8 },
  wasText: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 17,
    fontWeight: "700",
    textDecorationLine: "line-through",
  },
  offPill: {
    backgroundColor: colors.brand.traceGreen,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  offText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  windowText: { color: "rgba(255,255,255,0.85)", fontSize: 13.5, fontWeight: "600" },
  badge: {
    position: "absolute",
    top: 20,
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 2.5,
    borderColor: "#fff",
  },
  badgeSave: { right: 18, backgroundColor: colors.brand.traceGreen },
  badgePass: { left: 18, backgroundColor: colors.brand.rose500 },
  badgeText: { color: "#fff", fontSize: 13, fontWeight: "900", letterSpacing: 1.2 },
  hand: {
    position: "absolute",
    top: "50%",
    left: "44%",
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.9)",
  },
  buttons: { flexDirection: "row", gap: 40, marginTop: 2 },
  roundBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  legend: { fontSize: 13, fontWeight: "600" },
  status: { fontSize: 15, marginTop: 12, textAlign: "center" },
  retry: { marginTop: 16, borderRadius: 12, paddingHorizontal: 22, paddingVertical: 11 },
  retryText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
