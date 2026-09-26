import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, useColorScheme, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { Bell } from "lucide-react-native";
import { colors } from "../../theme/colors";
import { SHOWCASE_DEALS } from "../../lib/showcaseDeals";
import type { Deal } from "@trace/shared";

/**
 * Trace watches in real time; you check twice a week.
 *
 * The comparison is the argument, and it's back to being the whole page. A
 * previous pass replaced it with a rolling stream of alert cards, which made
 * the same point less clearly and — more to the point — duplicated the swipe
 * beat, where three alerts already arrive as the payoff. Two screens showing
 * notifications is why this one started reading as redundant.
 *
 * Division of labour now: this beat argues why watching matters, the swipe
 * beat shows what it feels like when it pays off. One example alert stays
 * here as an illustration, and it's tappable — a card that sits there
 * inviting a tap should answer one.
 */
const TICKS = 42;

interface CadenceBeatProps {
  /** Used only to borrow a real photo for the example, where the feed has one. */
  deals?: Deal[];
}

export default function CadenceBeat({ deals = [] }: CadenceBeatProps) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;

  /** One illustrative drop, from the shared showcase set. */
  const example = useMemo(() => {
    const pick =
      SHOWCASE_DEALS.find((d) => d.was - d.price > 400) ?? SHOWCASE_DEALS[0];
    const fromFeed = deals.find(
      (d) =>
        d.destination?.toLowerCase() === pick.destination.toLowerCase() &&
        d.image_url,
    );
    return { ...pick, image: fromFeed?.image_url || pick.image };
  }, [deals]);

  const [revealed, setRevealed] = useState(false);

  // The dense Trace track sweeps in once, so the contrast arrives as motion
  // rather than sitting there as a static bar chart.
  const sweep = useSharedValue(0);
  useEffect(() => {
    sweep.value = withDelay(
      320,
      withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) }),
    );
  }, []);
  const sweepStyle = useAnimatedStyle(() => ({ width: `${sweep.value * 100}%` }));

  return (
    <View style={styles.wrap}>
      <Animated.View
        entering={FadeInDown.duration(400)}
        style={[styles.compare, { backgroundColor: theme.muted }]}
      >
        <View style={styles.compareRow}>
          <Text style={[styles.compareLabel, { color: theme.foreground }]}>Trace</Text>
          <View style={styles.compareTrack}>
            <Animated.View style={[styles.sweep, sweepStyle]}>
              <View style={styles.ticks}>
                {Array.from({ length: TICKS }).map((_, i) => (
                  <View
                    key={i}
                    style={[styles.tick, { backgroundColor: colors.brand.traceGreen }]}
                  />
                ))}
              </View>
            </Animated.View>
          </View>
          <Text style={[styles.compareValue, { color: colors.brand.traceGreen }]}>
            Real time
          </Text>
        </View>

        <View style={[styles.compareDivider, { backgroundColor: theme.border }]} />

        <View style={styles.compareRow}>
          <Text style={[styles.compareLabel, { color: theme.foreground }]}>You</Text>
          <View style={styles.compareTrack}>
            <View style={[styles.emptyTrack, { backgroundColor: theme.border }]}>
              <View
                style={[
                  styles.sparseTick,
                  { backgroundColor: colors.brand.rose500, left: "18%" },
                ]}
              />
              <View
                style={[
                  styles.sparseTick,
                  { backgroundColor: colors.brand.rose500, left: "71%" },
                ]}
              />
            </View>
          </View>
          <Text style={[styles.compareValue, { color: colors.brand.rose500 }]}>
            2× a week
          </Text>
        </View>
      </Animated.View>

      <Animated.Text
        entering={FadeIn.duration(400).delay(420)}
        style={[styles.kicker, { color: theme.mutedForeground }]}
      >
        A cheap fare lasts hours, not days. Almost every drop happens in the gap
        between your checks.
      </Animated.Text>

      <Animated.View entering={FadeInDown.duration(400).delay(560)}>
        <TouchableOpacity
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`${example.destination}, was $${example.was}, now $${example.price}`}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            setRevealed((v) => !v);
          }}
          style={[styles.alert, { backgroundColor: theme.card, borderColor: theme.border }]}
        >
          <View style={styles.alertThumb}>
            <Image
              source={{ uri: example.image }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={200}
            />
            <View style={styles.alertBell}>
              <Bell size={10} color="#fff" strokeWidth={2.8} />
            </View>
          </View>
          <View style={styles.alertBody}>
            <Text style={[styles.alertTitle, { color: theme.foreground }]} numberOfLines={1}>
              {example.destination} dropped to{" "}
              <Text style={{ color: colors.brand.traceGreen }}>${example.price}</Text>
            </Text>
            <Text
              style={[styles.alertSub, { color: theme.mutedForeground }]}
              numberOfLines={1}
            >
              {revealed
                ? `Was $${example.was} — you'd save $${example.was - example.price}`
                : `was $${example.was} · 4m ago · tap to see the saving`}
            </Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 20 },
  compare: { borderRadius: 18, paddingVertical: 8, paddingHorizontal: 16 },
  compareRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 },
  compareLabel: { width: 52, fontSize: 15, fontWeight: "700" },
  compareTrack: { flex: 1, height: 22, justifyContent: "center" },
  compareValue: { width: 78, textAlign: "right", fontSize: 14, fontWeight: "800" },
  compareDivider: { height: StyleSheet.hairlineWidth },
  sweep: { overflow: "hidden" },
  ticks: { flexDirection: "row", gap: 3 },
  tick: { width: 4, height: 18, borderRadius: 2 },
  emptyTrack: { height: 4, borderRadius: 2, justifyContent: "center" },
  sparseTick: { position: "absolute", width: 4, height: 18, borderRadius: 2 },
  kicker: { fontSize: 15.5, lineHeight: 23, paddingHorizontal: 2 },
  alert: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 11,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  alertThumb: {
    width: 46,
    height: 46,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#00000010",
  },
  alertBell: {
    position: "absolute",
    right: 3,
    bottom: 3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.brand.traceRed,
    alignItems: "center",
    justifyContent: "center",
  },
  alertBody: { flex: 1, gap: 2 },
  alertTitle: { fontSize: 15, fontWeight: "700" },
  alertSub: { fontSize: 12.5 },
});
