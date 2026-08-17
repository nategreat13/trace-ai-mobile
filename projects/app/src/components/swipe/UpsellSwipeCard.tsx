import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Dimensions, AppState } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Svg, { Circle } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withTiming,
  interpolate,
  runOnJS,
  FadeInDown,
  Easing,
  cancelAnimation,
} from "react-native-reanimated";
import { UPSELL_CARD_WAIT_SECONDS } from "../../lib/constants";
import { useIsFocused } from "@react-navigation/native";
import { useFreeTrial } from "../../context/TrialContext";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Crown, Bell, ArrowRight } from "lucide-react-native";
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

// Countdown ring geometry. Drawn from 12 o'clock and depleting clockwise,
// which is the direction people read a timer draining.
const RING_SIZE = 26;
const RING_STROKE = 2.5;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface UpsellSwipeCardProps {
  variant: "premium" | "business" | "welcome_back";
  onDismiss: () => void;
  onUpgrade: () => void;
  triggerSwipe: "left" | "right" | null;
  /**
   * Overrides content.sub with a computed, per-user sentence (e.g. "You've
   * saved 3 trips under $500 — get alerted the moment prices like these
   * come back") when there's enough real signal to make the pitch feel
   * earned instead of generic. Only ever passed for the plain "premium"
   * variant — not stacked with business/welcome_back framing.
   */
  personalizedSub?: string | null;
  /** Countdown length for this appearance; escalates with the card ordinal. */
  waitSeconds?: number;
}

// Bullets are deliberately limited to benefits that are actually real
// today (matches PaywallScreen's own feature lists) — no "48-hour early
// access" here, since that's advertised elsewhere in the app but has no
// backing server logic yet.
//
// Note for anyone tempted to add a "here's your current cap" element to
// either variant: two versions have already been cut — a three-tile
// 5→All/3→∞/—→4h strip, then a plain sentence. Both were accurate, and both
// made the lower half too busy to parse at a glance. The cap belongs on the
// paywall, which has room to explain it. This card's job is to land in one
// look.
const CONTENT = {
  premium: {
    eyebrow: "TRACE PREMIUM",
    Icon: Bell,
    // "Never miss a price drop" named a feeling; this names the two things
    // the user is actually being blocked from right now — the locked deals
    // and the countdown they just sat through.
    headline: "Unlimited deals.\nNo waiting.",
    sub: null as string | null,
    // Four real gates, matching PaywallScreen's list — the card previously
    // carried one vague bullet ("Full Explore access included") standing in
    // for three separate limits and selling none of them.
    //
    // Emoji rather than check icons: four identical checkmarks read as a
    // single grey block the eye slides off, while four distinct glyphs give
    // each line its own shape. That's what makes the list scannable in the
    // few seconds this card gets.
    // "Alerts every 4 hours" described our cron schedule, not a benefit — the
    // user doesn't care how often we poll, only that they hear about it.
    // Rephrased from their side of the transaction.
    //
    // "No ads, no interruptions" is honest: the interruption being sold away
    // is this card and its countdown, which is real and which they are
    // experiencing at the moment they read the line.
    bullets: [
      { emoji: "🔔", text: "Get notified the moment your deal shows up" },
      { emoji: "🌍", text: "Every destination unlocked" },
      { emoji: "🗺️", text: "Personal travel guides unlocked" },
      { emoji: "🚫", text: "No ads, no interruptions" },
    ],
    // Fallback only — when a real free trial is on the offering, the render
    // replaces this with "Try free for <actual length>". Never hardcode a
    // trial length here; it comes from the store's intro offer.
    cta: "Unlock alerts",
    // Back to warm, on Trevor's call, after violet read as flat.
    //
    // On "whatever colour converts best" — there's no honest answer to that.
    // Published colour-conversion results are mostly single-site A/B tests
    // whose winner tracks contrast against that page, not the hue itself,
    // and they don't transfer. What does transfer is that the CTA needs to
    // be the highest-contrast thing on the card. So this is a deep crimson →
    // warm orange that stays dark enough for the white notification banners
    // to read as real iOS notifications, while the CTA below sits on the
    // brand red at full saturation and remains the brightest element.
    //
    // If you want a real answer on hue, it needs an A/B test with enough
    // trial starts to read — which, at current volume, is a long way off.
    gradient: ["#7a1533", "#d1452b"] as const,
    // No photo — premium sells a mechanism (we watch, you get pinged),
    // not a place, so the empty top half gets a demo of the actual
    // product instead: a stack of the push notifications you'd receive.
    image: null as number | null,
    accent: null as string | null,
    // Caption above the banner stack. Without it the mock notifications read
    // as real ones the user has somehow received — convincing, but it costs
    // them a beat to work out this is an offer, and on a card with a
    // countdown that beat is expensive. The line frames the stack as a
    // preview before they start parsing it.
    notifLabel: "Upgrade to get flight alerts like these",
    // Set is chosen per card appearance — see PREMIUM_NOTIF_SETS.
    notifications: true,
  },
  business: {
    eyebrow: "BUSINESS CLASS",
    Icon: Crown,
    headline: "Fly business.\nPay economy.",
    sub: "Lie-flat business class deals, right in your deck.",
    bullets: [
      { emoji: "🛋️", text: "Lie-flat seats, up to 65% off" },
      { emoji: "✨", text: "Everything in Premium, included" },
    ],
    cta: "See Business",
    // Backdrop behind the photo, so the card still reads correctly during
    // the frame or two before the image decodes.
    gradient: ["#0a0a12", "#0f1929"] as const,
    // Same cabin hero + dark scrim treatment as UpgradeScreen's header.
    image: require("../../../assets/businessimage.png") as number,
    accent: colors.brand.amber500,
    // A quick-stats row (65% / 48h / $2.4K) lived here until this card gained
    // the notification stack. The two compete for the same job — proof — and
    // running both left no room for the CTA on a full-height card. The stack
    // wins: it shows the product working rather than asserting an average.
    // It also retired "48h early access" and "$2.4K avg saved/yr", neither of
    // which has anything backing it, so nothing accurate was lost.
    notifLabel: "Upgrade to get business class alerts like these",
    // The cabin photo stays as the backdrop — it already carries a scrim, and
    // the banners read fine over the darkened lower half.
    notifications: true,
  },
};

// Shown instead of the standard premium pitch for the first upsell card of a
// session, to a free user who's been away a few days — same mechanism, same
// visual (the mock notification stack already sells "alerts, any
// destination"), just loss-aversion framing instead of the generic pitch.
// No discount lever available, so this leans entirely on "you missed
// something" rather than price.
const WELCOME_BACK_CONTENT: (typeof CONTENT)["premium"] = {
  ...CONTENT.premium,
  eyebrow: "WHILE YOU WERE AWAY",
  headline: "New deals dropped\nsince your last visit.",
  sub: "Turn on Premium alerts and never miss the next one.",
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
// Two per set. A third was tried when the card first went full-bleed and cut
// again: on a full-height card, three banners plus the four benefit lines and
// the CTA block overflows the bottom on a 17 Pro. Two also keeps the lower
// half calm, which is the whole point of the current layout.
const PREMIUM_NOTIF_SETS: MockNotif[][] = [
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

// Business-tier equivalents. Same shape and same rules as above (first line
// greeted, proper noun first) so the two cards read as one product with two
// tiers rather than two different designs. Cabin class is named in every line
// — that's the whole distinction being sold here.
const BUSINESS_NOTIF_SETS: MockNotif[][] = [
  [
    { emoji: "🛋️", body: "Tokyo lie-flat just dropped to $1,284", time: "now", greet: true },
    { emoji: "🥂", body: "Paris business — 61% off, 2 seats left", time: "8m ago" },
  ],
  [
    { emoji: "🛋️", body: "Dubai business just dropped to $1,512", time: "now", greet: true },
    { emoji: "🥂", body: "Rome lie-flat — 58% off this week", time: "25m ago" },
  ],
  [
    { emoji: "🛋️", body: "Singapore lie-flat now $1,690", time: "now", greet: true },
    { emoji: "🥂", body: "London business — 64% off, 3 seats left", time: "40m ago" },
  ],
  [
    { emoji: "🛋️", body: "Seoul business just dropped to $1,340", time: "now", greet: true },
    { emoji: "🥂", body: "Milan lie-flat — 55% off today", time: "1h ago" },
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
  personalizedSub,
  waitSeconds = UPSELL_CARD_WAIT_SECONDS,
}: UpsellSwipeCardProps) {
  const baseContent = variant === "welcome_back" ? WELCOME_BACK_CONTENT : CONTENT[variant];
  const content = personalizedSub ? { ...baseContent, sub: personalizedSub } : baseContent;
  const { profile } = useAuth();

  // Lead with the trial, not the price. Tapping through to a paywall that
  // opens on a dollar figure is a cold stop; "try free" sets the expectation
  // that nothing is charged today, which is what the paywall actually offers.
  // Both the availability and the length come from the live store offering
  // via TrialContext — the same source the paywall's own CTA uses — so this
  // can never advertise a trial the App Store would then charge for.
  const trial = useFreeTrial();
  const tierTrial = variant === "business" ? trial.business : trial;
  const ctaLabel = tierTrial.available
    ? `Try free for ${tierTrial.labelLong}`
    : content.cta;
  const ctaSubLabel = tierTrial.available ? "Cancel anytime" : null;

  // firstName is optional on UserProfile (and absent for guests), so every
  // greeted line has to degrade to an ungreeted sentence.
  const firstName = profile?.firstName?.trim() || null;

  // Pinned in a ref so re-renders during a swipe don't reshuffle the
  // banners mid-gesture; the counter only advances on mount.
  // Business gets its own set — same structure, cabin-class copy. Pinned in a
  // ref on mount so re-renders during a swipe can't reshuffle mid-gesture.
  const notifSet = React.useRef(
    (variant === "business" ? BUSINESS_NOTIF_SETS : PREMIUM_NOTIF_SETS)[
      upsellNotifSetCount %
        (variant === "business" ? BUSINESS_NOTIF_SETS : PREMIUM_NOTIF_SETS).length
    ]
  );
  useEffect(() => {
    if (content.notifications) upsellNotifSetCount += 1;
  }, [content.notifications]);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  // Dismissal lock. A shared value rather than a ref because the pan gesture's
  // onEnd is a worklet on the UI thread and can't safely read React refs.
  // 1 = still counting down, 0 = free to swipe past.
  const dismissLocked = useSharedValue(1);
  const ringProgress = useSharedValue(1);
  const [secondsLeft, setSecondsLeft] = useState(waitSeconds);

  /**
   * The countdown measures time spent LOOKING at the card, not wall-clock
   * time since it appeared.
   *
   * A plain setTimeout kept running while the user was on the paywall or had
   * the app backgrounded, so opening the paywall, reading it, and backing out
   * skipped the wait entirely — the one action most likely to precede a
   * purchase was also the reliable way to bypass the mechanic. It now pauses
   * whenever the deck isn't focused or the app isn't foregrounded, and
   * resumes from exactly where it stopped.
   */
  const isFocused = useIsFocused();
  useEffect(() => {
    if (!isFocused) return;
    // Back on the deck: re-arm the exit guard and settle the card, in case a
    // gesture was mid-flight when we navigated away.
    handled.current = false;
    translateX.value = 0;
    translateY.value = 0;
  }, [isFocused, translateX, translateY]);

  const [appActive, setAppActive] = useState(AppState.currentState === "active");
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => setAppActive(s === "active"));
    return () => sub.remove();
  }, []);
  const running = isFocused && appActive;

  // Milliseconds of on-card time still owed. Lives in a ref so pausing and
  // resuming doesn't restart the effect from the top.
  const remainingMsRef = useRef(waitSeconds * 1000);
  useEffect(() => {
    remainingMsRef.current = waitSeconds * 1000;
    setSecondsLeft(waitSeconds);
    ringProgress.value = 1;
    dismissLocked.value = 1;
  }, [waitSeconds, ringProgress, dismissLocked]);

  useEffect(() => {
    if (!running) return;
    if (remainingMsRef.current <= 0) return;

    const startedAt = Date.now();
    const startedWith = remainingMsRef.current;

    // Ring drains on the UI thread so it stays smooth under an in-flight
    // gesture. On resume it animates only the remaining fraction, so the arc
    // picks up where it left off rather than snapping back to full.
    ringProgress.value = withTiming(0, {
      duration: startedWith,
      easing: Easing.linear,
    });

    const tick = setInterval(() => {
      const left = Math.max(0, startedWith - (Date.now() - startedAt));
      setSecondsLeft(Math.ceil(left / 1000));
    }, 250);

    const unlock = setTimeout(() => {
      remainingMsRef.current = 0;
      dismissLocked.value = 0;
      setSecondsLeft(0);
    }, startedWith);

    return () => {
      clearInterval(tick);
      clearTimeout(unlock);
      // Freeze: bank the time actually spent looking, and stop the arc where
      // it is rather than letting it keep animating off-screen.
      const spent = Date.now() - startedAt;
      remainingMsRef.current = Math.max(0, startedWith - spent);
      cancelAnimation(ringProgress);
    };
  }, [running, dismissLocked, ringProgress]);

  const ringAnimatedProps = useAnimatedProps(() => ({
    strokeDashoffset: RING_CIRCUMFERENCE * (1 - ringProgress.value),
  }));

  // Guards against onDismiss/onUpgrade firing more than once for a
  // single swipe.
  //
  // Must be re-armed when the card regains focus. The card now survives a
  // trip to the paywall rather than being destroyed on tap, so without this
  // reset the flag set by handleUpgrade was still true on return and every
  // later swipe bailed out at the guard — the card became permanently
  // undismissable. Anything that makes this card outlive a navigation has to
  // reset this too.
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
    // The deck's X button is a dismissal like any other — hold it to the same
    // countdown, or it becomes a one-tap bypass of the whole mechanic.
    if (triggerSwipe === "left" && dismissLocked.value === 1) return;
    const exitX = triggerSwipe === "left" ? -EXIT_X : EXIT_X;
    const onExit = triggerSwipe === "left" ? handleDismiss : handleUpgrade;
    translateX.value = withTiming(exitX, { duration: EXIT_X_DURATION }, () => {
      runOnJS(onExit)();
    });
  }, [triggerSwipe, translateX, handleDismiss, handleUpgrade, dismissLocked]);

  const tapScale = useSharedValue(1);

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY;
    })
    .onEnd((event) => {
      const { translationX, velocityX } = event;
      if (translationX < -SWIPE_X_THRESHOLD || velocityX < -VELOCITY_THRESHOLD) {
        // Dismissal is the only thing the countdown blocks. The card springs
        // back instead of exiting, which reads as "not yet" rather than as a
        // dropped gesture. Upgrading (below, and via tap) is never blocked —
        // paying to skip the wait is the entire mechanic.
        if (dismissLocked.value === 1) {
          translateX.value = withTiming(0, { duration: 200 });
          translateY.value = withTiming(0, { duration: 200 });
          return;
        }
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
            <View style={styles.notifWrap}>
            {!!content.notifLabel && (
              <View style={styles.notifLabelRow}>
                <Bell color="rgba(255,255,255,0.75)" size={12} />
                <Text style={styles.notifLabelText}>{content.notifLabel}</Text>
              </View>
            )}
            <View style={styles.notifArea}>
              {notifSet.current.map((notif, i) => (
                <Animated.View
                  key={notif.body}
                  // Drop in with a spring and a wider stagger, so the stack
                  // reads as notifications arriving one after another rather
                  // than a static image that happened to fade up. This is the
                  // card's only moving part and it's doing the selling — the
                  // user should see them land.
                  entering={FadeInDown.delay(180 + i * 220)
                    .springify()
                    .damping(15)
                    .stiffness(140)}
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
          <View style={styles.bulletList}>
            {/* Short screens take the first two only — the full list would
                push the CTA past the card edge on an SE. */}
            {content.bullets.slice(0, IS_TALL_SCREEN ? 4 : 2).map((bullet) => (
              <View key={bullet.text} style={styles.bulletRow}>
                <Text style={styles.bulletEmoji}>{bullet.emoji}</Text>
                <Text style={styles.bulletText}>{bullet.text}</Text>
              </View>
            ))}
          </View>
          {secondsLeft > 0 && (
            <View style={styles.waitRow}>
              <Svg width={RING_SIZE} height={RING_SIZE}>
                {/* Track */}
                <Circle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={RING_RADIUS}
                  stroke="rgba(255,255,255,0.22)"
                  strokeWidth={RING_STROKE}
                  fill="none"
                />
                {/* Depleting arc. Rotated -90° so it starts at 12 o'clock. */}
                <AnimatedCircle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={RING_RADIUS}
                  stroke="#fff"
                  strokeWidth={RING_STROKE}
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={RING_CIRCUMFERENCE}
                  animatedProps={ringAnimatedProps}
                  transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
                />
              </Svg>
              <Text style={styles.waitText}>
                Swipe past in {secondsLeft}s — or upgrade to skip
              </Text>
            </View>
          )}
          <View
            style={[styles.ctaRow, content.accent ? { backgroundColor: content.accent } : null]}
          >
            <Text style={styles.ctaText}>{ctaLabel}</Text>
            <ArrowRight color="#fff" size={18} />
          </View>
          {ctaSubLabel ? <Text style={styles.ctaSub}>{ctaSubLabel}</Text> : null}
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
    // Centered, not bottom-pinned. When the card went full-bleed the old
    // flex-end pushed the copy to the floor while the flex:1 banner wrapper
    // ate every remaining pixel above it — so the headline sat low and a gap
    // opened in the middle. Centering the banners and copy as one block keeps
    // the spacing between them fixed and splits leftover height evenly top
    // and bottom, which is what makes the headline read as placed rather than
    // pushed.
    justifyContent: "center",
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
  // Absorbs whatever height is left over after the copy block and centers the
  // banner stack in it. Added when the card went full-bleed: the old fixed
  // 52pt margin was tuned for a short fixed-height card, and on a full-height
  // card it left all the extra room as one dead gap in the middle.
  //
  // The flex:1 lives HERE and not on notifArea for the reason below.
  // Natural height, NOT flex:1 — the parent centers the whole group now, so
  // a greedy wrapper here would reopen the gap it was added to close.
  notifWrap: {
    justifyContent: "center",
  },
  notifLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
    paddingLeft: 2,
  },
  notifLabelText: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.75)",
    letterSpacing: 0.3,
    flex: 1,
  },
  notifArea: {
    // Deliberately NOT flex:1. A flex child here gets squeezed toward zero
    // height when the copy needs the room, and its fixed-height banners
    // then overflow *downward* onto the eyebrow pill. Natural height means
    // the banners always push the copy instead of landing on top of it.
    gap: 12,
    marginBottom: 24,
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
  bulletList: {
    marginBottom: 20,
    gap: 8,
  },
  ctaSub: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255,255,255,0.65)",
    textAlign: "center",
    marginTop: 7,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  bulletEmoji: {
    fontSize: 15,
    // Fixed width so the emoji column aligns even though glyph widths differ
    // between platforms — without it the text starts at four different
    // x-positions and the list looks ragged.
    width: 20,
    textAlign: "center",
  },
  bulletText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#fff",
    flex: 1,
  },
  waitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  waitText: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 12,
    fontWeight: "600",
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
