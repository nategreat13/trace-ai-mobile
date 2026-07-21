import React, { useCallback, useEffect } from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  runOnJS,
  FadeInDown,
} from "react-native-reanimated";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Crown, Bell, ArrowRight, Check } from "lucide-react-native";
import { colors } from "../../theme/colors";
import { useAuth } from "../../context/AuthContext";

// Same thresholds/exit mechanics as SwipeCard.tsx — this is a sibling
// component (not a shared refactor) so the proven deal-swiping gesture
// code in SwipeCard.tsx stays completely untouched.
const SWIPE_X_THRESHOLD = 80;
const VELOCITY_THRESHOLD = 300;
const EXIT_X = 500;
const EXIT_X_DURATION = 300;
const ROTATION_INPUT = [-300, 0, 300];
const ROTATION_OUTPUT = [-30, 0, 30];
const SCALE_INPUT = [-300, 0, 300];
const SCALE_OUTPUT = [0.95, 1, 0.95];

interface UpsellSwipeCardProps {
  variant: "premium" | "business";
  onDismiss: () => void;
  onUpgrade: () => void;
  triggerSwipe: "left" | "right" | null;
}

// Bullets are deliberately limited to benefits that are actually real
// today (matches PaywallScreen's own feature lists) — no "48-hour early
// access" here, since that's advertised elsewhere in the app but has no
// backing server logic yet.
const CONTENT = {
  premium: {
    eyebrow: "TRACE PREMIUM",
    Icon: Bell,
    headline: "Never miss a\nprice drop.",
    // The banner stack above already demonstrates "alerts, any destination,
    // while you're not looking" — spelling it out again underneath is what
    // made this card read as cluttered. Only the one benefit the visual
    // can't show survives as copy.
    sub: null as string | null,
    bullets: ["Full Explore access included"],
    cta: "Unlock alerts",
    gradient: [colors.brand.traceRed, colors.brand.tracePink] as const,
    // No photo — premium sells a mechanism (we watch, you get pinged),
    // not a place, so the empty top half gets a demo of the actual
    // product instead: a stack of the push notifications you'd receive.
    image: null as number | null,
    accent: null as string | null,
    stats: null as { value: string; label: string }[] | null,
    // Set is chosen per card appearance — see NOTIF_SETS.
    notifications: true,
  },
  business: {
    eyebrow: "BUSINESS CLASS",
    Icon: Crown,
    headline: "Fly business.\nPay economy.",
    sub: "Lie-flat business class deals, right in your deck.",
    bullets: ["Lie-flat business class, up to 65% off", "Everything in Premium, included"],
    cta: "See Business",
    // Backdrop behind the photo, so the card still reads correctly during
    // the frame or two before the image decodes.
    gradient: ["#0a0a12", "#0f1929"] as const,
    // Same cabin hero + dark scrim treatment as UpgradeScreen's header.
    image: require("../../../assets/businessimage.png") as number,
    accent: colors.brand.amber500,
    // Mirrors the quick-stats row on UpgradeScreen.
    stats: [
      { value: "65%", label: "avg discount" },
      { value: "48h", label: "early access" },
      { value: "$2.4K", label: "avg saved/yr" },
    ],
    // The cabin photo already fills this card's upper half.
    notifications: false,
  },
};

interface MockNotif {
  emoji: string;
  // Every greeted body starts with a proper noun, so prefixing the user's
  // name reads correctly ("Lisbon just…" → "Trevor, Lisbon just…") and the
  // no-name fallback is still a valid sentence. Keep that true if you edit.
  body: string;
  time: string;
  greet?: boolean;
}

// Only the first banner in each set is greeted by name — a real
// notification feed doesn't say your name twice in a row, and it keeps the
// personalisation from tipping into feeling spammy.
const NOTIF_SETS: MockNotif[][] = [
  [
    { emoji: "✈️", body: "Lisbon just dropped to $312", time: "now", greet: true },
    { emoji: "🗼", body: "Tokyo — 58% off, 4 seats left", time: "2m ago" },
  ],
  [
    { emoji: "🏛️", body: "Rome just dropped to $377", time: "now", greet: true },
    { emoji: "🇪🇸", body: "Barcelona — 61% off today", time: "12m ago" },
  ],
  [
    { emoji: "🇯🇵", body: "Tokyo just dropped to $488", time: "now", greet: true },
    { emoji: "🇮🇸", body: "Reykjavík — 54% off, ends tonight", time: "5m ago" },
  ],
  [
    { emoji: "🇫🇷", body: "Paris just dropped to $341", time: "now", greet: true },
    { emoji: "🏛️", body: "Athens — 63% off this week", time: "1h ago" },
  ],
  [
    { emoji: "🇲🇽", body: "Mexico City dropped to $198", time: "now", greet: true },
    { emoji: "🇵🇪", body: "Lima — 57% off, 6 seats left", time: "20m ago" },
  ],
];

// Advances every time a premium upsell card mounts, so a user who sees
// several across a session gets a different pair each time. Same
// module-counter idiom as LOADING_IMAGES in SwipeDeckScreen.
let upsellNotifSetCount = 0;

// Trace's own app icon, reused as the sender icon in the mock banners so
// they read as real push notifications rather than generic chat bubbles.
const APP_ICON = require("../../../assets/1.png");

// Per-banner tilt/offset. Small values on purpose — enough to feel hand-
// placed rather than gridded, not enough that the tilted corners of two
// adjacent banners can close the gap between them.
const NOTIF_TILT = ["-1.5deg", "1.5deg"];
const NOTIF_OFFSET = [0, 8];

// Scrim over the cabin photo: clear at the top so the seat/champagne stays
// visible, opaque at the bottom so the copy keeps its contrast.
//
// Lightening this to show more of the seat was tried and reverted — it made
// the headline and eyebrow pill hard to read, which costs more than the
// extra photo detail is worth. Raise PHOTO_HEIGHT to lift the seat into the
// clear zone instead; don't reach for the scrim.
const PHOTO_SCRIM = ["rgba(10,10,18,0)", "rgba(10,10,18,0.55)", "rgba(10,10,18,0.94)", "#0a0a12"] as const;
const PHOTO_SCRIM_LOCATIONS = [0, 0.34, 0.62, 1] as const;

// The photo is wide (≈1656×950) and the card is portrait, so `cover` shows
// the full image height and crops the sides hard. Two knobs:
//   HEIGHT — >100% overhangs the card bottom, pushing the uninteresting
//            carpet off-card and lifting the seat up into the clear zone.
//   FOCUS  — horizontal crop centre. The seat sits left of the photo's
//            middle, so <50% is what actually frames it; 50% lands on the
//            gap between the seat and the windows.
const PHOTO_HEIGHT = "132%";
const PHOTO_FOCUS_X = "38%";

// Card content lives in a fixed-height deck slot, so on short screens
// (iPhone SE and friends) the optional extras — the business stat row, the
// third premium banner — are what would push content past the card edge.
// Drop them there rather than clip them.
const IS_TALL_SCREEN = Dimensions.get("window").height >= 700;

export default function UpsellSwipeCard({
  variant,
  onDismiss,
  onUpgrade,
  triggerSwipe,
}: UpsellSwipeCardProps) {
  const content = CONTENT[variant];
  const { profile } = useAuth();

  // firstName is optional on UserProfile (and absent for guests), so every
  // greeted line has to degrade to an ungreeted sentence.
  const firstName = profile?.firstName?.trim() || null;

  // Pinned in a ref so re-renders during a swipe don't reshuffle the
  // banners mid-gesture; the counter only advances on mount.
  const notifSet = React.useRef(NOTIF_SETS[upsellNotifSetCount % NOTIF_SETS.length]);
  useEffect(() => {
    if (content.notifications) upsellNotifSetCount += 1;
  }, [content.notifications]);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  // Guards against onDismiss/onUpgrade firing more than once for a
  // single swipe.
  const handled = React.useRef(false);
  const handleDismiss = useCallback(() => {
    if (handled.current) return;
    handled.current = true;
    onDismiss();
  }, [onDismiss]);
  const handleUpgrade = useCallback(() => {
    if (handled.current) return;
    handled.current = true;
    onUpgrade();
  }, [onUpgrade]);

  // Programmatic swipe via the bottom X/heart buttons — same pattern as
  // SwipeCard's triggerSwipe prop. Right/like opens the paywall (same
  // "positive" semantics as saving a real deal); left/pass just dismisses.
  useEffect(() => {
    if (!triggerSwipe) return;
    const exitX = triggerSwipe === "left" ? -EXIT_X : EXIT_X;
    const onExit = triggerSwipe === "left" ? handleDismiss : handleUpgrade;
    translateX.value = withTiming(exitX, { duration: EXIT_X_DURATION }, () => {
      runOnJS(onExit)();
    });
  }, [triggerSwipe, translateX, handleDismiss, handleUpgrade]);

  const tapScale = useSharedValue(1);

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY;
    })
    .onEnd((event) => {
      const { translationX, velocityX } = event;
      if (translationX < -SWIPE_X_THRESHOLD || velocityX < -VELOCITY_THRESHOLD) {
        translateX.value = withTiming(-EXIT_X, { duration: EXIT_X_DURATION }, () => {
          runOnJS(handleDismiss)();
        });
        return;
      }
      if (translationX > SWIPE_X_THRESHOLD || velocityX > VELOCITY_THRESHOLD) {
        // Right/like — same "positive" semantics as saving a real deal —
        // opens the paywall instead of just dismissing.
        translateX.value = withTiming(EXIT_X, { duration: EXIT_X_DURATION }, () => {
          runOnJS(handleUpgrade)();
        });
        return;
      }
      translateX.value = withTiming(0, { duration: 200 });
      translateY.value = withTiming(0, { duration: 200 });
    });

  const tapGesture = Gesture.Tap()
    .onBegin(() => {
      tapScale.value = withTiming(0.965, { duration: 80 });
    })
    .onEnd(() => {
      tapScale.value = withTiming(1, { duration: 150 });
      runOnJS(handleUpgrade)();
    })
    .onFinalize(() => {
      tapScale.value = withTiming(1, { duration: 150 });
    });

  const composedGesture = Gesture.Race(panGesture, tapGesture);

  const cardAnimatedStyle = useAnimatedStyle(() => {
    const rotation = interpolate(translateX.value, ROTATION_INPUT, ROTATION_OUTPUT);
    const scale = interpolate(translateX.value, SCALE_INPUT, SCALE_OUTPUT);
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotation}deg` },
        { scale: scale * tapScale.value },
      ],
    };
  });

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View
        style={[
          styles.card,
          content.accent ? { borderWidth: 1, borderColor: content.accent + "40" } : null,
          cardAnimatedStyle,
        ]}
      >
        <LinearGradient
          colors={content.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        {content.image ? (
          <>
            <Image
              source={content.image}
              // Anchored to the top and taller than the card, so the extra
              // height falls off the bottom rather than the seat sliding
              // down under the scrim.
              style={{ position: "absolute", top: 0, left: 0, right: 0, height: PHOTO_HEIGHT }}
              contentFit="cover"
              contentPosition={{ top: 0, left: PHOTO_FOCUS_X }}
              transition={200}
            />
            <LinearGradient
              colors={PHOTO_SCRIM}
              locations={PHOTO_SCRIM_LOCATIONS}
              style={StyleSheet.absoluteFillObject}
            />
          </>
        ) : null}
        <View style={styles.content}>
          {content.notifications ? (
            <View style={styles.notifArea}>
              {notifSet.current.map((notif, i) => (
                <Animated.View
                  key={notif.body}
                  entering={FadeInDown.delay(140 + i * 110).duration(420)}
                  style={[
                    styles.notifBanner,
                    {
                      transform: [
                        { rotate: NOTIF_TILT[i] },
                        { translateX: NOTIF_OFFSET[i] },
                      ],
                      opacity: 1 - i * 0.12,
                    },
                  ]}
                >
                  <View style={styles.notifHeader}>
                    <Image source={APP_ICON} style={styles.notifIcon} contentFit="cover" />
                    <Text style={styles.notifApp}>TRACE</Text>
                    <Text style={styles.notifTime}>{notif.time}</Text>
                  </View>
                  {/* Two lines, not one: a greeted line is ~8 chars longer,
                      and a long first name truncating mid-word reads as
                      broken in a way that a wrap doesn't. */}
                  <Text style={styles.notifBody} numberOfLines={2}>
                    {notif.emoji}{" "}
                    {notif.greet && firstName ? `${firstName}, ${notif.body}` : notif.body}
                  </Text>
                </Animated.View>
              ))}
            </View>
          ) : null}
          <View
            style={[
              styles.eyebrowPill,
              content.accent ? { backgroundColor: content.accent } : null,
            ]}
          >
            <content.Icon color="#fff" size={14} />
            <Text style={styles.eyebrowText}>{content.eyebrow}</Text>
          </View>
          <Text style={[styles.headline, content.sub ? null : styles.headlineNoSub]}>
            {content.headline}
          </Text>
          {content.sub ? <Text style={styles.sub}>{content.sub}</Text> : null}
          {content.stats && IS_TALL_SCREEN ? (
            <View style={styles.statRow}>
              {content.stats.map((stat) => (
                <View key={stat.label} style={styles.statTile}>
                  <Text style={[styles.statValue, { color: colors.brand.amber400 }]}>
                    {stat.value}
                  </Text>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                </View>
              ))}
            </View>
          ) : null}
          <View style={styles.bulletList}>
            {content.bullets.map((bullet) => (
              <View key={bullet} style={styles.bulletRow}>
                <View
                  style={[
                    styles.bulletCheck,
                    content.accent ? { backgroundColor: content.accent } : null,
                  ]}
                >
                  <Check color="#fff" size={11} strokeWidth={3} />
                </View>
                <Text style={styles.bulletText}>{bullet}</Text>
              </View>
            ))}
          </View>
          <View
            style={[styles.ctaRow, content.accent ? { backgroundColor: content.accent } : null]}
          >
            <Text style={styles.ctaText}>{content.cta}</Text>
            <ArrowRight color="#fff" size={18} />
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: {
    position: "absolute",
    top: 0,
    left: 4,
    right: 4,
    bottom: 0,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  content: {
    flex: 1,
    justifyContent: "flex-end",
    padding: 24,
    paddingBottom: 32,
  },
  eyebrowPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 16,
  },
  eyebrowText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.5,
  },
  headline: {
    fontSize: 30,
    fontWeight: "900",
    color: "#fff",
    lineHeight: 34,
    marginBottom: 12,
    textShadowColor: "rgba(0,0,0,0.25)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  // Without a sub-line the headline's own 12pt gap sits too tight against
  // the bullet row, so it absorbs some of the space the sub used to hold.
  headlineNoSub: {
    marginBottom: 18,
  },
  sub: {
    fontSize: 14,
    color: "rgba(255,255,255,0.9)",
    lineHeight: 20,
    marginBottom: 16,
  },
  notifArea: {
    // Deliberately NOT flex:1. A flex child here gets squeezed toward zero
    // height when the copy needs the room, and its fixed-height banners
    // then overflow *downward* onto the eyebrow pill. Natural height means
    // the banners always push the copy instead of landing on top of it.
    gap: 12,
    // The copy block is pinned to the bottom of the card, so widening this
    // gap is what lifts the banners toward the top rather than moving the
    // copy. Tune this number to slide the stack up or down.
    marginBottom: 52,
  },
  notifBanner: {
    // Never let a banner compress — if space runs short the copy below
    // should win and the stack should push, not squash.
    flexShrink: 0,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    paddingHorizontal: 12,
    paddingVertical: 9,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
  },
  notifHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 5,
  },
  notifIcon: {
    width: 16,
    height: 16,
    borderRadius: 4,
  },
  notifApp: {
    fontSize: 10,
    fontWeight: "800",
    color: "rgba(255,255,255,0.9)",
    letterSpacing: 0.6,
    flex: 1,
  },
  notifTime: {
    fontSize: 10,
    color: "rgba(255,255,255,0.6)",
  },
  notifBody: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
  statRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 18,
  },
  statTile: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    paddingVertical: 12,
    paddingHorizontal: 6,
  },
  statValue: {
    fontSize: 19,
    fontWeight: "900",
  },
  statLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.5)",
    marginTop: 3,
  },
  bulletList: {
    marginBottom: 20,
    gap: 8,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  bulletCheck: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(255,255,255,0.25)",
    justifyContent: "center",
    alignItems: "center",
  },
  bulletText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#fff",
    flex: 1,
  },
  ctaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  ctaText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#fff",
  },
});
