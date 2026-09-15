import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  ScrollView,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { ChevronLeft } from "lucide-react-native";
import { colors } from "../../theme/colors";

/**
 * The shell every onboarding beat renders inside.
 *
 * Replaces the old dot-row + "Back / Continue" split footer with the layout
 * the Sept 2026 rebuild is built around: a single continuous progress bar, a
 * circular back affordance, a large left-aligned title, and one full-width
 * CTA pinned to the bottom.
 *
 * Why a bar instead of dots: the flow went from 5 steps to ~13, and 13 dots
 * read as "this is long" at exactly the moment we need it to read as "you're
 * nearly there." A bar communicates proportion instead of count.
 *
 * `progress` is 0..1 and is passed in rather than derived from a step index,
 * because several beats (the reveal, the build screen) are not questions and
 * shouldn't advance the bar the same amount as a question does.
 */
interface OnboardingChromeProps {
  progress: number;
  title?: string;
  subtitle?: string;
  ctaLabel?: string;
  canProceed?: boolean;
  /**
   * Keep the CTA disabled for this long after the beat appears. The button
   * visibly fills over the period so it reads as "coming", not "broken".
   * Restarts whenever `holdKey` changes, so each beat gets its own hold.
   */
  holdMs?: number;
  holdKey?: string;
  onNext: () => void;
  onBack?: () => void;
  /** Hide the bar + back affordance entirely (used by the full-bleed beats). */
  chromeless?: boolean;
  /** Let the content own its own scrolling (the reveal does). */
  scrollable?: boolean;
  children?: React.ReactNode;
  /** Rendered between the content and the CTA — e.g. the trial reassurance line. */
  footerNote?: React.ReactNode;
}

export default function OnboardingChrome({
  progress,
  title,
  subtitle,
  ctaLabel = "Continue",
  canProceed = true,
  holdMs = 0,
  holdKey,
  onNext,
  onBack,
  chromeless = false,
  scrollable = true,
  children,
  footerNote,
}: OnboardingChromeProps) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;
  // The SafeAreaView below deliberately excludes the bottom edge (the footer
  // owns its own spacing), so the home-indicator inset has to be added here
  // by hand. A fixed padding was guesswork and still read as clipped on a
  // notched device — this measures it instead.
  const insets = useSafeAreaInsets();

  // Animate the bar between beats rather than snapping. The width is driven
  // off a shared value so the fill glides while the new content fades in —
  // the two motions overlapping is most of what makes the flow feel built
  // rather than assembled.
  const barProgress = useSharedValue(progress);
  React.useEffect(() => {
    barProgress.value = withTiming(progress, {
      duration: 420,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${Math.max(0, Math.min(1, barProgress.value)) * 100}%`,
  }));

  // Timed hold. `held` gates the button; `holdFill` sweeps a lighter band
  // across it so the wait is legible. A dead-looking button for two seconds
  // is the one way a forced pause turns into a support ticket.
  const [held, setHeld] = React.useState(holdMs > 0);
  const holdFill = useSharedValue(0);
  React.useEffect(() => {
    if (holdMs <= 0) {
      setHeld(false);
      return;
    }
    setHeld(true);
    holdFill.value = 0;
    holdFill.value = withTiming(1, { duration: holdMs, easing: Easing.linear });
    const t = setTimeout(() => {
      setHeld(false);
      Haptics.selectionAsync().catch(() => {});
    }, holdMs);
    return () => clearTimeout(t);
  }, [holdMs, holdKey]);
  const holdFillStyle = useAnimatedStyle(() => ({
    width: `${holdFill.value * 100}%`,
  }));
  const proceed = canProceed && !held;

  const Body = scrollable ? ScrollView : View;
  const bodyProps = scrollable
    ? {
        contentContainerStyle: styles.scrollContent,
        showsVerticalScrollIndicator: false,
        keyboardShouldPersistTaps: "handled" as const,
      }
    : { style: styles.staticBody };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={["top", "left", "right"]}
    >
      {!chromeless && (
        <View style={styles.topRow}>
          {onBack ? (
            <TouchableOpacity
              onPress={onBack}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={[styles.backCircle, { backgroundColor: theme.muted }]}
            >
              <ChevronLeft size={22} color={theme.foreground} />
            </TouchableOpacity>
          ) : (
            <View style={styles.backCircle} />
          )}
          <View style={[styles.barTrack, { backgroundColor: theme.border }]}>
            <Animated.View
              style={[
                styles.barFill,
                { backgroundColor: colors.brand.traceRed },
                barStyle,
              ]}
            />
          </View>
        </View>
      )}

      <Body {...(bodyProps as any)}>
        {/* The header is deliberately NOT animated. It used to spring in on
            every beat, and a bounce that repeats ten times in a row stops
            reading as polish and starts reading as a tic — the content below
            still fades, which is enough to make the transition feel alive. */}
        {!!title && (
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.foreground }]}>
              {title}
            </Text>
            {!!subtitle && (
              <Text style={[styles.subtitle, { color: theme.mutedForeground }]}>
                {subtitle}
              </Text>
            )}
          </View>
        )}
        <Animated.View entering={FadeIn.duration(260)} style={styles.content}>
          {children}
        </Animated.View>
      </Body>

      <View
        style={[
          styles.footer,
          {
            borderTopColor: theme.border,
            paddingBottom: Math.max(insets.bottom, 12) + 18,
          },
        ]}
      >
        {footerNote}
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
              () => {},
            );
            onNext();
          }}
          disabled={!proceed}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityState={{ disabled: !proceed }}
          style={[
            styles.cta,
            {
              backgroundColor: colors.brand.traceRed,
              opacity: proceed ? 1 : held ? 0.55 : 0.4,
            },
          ]}
        >
          {held && (
            <Animated.View
              pointerEvents="none"
              style={[styles.holdFill, holdFillStyle]}
            />
          )}
          <Text style={styles.ctaText}>{ctaLabel}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  backCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  barTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  barFill: {
    height: 6,
    borderRadius: 3,
  },
  scrollContent: {
    // Generous, because several beats end on a line of text rather than a
    // control — at 24 the proof screen's closing line sat under the footer
    // border at rest and only appeared if you thought to scroll.
    paddingBottom: 44,
    flexGrow: 1,
  },
  staticBody: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 4,
  },
  title: {
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -0.8,
    lineHeight: 40,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 23,
    marginTop: 10,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 22,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 14,
    // paddingBottom is applied inline from the safe-area inset.
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  cta: {
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  holdFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(255,255,255,0.28)",
  },
  ctaText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "700",
  },
});
