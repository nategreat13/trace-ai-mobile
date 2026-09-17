import React, { useEffect, useState, useMemo, useRef } from "react";
import { View, Text, StyleSheet, useColorScheme } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Animated, {
  type SharedValue,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
  withSequence,
  interpolate,
  Extrapolation,
  Easing,
  runOnJS,
  runOnUI,
  withRepeat,
  withDelay,
  cancelAnimation,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { MapPin, Heart, X, Lock, Hand } from "lucide-react-native";
import { colors } from "../../theme/colors";
import DealsMap, { type MapDeal } from "../explore/DealsMap";
import { marqueeRank } from "../../lib/marquee";
import type { Deal } from "@trace/shared";

/**
 * A self-playing miniature of the app, built from the user's own deals.
 *
 * Every other beat *describes* the product; this one shows it. Two choices
 * worth knowing about:
 *
 *  1. **The deck is really swipeable.** A pan gesture drives the top card,
 *     and a real swipe commits it. If the user doesn't touch it for IDLE_MS
 *     the deck swipes itself, so a passive viewer still sees the loop — but
 *     a curious one gets to *do* the thing rather than watch it, which is
 *     what people remember. The phone frame stays because it frames the
 *     product; it just isn't a no-touch zone any more.
 *  2. **Nothing resets mid-loop.** `pos` is the committed top-card index
 *     (an integer, set directly) and `dragX`/`dragY` are the live offset of
 *     whatever card is on top. A fling animates dragX out, then — in the
 *     same UI-thread callback — bumps `pos` and zeroes the drag, so the next
 *     card is already at rest the frame it becomes top. No content swap, no
 *     React re-render while the deck runs. The one rewind (pos back to 0)
 *     happens while the map phase covers the screen.
 */
/**
 * Three swipes is the whole demonstration — after that it's repetition, and
 * the beat has a map phase to get to. The deck mounts exactly SWIPES + 1
 * cards: one behind the last one thrown, so the stack never looks empty, and
 * not a single card the user will never see.
 */
const SWIPES = 3;
const DECK = SWIPES + 1;
/**
 * Time from one card leaving to the next. The fling itself is FLING_MS of
 * that; the remainder is the card sitting still, which is the part that
 * matters — the viewer needs long enough to actually read the destination and
 * the price before it's whipped away, or the demo shows motion instead of
 * product.
 */
/** How long the deck waits for a touch before swiping a card itself. */
const IDLE_MS = 2600;
/** Grace after the phone swoops in before the idle clock starts. */
const ENTRANCE_MS = 900;
const FLING_MS = 300;
/** Drag distance that commits a swipe; a fast flick commits sooner. */
const SWIPE_THRESHOLD = 70;
/** Cards render ~188pt wide inside a ~212pt screen; 250 clears the bezel. */
const FLING_X = 250;
const MAP_MS = 7600;

/**
 * Illustrative stops for the map preview.
 *
 * These are ONBOARDING-ONLY mock pins, not bookable fares — they exist so the
 * map demo lands on places everyone recognises at prices that make the point,
 * rather than on whichever short domestic hop happens to be cheapest today.
 * Both cities resolve in `destinationCoords`, so the camera flies to a real
 * location and the pin sits where it should.
 *
 * Trevor's call, and worth knowing the tradeoff: the swipe cards beside this
 * use the user's genuine feed, so a sharp-eyed user could notice these two
 * prices don't appear in the app. Swapping to real Paris/Tokyo fares (just
 * force-unlocked) is a two-line change if that ever becomes a concern.
 */
const PREVIEW_STOPS: { destination: string; price: number; discountPct: number }[] =
  [
    { destination: "Paris", price: 248, discountPct: 64 },
    { destination: "Tokyo", price: 331, discountPct: 61 },
  ];

/** Minimal Deal shaped just enough for a map pin. */
function makePreviewDeal(
  destination: string,
  price: number,
  discountPct: number,
): Deal {
  return {
    id: `preview-${destination.toLowerCase()}`,
    destination,
    destination_code: "",
    origin: "",
    price,
    original_price: Math.round(price / (1 - discountPct / 100)),
    discount_pct: discountPct,
    domestic_or_international: "International",
    image_url: "",
  } as unknown as Deal;
}

/** withDelay under a name that can't collide with the Reanimated import. */
function withDelayed<T>(ms: number, anim: T): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (withDelay as any)(ms, anim);
}

const PHONE_W = 228;
const PHONE_H = 432;
const BEZEL = 8;

interface ProductDemoBeatProps {
  deals: Deal[];
}

export default function ProductDemoBeat({ deals }: ProductDemoBeatProps) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;

  const cards = useMemo(() => {
    const byDest = new Map<string, Deal>();
    for (const d of deals) {
      if (!d.destination) continue;
      const prev = byDest.get(d.destination);
      if (!prev || (d.discount_pct || 0) > (prev.discount_pct || 0)) {
        byDest.set(d.destination, d);
      }
    }
    return [...byDest.values()]
      .sort((a, b) => {
        // Recognisable places first, then by discount within each group.
        const ra = marqueeRank(a.destination);
        const rb = marqueeRank(b.destination);
        if (ra !== rb) return ra - rb;
        return (b.discount_pct || 0) - (a.discount_pct || 0);
      })
      .slice(0, DECK);
  }, [deals]);

  /** Mirror Explore's free rule so the map tells the same lock story. */
  const mapDeals: MapDeal[] = useMemo(() => {
    const byDest = new Map<string, Deal>();
    for (const d of deals) {
      if (!d.destination) continue;
      const prev = byDest.get(d.destination);
      if (!prev || (d.price || Infinity) < (prev.price || Infinity)) {
        byDest.set(d.destination, d);
      }
    }
    const unique = [...byDest.values()];
    const freeSet = new Set(
      unique
        .filter((d) =>
          (d.domestic_or_international || "").toLowerCase().includes("domestic"),
        )
        .sort((a, b) => (a.price || 0) - (b.price || 0))
        .slice(0, 5)
        .map((d) => d.destination),
    );
    return unique.map((deal) => ({ deal, locked: !freeSet.has(deal.destination) }));
  }, [deals]);

  /**
   * The pins the demo map actually renders: the user's real deals plus the
   * illustrative stops. Any real entry for those cities is replaced so the
   * price is deterministic, and none of the three is locked — this is a
   * product preview, and a lock here just teaches "you can't have this"
   * before we've shown what "this" is.
   */
  const previewMapDeals: MapDeal[] = useMemo(() => {
    const names = new Set(PREVIEW_STOPS.map((p) => p.destination.toLowerCase()));
    const rest = mapDeals.filter(
      (m) => !names.has((m.deal.destination || "").toLowerCase()),
    );
    return [
      ...rest,
      ...PREVIEW_STOPS.map((p) => ({
        deal: makePreviewDeal(p.destination, p.price, p.discountPct),
        locked: false,
      })),
    ];
  }, [mapDeals]);

  const [phase, setPhase] = useState<"swipe" | "map">("swipe");
  const [searchTarget, setSearchTarget] = useState<string | null>(null);
  const [chip, setChip] = useState<Deal | null>(null);
  const [chipLocked, setChipLocked] = useState(false);
  const pos = useSharedValue(0);
  const likePulse = useSharedValue(0);
  const passPulse = useSharedValue(0);

  // Phone entrance. Arrives from below with a touch of rotation so it swoops
  // rather than simply appearing — this is the first time in the flow the
  // user sees the product itself, and it earns a bit of arrival.
  const enter = useSharedValue(0);
  useEffect(() => {
    enter.value = withTiming(1, {
      duration: 720,
      easing: Easing.out(Easing.back(1.3)),
    });
  }, []);
  const phoneStyle = useAnimatedStyle(() => ({
    opacity: interpolate(enter.value, [0, 0.35, 1], [0, 1, 1]),
    transform: [
      { translateY: interpolate(enter.value, [0, 1], [90, 0]) },
      { scale: interpolate(enter.value, [0, 1], [0.86, 1]) },
      { rotate: `${interpolate(enter.value, [0, 1], [-0.07, 0])}rad` },
    ],
  }));

  // Outside-the-phone verdict markers.
  //
  // Written out twice rather than shared through a helper, for two separate
  // reasons: a helper returning `useAnimatedStyle` is a hook call inside a
  // plain function (rules-of-hooks), and a helper *called from inside* a
  // worklet isn't workletised by the Babel plugin and can fail on the UI
  // thread while typechecking perfectly. Six duplicated lines is cheaper.
  const likeStyle = useAnimatedStyle(() => ({
    opacity: likePulse.value,
    transform: [{ scale: 0.78 + likePulse.value * 0.34 }],
  }));
  const passStyle = useAnimatedStyle(() => ({
    opacity: passPulse.value,
    transform: [{ scale: 0.78 + passPulse.value * 0.34 }],
  }));

  // Swipe phase: walk `pos` one card at a time, then hand to the map.
  // Live drag of the top card, plus the committed index. See header.
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const flinging = useSharedValue(false);
  const stepRef = useRef(0);
  const lastInteractRef = useRef(0);
  const [interacted, setInteracted] = useState(false);

  const totalSwipes = Math.min(SWIPES, cards.length);

  /** JS side of a committed swipe: haptic, marker pulse, phase handover. */
  const onCommitted = (dir: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    // Bloom fast, decay slow — the shape of a haptic tap. On its own value
    // so the marker outlives the card rather than blinking with it.
    const target = dir > 0 ? likePulse : passPulse;
    target.value = withSequence(
      withTiming(1, { duration: 150, easing: Easing.out(Easing.back(2)) }),
      withTiming(0, { duration: 900, easing: Easing.out(Easing.cubic) }),
    );
    stepRef.current += 1;
    lastInteractRef.current = Date.now();
    if (stepRef.current >= totalSwipes) {
      setTimeout(() => setPhase("map"), 160);
    }
  };

  const noteInteraction = () => {
    lastInteractRef.current = Date.now();
    if (!interacted) setInteracted(true);
  };

  // "You can swipe this" hint. A hand sweeps right across the top card and
  // the card itself eases a few points along with it, on a loop, until the
  // first real touch. An animating deck alone reads as a video; a hand on it
  // reads as an invitation.
  const hint = useSharedValue(0);
  const nudge = useSharedValue(0);
  useEffect(() => {
    if (phase !== "swipe" || interacted) {
      cancelAnimation(hint);
      cancelAnimation(nudge);
      hint.value = 0;
      nudge.value = withTiming(0, { duration: 180 });
      return;
    }
    hint.value = 0;
    hint.value = withDelayed(
      ENTRANCE_MS + 300,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1150, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: 0 }),
          withTiming(0, { duration: 650 }),
        ),
        -1,
        false,
      ),
    );
    nudge.value = withDelayed(
      ENTRANCE_MS + 300,
      withRepeat(
        withSequence(
          withTiming(14, { duration: 700, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: 450, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: 650 }),
        ),
        -1,
        false,
      ),
    );
  }, [phase, interacted]);
  const handStyle = useAnimatedStyle(() => ({
    opacity: interpolate(hint.value, [0, 0.12, 0.78, 1], [0, 1, 1, 0], Extrapolation.CLAMP),
    transform: [
      { translateX: interpolate(hint.value, [0, 1], [-28, 72]) },
      { translateY: interpolate(hint.value, [0, 0.5, 1], [0, -6, 0]) },
      { rotate: `${interpolate(hint.value, [0, 1], [-0.12, 0.12])}rad` },
    ],
  }));

  /** Throw the top card out. Callable from a gesture or, via runOnUI, JS. */
  const fling = (dir: number) => {
    "worklet";
    if (flinging.value) return;
    flinging.value = true;
    dragX.value = withTiming(
      dir * FLING_X,
      { duration: FLING_MS, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (!finished) {
          flinging.value = false;
          return;
        }
        // Commit + reset in the same UI-thread tick: the next card is at
        // rest the frame it becomes top, and the departed one is at s=-1
        // (fully transparent) before React hears about it.
        pos.value = pos.value + 1;
        dragX.value = 0;
        dragY.value = 0;
        flinging.value = false;
        runOnJS(onCommitted)(dir);
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
      if (committed) {
        fling(dir);
      } else {
        dragX.value = withSpring(0, { damping: 18, stiffness: 220 });
        dragY.value = withSpring(0, { damping: 18, stiffness: 220 });
      }
    });

  // Idle fallback: if nobody touches the deck, it swipes itself, alternating
  // direction. Polls rather than schedules so a touch mid-wait simply pushes
  // the deadline out instead of needing the timer torn down and rebuilt.
  useEffect(() => {
    if (phase !== "swipe" || cards.length === 0) return;
    lastInteractRef.current = Date.now() + ENTRANCE_MS;
    const id = setInterval(() => {
      if (stepRef.current >= totalSwipes) return;
      if (Date.now() - lastInteractRef.current < IDLE_MS) return;
      lastInteractRef.current = Date.now();
      const dir = stepRef.current % 2 === 0 ? 1 : -1;
      runOnUI(flingRef.current)(dir);
    }, 200);
    return () => clearInterval(id);
  }, [phase, cards.length, totalSwipes]);

  // Map phase: fly to a couple of real deals, each with a compact chip.
  // `searchTarget` is the same prop Explore uses for a user's pick, so the
  // camera move is the real one — only the oversized preview card and
  // banners are suppressed (see `chromeless`).
  useEffect(() => {
    if (phase !== "map") {
      setSearchTarget(null);
      setChip(null);
      return;
    }
    // Kill any in-flight marker: its 900ms decay outlives the handover, so
    // it would otherwise fade out on top of the map.
    likePulse.value = 0;
    passPulse.value = 0;
    // Rewind the deck HERE, not when the swipe phase starts. `useEffect` runs
    // after paint, so resetting on the way in would let one frame render with
    // every card already gone — a blink before the deck reappears.
    pos.value = 0;
    dragX.value = 0;
    dragY.value = 0;
    flinging.value = false;
    stepRef.current = 0;

    // One genuine unlocked pin from their own feed first — so the demo opens
    // on something real and local — then the two illustrative stops.
    const byFame = [...previewMapDeals].sort(
      (a, b) =>
        marqueeRank(a.deal.destination) - marqueeRank(b.deal.destination),
    );
    const previewNames = new Set(
      PREVIEW_STOPS.map((p) => p.destination.toLowerCase()),
    );
    const local = byFame.find(
      (m) =>
        !m.locked && !previewNames.has((m.deal.destination || "").toLowerCase()),
    );
    const stops = PREVIEW_STOPS.map((p) =>
      previewMapDeals.find(
        (m) => m.deal.destination.toLowerCase() === p.destination.toLowerCase(),
      ),
    ).filter(Boolean) as MapDeal[];
    const picks = [local, ...stops].filter(Boolean) as MapDeal[];

    const timers: ReturnType<typeof setTimeout>[] = [];
    picks.forEach((pick, i) => {
      const at = 1000 + i * 2000;
      timers.push(
        setTimeout(() => {
          Haptics.selectionAsync().catch(() => {});
          setSearchTarget(pick.deal.destination);
          setChip(pick.deal);
          setChipLocked(pick.locked);
        }, at),
      );
      timers.push(setTimeout(() => setChip(null), at + 1500));
    });
    timers.push(setTimeout(() => setPhase("swipe"), MAP_MS));
    return () => timers.forEach(clearTimeout);
  }, [phase, previewMapDeals]);

  const renderFace = (deal: Deal) => (
    <>
      {!!deal.image_url && (
        <Image
          source={{ uri: deal.image_url }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={200}
        />
      )}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.8)"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.faceBody}>
        <View style={styles.destRow}>
          <MapPin size={12} color="#ffffff" />
          <Text style={styles.destText} numberOfLines={1}>
            {deal.destination}
          </Text>
        </View>
        <View style={styles.priceRow}>
          <Text style={styles.priceText}>${Math.round(deal.price)}</Text>
          {deal.discount_pct > 0 && (
            <View style={styles.offPill}>
              <Text style={styles.offText}>
                {Math.round(deal.discount_pct)}% off
              </Text>
            </View>
          )}
        </View>
      </View>
    </>
  );

  return (
    <Animated.View entering={FadeIn.duration(400)} style={styles.wrap}>
      <View style={styles.stage}>
        {/* Icon only — the words were reading as UI the user might press,
            which is the exact confusion the phone frame exists to avoid. */}
        <Animated.View style={[styles.sideLabel, styles.sideLeft, passStyle]}>
          <X size={30} color={colors.brand.rose500} strokeWidth={3.5} />
        </Animated.View>
        <Animated.View style={[styles.sideLabel, styles.sideRight, likeStyle]}>
          <Heart
            size={30}
            color={colors.brand.traceGreen}
            fill={colors.brand.traceGreen}
          />
        </Animated.View>

      <Animated.View style={[styles.phone, phoneStyle]}>
        <View style={[styles.screen, { backgroundColor: theme.background }]}>
          {/* Both phases are absolutely positioned so they overlap during the
              handover and cross-fade, rather than one unmounting and the next
              popping in — the hard swap is what read as clunky. */}
          {phase === "swipe" ? (
            <GestureDetector gesture={pan}>
              <Animated.View
                key="swipe"
                entering={FadeIn.duration(420)}
                exiting={FadeOut.duration(320)}
                style={[StyleSheet.absoluteFill, styles.deckWrap]}
              >
                {/* Rendered back-to-front so card 0 is the last child and
                    sits on top — correct stacking from render order alone,
                    with no animated zIndex to fight the platform over. */}
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
                    >
                      {renderFace(deal)}
                    </DeckCard>
                  ))}
                {!interacted && (
                  <Animated.View
                    pointerEvents="none"
                    style={[styles.hand, handStyle]}
                  >
                    <Hand size={22} color="#ffffff" strokeWidth={2.4} />
                  </Animated.View>
                )}
              </Animated.View>
            </GestureDetector>
          ) : (
            <Animated.View
              key="map"
              entering={FadeIn.duration(420)}
              exiting={FadeOut.duration(320)}
              style={[StyleSheet.absoluteFill, styles.mapWrap]}
              pointerEvents="none"
            >
              <DealsMap
                deals={previewMapDeals}
                onSelectDeal={() => {}}
                onSaveDeal={() => {}}
                savedDealIds={EMPTY_SET}
                onLockedPress={() => {}}
                searchTarget={searchTarget}
                onRequestAlert={() => {}}
                // Explore's 2.2 is far too tight at phone-mock scale — this
                // opens on most of the world so the pin spread reads at all.
                initialZoom={0.7}
                searchZoom={2.9}
                chromeless
              />
              {!!chip && (
                <Animated.View
                  entering={FadeIn.duration(220)}
                  exiting={FadeOut.duration(220)}
                  style={[styles.chip, { backgroundColor: theme.card }]}
                >
                  <Text
                    style={[styles.chipDest, { color: theme.foreground }]}
                    numberOfLines={1}
                  >
                    {chip.destination}
                  </Text>
                  {chipLocked ? (
                    <Lock size={15} color={colors.brand.traceRed} strokeWidth={2.6} />
                  ) : (
                    <Text style={styles.chipPrice}>
                      ${Math.round(chip.price)}
                    </Text>
                  )}
                </Animated.View>
              )}
            </Animated.View>
          )}

          {/* Fades with the deck rather than blinking out mid-crossfade. */}
          {phase === "swipe" && (
            <Animated.View
              entering={FadeIn.duration(420)}
              exiting={FadeOut.duration(320)}
              style={styles.controls}
            >
              <View
                style={[
                  styles.ctrl,
                  { backgroundColor: theme.card, borderColor: theme.border },
                ]}
              >
                <X size={14} color={colors.brand.rose500} strokeWidth={3} />
              </View>
              <View
                style={[
                  styles.ctrl,
                  { backgroundColor: theme.card, borderColor: theme.border },
                ]}
              >
                <Heart
                  size={14}
                  color={colors.brand.traceGreen}
                  fill={colors.brand.traceGreen}
                />
              </View>
            </Animated.View>
          )}
        </View>
      </Animated.View>
      </View>

      <Text style={[styles.caption, { color: theme.mutedForeground }]}>
        {phase === "swipe"
          ? interacted
            ? "Right saves it. Left skips it."
            : "👆 Swipe the card — right to save, left to skip."
          : "Or open the map and see every destination we track from your airport."}
      </Text>
    </Animated.View>
  );
}

/**
 * One card. Its entire life — stacked, on top, flying out, gone — is derived
 * from `pos - index`, so it never needs to be told anything.
 */
function DeckCard({
  index,
  pos,
  dragX,
  dragY,
  nudge,
  children,
}: {
  index: number;
  pos: SharedValue<number>;
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
  nudge: SharedValue<number>;
  children: React.ReactNode;
}) {
  const style = useAnimatedStyle(() => {
    const s = index - pos.value; // 0 = top, >0 behind, <0 gone
    if (s < 0) return { opacity: 0, transform: [{ translateX: 0 }] };
    if (s === 0) {
      const x = dragX.value + nudge.value;
      const p = Math.min(Math.abs(dragX.value) / FLING_X, 1);
      return {
        opacity: interpolate(p, [0.65, 1], [1, 0], Extrapolation.CLAMP),
        transform: [
          { translateX: x },
          { translateY: dragY.value },
          { rotate: `${(x / FLING_X) * 0.18}rad` },
          { scale: 1 },
        ],
      };
    }
    // Behind the top card. The next one lifts toward full size as the top
    // card departs, so the hand-off reads as continuous.
    const lift = s === 1 ? Math.min(Math.abs(dragX.value) / FLING_X, 1) : 0;
    const base = interpolate(Math.min(s, 3), [1, 2, 3], [0.94, 0.89, 0.85]);
    const ty = interpolate(Math.min(s, 3), [1, 2, 3], [9, 18, 26]);
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

  // Verdict badges on the top card, one per direction, revealed by drag.
  const saveStyle = useAnimatedStyle(() => ({
    opacity:
      index - pos.value === 0 && dragX.value > 0
        ? interpolate(dragX.value, [15, 80], [0, 1], Extrapolation.CLAMP)
        : 0,
  }));
  const passStyle = useAnimatedStyle(() => ({
    opacity:
      index - pos.value === 0 && dragX.value < 0
        ? interpolate(-dragX.value, [15, 80], [0, 1], Extrapolation.CLAMP)
        : 0,
  }));

  return (
    <Animated.View style={[styles.card, style]}>
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

const EMPTY_SET = new Set<string>();
const SCREEN_W = PHONE_W - BEZEL * 2;

const styles = StyleSheet.create({
  wrap: { alignItems: "center" },
  stage: { width: "100%", alignItems: "center", justifyContent: "center" },
  sideLabel: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    top: "44%",
  },
  sideLeft: { left: 6 },
  sideRight: { right: 6 },
  phone: {
    width: PHONE_W,
    height: PHONE_H,
    borderRadius: 38,
    backgroundColor: "#111114",
    padding: BEZEL,
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  screen: { flex: 1, borderRadius: 31, overflow: "hidden" },
  deckWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  hand: {
    position: "absolute",
    top: "48%",
    left: "42%",
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.9)",
  },
  card: {
    position: "absolute",
    top: 18,
    width: SCREEN_W - 24,
    // Controls are back but deliberately small, so the image keeps most of
    // the screen.
    height: PHONE_H - BEZEL * 2 - 74,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#00000010",
  },
  faceBody: { position: "absolute", left: 12, right: 12, bottom: 12, gap: 6 },
  destRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  destText: { color: "#fff", fontSize: 16, fontWeight: "800", flex: 1 },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  priceText: { color: "#fff", fontSize: 21, fontWeight: "800" },
  offPill: {
    backgroundColor: colors.brand.traceGreen,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  offText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  badge: {
    position: "absolute",
    top: 16,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 2,
    borderColor: "#fff",
  },
  badgeSave: { right: 14, backgroundColor: colors.brand.traceGreen },
  badgePass: { left: 14, backgroundColor: colors.brand.rose500 },
  badgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
  },
  controls: {
    position: "absolute",
    bottom: 12,
    alignSelf: "center",
    flexDirection: "row",
    gap: 18,
  },
  ctrl: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  mapWrap: { flex: 1 },
  chip: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  chipDest: { fontSize: 14, fontWeight: "700", flex: 1 },
  chipPrice: { fontSize: 16, fontWeight: "800", color: colors.brand.traceRed },
  caption: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 20,
    paddingHorizontal: 6,
    minHeight: 44,
  },
});
