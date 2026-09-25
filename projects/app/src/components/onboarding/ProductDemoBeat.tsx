import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Animated, {
  type SharedValue,
  FadeIn,
  FadeOut,
  FadeInDown,
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
import { MapPin, Heart, X, Hand, Bell, BookmarkCheck } from "lucide-react-native";
import { colors } from "../../theme/colors";
import { marqueeRank } from "../../lib/marquee";
import { applyPreviewPrice } from "../../lib/previewPrices";
import { SHOWCASE_DEALS, toDeal } from "../../lib/showcaseDeals";
import type { Deal } from "@trace/shared";

/**
 * The product, demonstrated by having the user do it.
 *
 * This replaces a miniature: the deck used to sit inside a drawn phone frame
 * at about a third of real size, next to a map. Two problems with that. A
 * phone drawn inside a phone is a *screenshot of* a product rather than the
 * product, and it showed only the first move of the loop — swiping — with no
 * sign of why swiping matters.
 *
 * So the cards are now full size and the beat walks the whole loop in three
 * acts, ending on the payoff:
 *
 *   1. SWIPE — a real card at real size, driven by a real gesture.
 *   2. SAVED — the card is caught by a tray that counts up.
 *   3. ALERT — a push notification for a saved city drops in from the top.
 *
 * Act 3 is the point. Everything before it is a card game; the notification
 * is the reason anyone pays. The user has to have swiped the card themselves
 * for the alert to mean anything, which is why the demo is interactive rather
 * than a video.
 */
const SWIPES = 3;
const DECK = SWIPES + 1;
/** How long the deck waits for a touch before swiping a card itself. */
const IDLE_MS = 2600;
const ENTRANCE_MS = 700;
const FLING_MS = 300;
/** Drag distance that commits a swipe; a fast flick commits sooner. */
const SWIPE_THRESHOLD = 70;
/** Beat between the last swipe and the notification arriving. */
const ALERT_DELAY_MS = 700;

type Act = "swipe" | "alert";

interface ProductDemoBeatProps {
  deals: Deal[];
}

export default function ProductDemoBeat({ deals }: ProductDemoBeatProps) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;
  const { width } = useWindowDimensions();
  const cardW = Math.min(width - 48, 340);
  const flingX = cardW + 90;

  /**
   * Their real deals where the feed has them, the shared showcase set as the
   * fallback. Either way the cards carry the same prices as the landing deck
   * and the alert stream — see lib/showcaseDeals.ts.
   */
  const cards = useMemo(() => {
    const byDest = new Map<string, Deal>();
    for (const raw of deals) {
      const d = applyPreviewPrice(raw);
      if (!d.destination || !d.image_url) continue;
      const prev = byDest.get(d.destination);
      if (!prev || (d.discount_pct || 0) > (prev.discount_pct || 0)) {
        byDest.set(d.destination, d);
      }
    }
    const real = [...byDest.values()].sort((a, b) => {
      const ra = marqueeRank(a.destination);
      const rb = marqueeRank(b.destination);
      if (ra !== rb) return ra - rb;
      return (b.discount_pct || 0) - (a.discount_pct || 0);
    });
    const list = real.length >= DECK ? real : SHOWCASE_DEALS.map((d) => toDeal(d));
    return list.slice(0, DECK);
  }, [deals]);

  const [act, setAct] = useState<Act>("swipe");
  const [savedCount, setSavedCount] = useState(0);
  const [alertDeal, setAlertDeal] = useState<Deal | null>(null);
  const [interacted, setInteracted] = useState(false);

  const pos = useSharedValue(0);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const flinging = useSharedValue(false);
  const trayPop = useSharedValue(0);

  const stepRef = useRef(0);
  const lastInteractRef = useRef(0);
  const savedRef = useRef<Deal[]>([]);

  const totalSwipes = Math.min(SWIPES, cards.length);

  const onCommitted = (dir: number, index: number) => {
    Haptics.impactAsync(
      dir > 0 ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light,
    ).catch(() => {});

    if (dir > 0) {
      const saved = cards[index];
      if (saved) savedRef.current.push(saved);
      setSavedCount((c) => c + 1);
      trayPop.value = withSequence(
        withTiming(1, { duration: 160, easing: Easing.out(Easing.back(2.4)) }),
        withTiming(0, { duration: 420, easing: Easing.out(Easing.cubic) }),
      );
    }

    stepRef.current += 1;
    lastInteractRef.current = Date.now();

    if (stepRef.current >= totalSwipes) {
      // The alert is for something they actually kept. If they passed on
      // everything, fall back to the best card in the deck — the beat still
      // has to land, and "we'll watch this one" is true either way.
      const subject = savedRef.current[0] ?? cards[0];
      setTimeout(() => {
        setAlertDeal(subject);
        setAct("alert");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
          () => {},
        );
      }, ALERT_DELAY_MS);
    }
  };

  const noteInteraction = () => {
    lastInteractRef.current = Date.now();
    if (!interacted) setInteracted(true);
  };

  const fling = (dir: number) => {
    "worklet";
    if (flinging.value) return;
    flinging.value = true;
    const index = Math.round(pos.value);
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
        runOnJS(onCommitted)(dir, index);
      },
    );
  };
  const flingRef = useRef(fling);
  flingRef.current = fling;

  const pan = Gesture.Pan()
    .onBegin(() => {
      runOnJS(noteInteraction)();
    })
    .onUpdate((e) => {
      if (flinging.value) return;
      dragX.value = e.translationX;
      dragY.value = e.translationY * 0.25;
    })
    .onEnd((e) => {
      if (flinging.value) return;
      const dir = dragX.value >= 0 ? 1 : -1;
      const committed =
        Math.abs(dragX.value) > SWIPE_THRESHOLD || Math.abs(e.velocityX) > 700;
      if (committed) fling(dir);
      else {
        dragX.value = withSpring(0, { damping: 18, stiffness: 220 });
        dragY.value = withSpring(0, { damping: 18, stiffness: 220 });
      }
    });

  // Idle fallback so a passive viewer still sees the loop.
  useEffect(() => {
    if (act !== "swipe" || cards.length === 0) return;
    lastInteractRef.current = Date.now() + ENTRANCE_MS;
    const id = setInterval(() => {
      if (stepRef.current >= totalSwipes) return;
      if (Date.now() - lastInteractRef.current < IDLE_MS) return;
      lastInteractRef.current = Date.now();
      // Bias toward saving: the loop only reaches its payoff via a save.
      const dir = stepRef.current === 1 ? -1 : 1;
      runOnUI(flingRef.current)(dir);
    }, 200);
    return () => clearInterval(id);
  }, [act, cards.length, totalSwipes]);

  // "You can swipe this" hint, until the first real touch.
  const hint = useSharedValue(0);
  const nudge = useSharedValue(0);
  useEffect(() => {
    if (act !== "swipe" || interacted) {
      cancelAnimation(hint);
      cancelAnimation(nudge);
      hint.value = 0;
      nudge.value = withTiming(0, { duration: 180 });
      return;
    }
    hint.value = withDelay(
      ENTRANCE_MS + 200,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1150, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: 0 }),
          withTiming(0, { duration: 600 }),
        ),
        -1,
        false,
      ),
    );
    nudge.value = withDelay(
      ENTRANCE_MS + 200,
      withRepeat(
        withSequence(
          withTiming(16, { duration: 700, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: 450, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: 600 }),
        ),
        -1,
        false,
      ),
    );
  }, [act, interacted]);

  const handStyle = useAnimatedStyle(() => ({
    opacity: interpolate(hint.value, [0, 0.12, 0.78, 1], [0, 1, 1, 0], Extrapolation.CLAMP),
    transform: [
      { translateX: interpolate(hint.value, [0, 1], [-30, 78]) },
      { translateY: interpolate(hint.value, [0, 0.5, 1], [0, -7, 0]) },
      { rotate: `${interpolate(hint.value, [0, 1], [-0.12, 0.12])}rad` },
    ],
  }));

  const trayStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + trayPop.value * 0.16 }],
  }));

  const renderFace = (deal: Deal) => (
    <>
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
          {!!deal.original_price && deal.original_price > deal.price && (
            <Text style={styles.wasText}>${Math.round(deal.original_price)}</Text>
          )}
          {deal.discount_pct > 0 && (
            <View style={styles.offPill}>
              <Text style={styles.offText}>{Math.round(deal.discount_pct)}% off</Text>
            </View>
          )}
        </View>
      </View>
    </>
  );

  return (
    <View style={styles.wrap}>
      {/* Saved tray — the thing swipes accumulate into. */}
      <Animated.View
        entering={FadeIn.duration(360)}
        style={[styles.tray, { borderColor: theme.border, backgroundColor: theme.card }]}
      >
        <Animated.View style={trayStyle}>
          <BookmarkCheck
            size={17}
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

      <View style={[styles.stage, { height: cardW * 1.32 }]}>
        {act === "swipe" ? (
          <GestureDetector gesture={pan}>
            <Animated.View
              key="deck"
              entering={FadeIn.duration(320)}
              exiting={FadeOut.duration(260)}
              style={StyleSheet.absoluteFill}
            >
              {/* Back-to-front so card 0 is the last child and sits on top —
                  correct stacking from render order, no animated zIndex. */}
              {cards
                .map((deal, i) => ({ deal, i }))
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
                    flingX={flingX}
                  >
                    {renderFace(deal)}
                  </DeckCard>
                ))}

              {!interacted && (
                <Animated.View pointerEvents="none" style={[styles.hand, handStyle]}>
                  <Hand size={24} color="#ffffff" strokeWidth={2.4} />
                </Animated.View>
              )}
            </Animated.View>
          </GestureDetector>
        ) : (
          /* Act 3 — the payoff. A real-looking notification for a city they
             kept, arriving the way it would on their lock screen. */
          <Animated.View
            key="alert"
            entering={FadeIn.duration(320)}
            style={[StyleSheet.absoluteFill, styles.alertStage]}
          >
            {!!alertDeal && (
              <>
                <Animated.View
                  entering={FadeInDown.duration(460).springify().damping(17)}
                  style={[styles.notif, { backgroundColor: theme.card, borderColor: theme.border }]}
                >
                  <View style={styles.notifIcon}>
                    <Bell size={15} color="#ffffff" strokeWidth={2.6} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.notifApp, { color: theme.mutedForeground }]}>
                      TRACE · now
                    </Text>
                    <Text style={[styles.notifTitle, { color: theme.foreground }]}>
                      {alertDeal.destination} just dropped to $
                      {Math.round(alertDeal.price)}
                    </Text>
                    {!!alertDeal.original_price && alertDeal.original_price > alertDeal.price && (
                      <Text style={[styles.notifSub, { color: theme.mutedForeground }]}>
                        Was ${Math.round(alertDeal.original_price)} — book before it's gone
                      </Text>
                    )}
                  </View>
                </Animated.View>

                <Animated.Text
                  entering={FadeIn.duration(400).delay(520)}
                  style={[styles.payoff, { color: theme.foreground }]}
                >
                  That's the whole app.
                </Animated.Text>
                <Animated.Text
                  entering={FadeIn.duration(400).delay(680)}
                  style={[styles.payoffSub, { color: theme.mutedForeground }]}
                >
                  You swipe what you like. We watch those prices around the
                  clock. The moment one drops, you hear about it first.
                </Animated.Text>
              </>
            )}
          </Animated.View>
        )}
      </View>

      {act === "swipe" && (
        <Animated.View entering={FadeIn.duration(300)} style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendIcon, { backgroundColor: colors.brand.rose500 + "1A" }]}>
              <X size={15} color={colors.brand.rose500} strokeWidth={3} />
            </View>
            <Text style={[styles.legendText, { color: theme.mutedForeground }]}>
              Swipe left to skip
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendIcon, { backgroundColor: colors.brand.traceGreen + "1A" }]}>
              <Heart size={14} color={colors.brand.traceGreen} fill={colors.brand.traceGreen} />
            </View>
            <Text style={[styles.legendText, { color: theme.mutedForeground }]}>
              Right to save it
            </Text>
          </View>
        </Animated.View>
      )}
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
  flingX,
  children,
}: {
  index: number;
  pos: SharedValue<number>;
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
  nudge: SharedValue<number>;
  width: number;
  flingX: number;
  children: React.ReactNode;
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
    <Animated.View style={[styles.card, { width, height: width * 1.32 }, style]}>
      {children}
      <Animated.View style={[styles.badge, styles.badgeSave, saveStyle]}>
        <Text style={styles.badgeText}>SAVED</Text>
      </Animated.View>
      <Animated.View style={[styles.badge, styles.badgePass, passStyle]}>
        <Text style={styles.badgeText}>PASSED</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 14 },
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
  destText: { color: "#fff", fontSize: 24, fontWeight: "800", flex: 1, letterSpacing: -0.4 },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  priceText: { color: "#fff", fontSize: 30, fontWeight: "800", letterSpacing: -0.8 },
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
    top: "52%",
    left: "46%",
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.9)",
  },
  legend: { flexDirection: "row", gap: 22, flexWrap: "wrap", justifyContent: "center" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 7 },
  legendIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  legendText: { fontSize: 13.5, fontWeight: "600" },
  alertStage: { alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  notif: {
    flexDirection: "row",
    gap: 11,
    alignItems: "flex-start",
    width: "100%",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 13,
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  notifIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: colors.brand.traceRed,
    alignItems: "center",
    justifyContent: "center",
  },
  notifApp: { fontSize: 10.5, fontWeight: "800", letterSpacing: 0.7 },
  notifTitle: { fontSize: 15.5, fontWeight: "700", marginTop: 3 },
  notifSub: { fontSize: 13, marginTop: 2 },
  payoff: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
    marginTop: 30,
    textAlign: "center",
  },
  payoffSub: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 8,
  },
});
