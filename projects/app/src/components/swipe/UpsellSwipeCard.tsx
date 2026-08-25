import React, { useCallback, useEffect } from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  runOnJS,
} from "react-native-reanimated";
import { useIsFocused } from "@react-navigation/native";
import { useFreeTrial } from "../../context/TrialContext";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Crown, Bell, Lock, ArrowRight } from "lucide-react-native";
import { colors } from "../../theme/colors";
import type { Deal } from "@trace/shared";

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
  /**
   * A real deal from the user's own deck to tease, partially redacted
   * (destination + discount hidden behind a scrim). Replaces the old fake,
   * identical-for-everyone notification stack — real and incomplete creates
   * curiosity, fake and complete reads as an ad. `null` when nothing
   * qualifies (e.g. an empty deck) — the section is omitted rather than
   * falling back to invented content.
   */
  previewDeal?: Deal | null;
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
    headline: "Never miss\na price drop.",
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
    // "No ads, no interruptions" is honest: this card itself is the
    // interruption being sold away, and it's the one they're looking at
    // right now.
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
    // Caption above the redacted real-deal preview (see previewDeal prop).
    previewCaption: "A deal from your deck just dropped:",
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
    // A quick-stats row (65% / 48h / $2.4K) lived here at one point. Retired
    // along with "48h early access" and "$2.4K avg saved/yr" — neither had
    // anything backing it, so nothing accurate was lost.
    //
    // The cabin photo stays as the backdrop for the redacted real-deal
    // preview below — it already carries a scrim, and the block reads fine
    // over the darkened lower half.
    previewCaption: "A business-class deal from your deck just dropped:",
  },
};

// Shown instead of the standard premium pitch for the first upsell card of a
// session, to a free user who's been away a few days — same mechanism, same
// visual (the redacted real-deal preview already sells "alerts, any
// destination"), just loss-aversion framing instead of the generic pitch.
// No discount lever available, so this leans entirely on "you missed
// something" rather than price.
const WELCOME_BACK_CONTENT: (typeof CONTENT)["premium"] = {
  ...CONTENT.premium,
  eyebrow: "WHILE YOU WERE AWAY",
  headline: "New deals dropped\nsince your last visit.",
  sub: "Turn on Premium alerts and never miss the next one.",
};

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
  previewDeal,
}: UpsellSwipeCardProps) {
  const baseContent = variant === "welcome_back" ? WELCOME_BACK_CONTENT : CONTENT[variant];
  const content = personalizedSub ? { ...baseContent, sub: personalizedSub } : baseContent;

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

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  // Card now survives a trip to the paywall rather than being destroyed on
  // tap, so it needs to re-settle and re-arm its exit guard when it regains
  // focus (a gesture could have been mid-flight when navigation happened).
  const isFocused = useIsFocused();
  useEffect(() => {
    if (!isFocused) return;
    handled.current = false;
    translateX.value = 0;
    translateY.value = 0;
  }, [isFocused, translateX, translateY]);

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
          {!!previewDeal && (
            <View style={styles.previewWrap}>
              <View style={styles.previewLabelRow}>
                <Bell color="rgba(255,255,255,0.75)" size={12} />
                <Text style={styles.previewLabelText}>{content.previewCaption}</Text>
              </View>
              <View style={styles.previewBanner}>
                {/* Real destination + discount, genuinely present — just
                    dimmed rather than replaced by a placeholder. Same scrim
                    technique WeatherPreview.tsx uses for its premium-gated
                    rows: no expo-blur (native module, forces a runtimeVersion
                    bump), so a layered translucent fill instead. Wrapped in
                    its own block rather than inline spans — RN can't overlay
                    part of a Text node, only a whole View. */}
                <View style={{ position: "relative" }}>
                  <Text style={styles.previewRedactedText} numberOfLines={1}>
                    {previewDeal.destination} · {Math.round(previewDeal.discount_pct || 0)}% off
                  </Text>
                  <View style={[StyleSheet.absoluteFillObject, styles.previewScrim]} pointerEvents="none" />
                </View>
                <View style={styles.previewUnlockRow}>
                  <Lock color="#fff" size={12} />
                  <Text style={styles.previewUnlockText}>Unlock to see which one</Text>
                </View>
              </View>
            </View>
          )}
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
  // Absorbs whatever height is left over above the copy block and centers
  // the preview in it — same role the old notification stack's wrapper had.
  previewWrap: {
    justifyContent: "center",
    marginBottom: 24,
  },
  previewLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
    paddingLeft: 2,
  },
  previewLabelText: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.75)",
    letterSpacing: 0.3,
    flex: 1,
  },
  previewBanner: {
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  previewRedactedText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  // Real text renders normally above (previewRedactedText) — this scrim
  // sits over just that block so it's genuinely present, just dimmed, not
  // replaced by a placeholder. No expo-blur (forces a runtimeVersion bump);
  // same layered-fill technique as WeatherPreview.tsx's premium gate.
  previewScrim: {
    backgroundColor: "rgba(10,10,18,0.82)",
    borderRadius: 6,
  },
  previewUnlockRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  previewUnlockText: {
    fontSize: 12,
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
