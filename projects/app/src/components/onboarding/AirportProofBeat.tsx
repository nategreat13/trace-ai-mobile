import React, { useEffect, useMemo } from "react";
import { View, Text, StyleSheet, useColorScheme } from "react-native";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { colors } from "../../theme/colors";
import type { Deal } from "@trace/shared";

/**
 * The first real fare, shown the moment we know where they fly from.
 *
 * Before this beat existed, the earliest a user saw an actual price from
 * their own airport was the feed reveal — about eight screens and a minute
 * of questions later. Everything in between asked them for something
 * (style, timing, what's stopping you) while giving nothing back, and the
 * single most persuasive fact we hold was sitting in a response that had
 * already arrived.
 *
 * So this is the payoff for typing three letters: their airport, the number
 * of destinations live from it, and the cheapest fare on the board right
 * now with the photo of where it goes.
 *
 * The fetch starts as they leave the airport step, so this screen is usually
 * the thing that waits on it rather than the other way round. That wait is
 * the point rather than a problem — "checking live fares from SLC" is a
 * truthful description of what's happening, and it makes the number that
 * lands feel measured rather than printed.
 */
interface AirportProofBeatProps {
  deals: Deal[];
  /** Flips true on success *or* failure, so this never strands the user. */
  ready: boolean;
  homeAirport: string;
}

export default function AirportProofBeat({
  deals,
  ready,
  homeAirport,
}: AirportProofBeatProps) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;

  const { cheapest, destinations, avgDiscount } = useMemo(() => {
    const priced = deals.filter((d) => (d.price || 0) > 0);
    const best = priced.length
      ? priced.reduce((a, b) => ((a.price || 0) <= (b.price || 0) ? a : b))
      : null;
    const discounts = deals
      .map((d) => d.discount_pct || 0)
      .filter((p) => p > 0);
    return {
      cheapest: best,
      destinations: new Set(deals.map((d) => d.destination).filter(Boolean))
        .size,
      avgDiscount: discounts.length
        ? Math.round(discounts.reduce((a, b) => a + b, 0) / discounts.length)
        : 0,
    };
  }, [deals]);

  const landed = ready && !!cheapest;

  // A small thud when the number arrives. The screen has been claiming to
  // check prices; the result should feel like it lands rather than appears.
  useEffect(() => {
    if (landed) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
  }, [landed]);

  // Pulse only while waiting.
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (landed) {
      pulse.value = withTiming(0, { duration: 200 });
      return;
    }
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 720, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 720, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [landed]);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: 0.35 + pulse.value * 0.4 }));

  if (!landed) {
    return (
      <View style={styles.wrap}>
        <Animated.View
          style={[
            styles.hero,
            pulseStyle,
            { backgroundColor: theme.muted, borderColor: theme.border },
          ]}
        >
          <View style={[styles.skelLine, { backgroundColor: theme.border, width: "46%" }]} />
          <View style={[styles.skelLine, { backgroundColor: theme.border, width: "72%", height: 14 }]} />
        </Animated.View>
        <Text style={[styles.waiting, { color: theme.mutedForeground }]}>
          {homeAirport
            ? `Checking live fares from ${homeAirport}…`
            : "Checking live fares…"}
        </Text>
      </View>
    );
  }

  const deal = cheapest!;
  const saving =
    (deal.original_price || 0) > (deal.price || 0)
      ? (deal.original_price || 0) - (deal.price || 0)
      : 0;

  return (
    <View style={styles.wrap}>
      <Animated.View
        entering={FadeInDown.duration(420)}
        style={[styles.hero, { backgroundColor: theme.muted }]}
      >
        <Text style={[styles.heroLabel, { color: theme.mutedForeground }]}>
          CHEAPEST FROM {homeAirport} RIGHT NOW
        </Text>
        <View style={styles.heroRow}>
          <Text style={[styles.heroPrice, { color: colors.brand.traceRed }]}>
            ${deal.price}
          </Text>
          <View style={styles.heroWhere}>
            <Text
              style={[styles.heroDest, { color: theme.foreground }]}
              numberOfLines={1}
            >
              {deal.destination}
            </Text>
            {saving > 0 && (
              <Text style={[styles.heroSaving, { color: colors.brand.traceGreen }]}>
                ${saving} below its usual fare
              </Text>
            )}
          </View>
        </View>

        {deal.image_url ? (
          <View style={styles.photo}>
            <Image
              source={{ uri: deal.image_url }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={260}
            />
          </View>
        ) : null}
      </Animated.View>

      <Animated.View entering={FadeIn.duration(400).delay(220)} style={styles.stats}>
        <View style={styles.stat}>
          <Text style={[styles.statBig, { color: theme.foreground }]}>
            {destinations}
          </Text>
          <Text style={[styles.statCaption, { color: theme.mutedForeground }]}>
            destinations live{"\n"}from {homeAirport}
          </Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
        <View style={styles.stat}>
          <Text style={[styles.statBig, { color: theme.foreground }]}>
            {avgDiscount > 0 ? `${avgDiscount}%` : "Live"}
          </Text>
          <Text style={[styles.statCaption, { color: theme.mutedForeground }]}>
            {avgDiscount > 0
              ? `average saving\non those fares`
              : `prices, checked\naround the clock`}
          </Text>
        </View>
      </Animated.View>

      <Animated.Text
        entering={FadeIn.duration(400).delay(340)}
        style={[styles.kicker, { color: theme.mutedForeground }]}
      >
        A few questions and we'll narrow these to the ones you'd actually book.
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 18 },
  hero: { borderRadius: 20, padding: 18, gap: 12 },
  heroLabel: { fontSize: 11.5, fontWeight: "800", letterSpacing: 0.7 },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  heroPrice: { fontSize: 52, fontWeight: "800", letterSpacing: -2 },
  heroWhere: { flex: 1, gap: 3 },
  heroDest: { fontSize: 22, fontWeight: "800", letterSpacing: -0.4 },
  heroSaving: { fontSize: 13.5, fontWeight: "700" },
  photo: {
    height: 150,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#00000010",
  },
  stats: { flexDirection: "row", alignItems: "center" },
  stat: { flex: 1, alignItems: "center", gap: 4 },
  statDivider: { width: StyleSheet.hairlineWidth, height: 40 },
  statBig: { fontSize: 26, fontWeight: "800", letterSpacing: -0.8 },
  statCaption: { fontSize: 12, lineHeight: 16, textAlign: "center" },
  kicker: { fontSize: 15, lineHeight: 22, textAlign: "center" },
  skelLine: { height: 34, borderRadius: 8 },
  waiting: { fontSize: 14.5, textAlign: "center" },
});
