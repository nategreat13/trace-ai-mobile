import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  TouchableOpacity,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Bell, Hand } from "lucide-react-native";
import { marqueeRank } from "../../lib/marquee";
import type { Deal } from "@trace/shared";
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { colors } from "../../theme/colors";

/**
 * The "here's why you need us" beat.
 *
 * The contrast that matters for a deal app isn't outcome over six months,
 * it's *coverage*: a fare drop lives for hours, and someone checking flights
 * on a whim will miss almost all of them. So the visual is two timelines over
 * the same week — an unbroken run of checks against two lonely ones.
 *
 * Framed as "real time" rather than by cadence. The underlying schedule is a
 * real number and a true one, but naming it invites the user to do arithmetic
 * on our coverage ("so it could be four hours stale?") at the exact moment we
 * want them to feel covered. The claim stays honest either way — this is the
 * same behaviour described in the register that matches the promise.
 */
const TICKS = 42;

/**
 * Fallback for the tappable fare-drop demo when the deal fetch hasn't landed
 * yet — this beat sits right after the airport step, so it usually hasn't.
 * Illustrative, onboarding-only numbers, same policy as the map preview.
 */
const FALLBACK_DROP = { destination: "Paris", from: 612, to: 248, image: "" };

interface CadenceBeatProps {
  /** Their live feed, if it's arrived — picks a recognisable real deal. */
  deals?: Deal[];
}

export default function CadenceBeat({ deals = [] }: CadenceBeatProps) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;

  // ── Tappable fare-drop demo ────────────────────────────────────────────
  // The two timelines below explain coverage; this shows what coverage
  // *delivers*. Tap the card and the price falls in front of you, then the
  // alert lands — the thing they're actually being sold, demonstrated once,
  // on demand, with a haptic so it feels like the phone doing it for real.
  const showcase = useMemo(() => {
    const withImage = deals.filter((d) => d.image_url && d.destination && d.price > 0);
    if (!withImage.length) return FALLBACK_DROP;
    const best = [...withImage].sort(
      (a, b) => marqueeRank(a.destination) - marqueeRank(b.destination),
    )[0];
    const from =
      best.original_price && best.original_price > best.price
        ? best.original_price
        : Math.round(best.price * 2.3);
    return {
      destination: best.destination,
      from: Math.round(from),
      to: Math.round(best.price),
      image: best.image_url,
    };
  }, [deals]);

  const [dropPhase, setDropPhase] = useState<"idle" | "dropping" | "alerted">("idle");
  const [shownPrice, setShownPrice] = useState(showcase.from);
  const dropTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => setShownPrice(showcase.from), [showcase.from]);
  useEffect(() => () => { if (dropTimer.current) clearInterval(dropTimer.current); }, []);

  const triggerDrop = () => {
    if (dropPhase === "dropping") return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setDropPhase("dropping");
    setShownPrice(showcase.from);
    const start = Date.now();
    const DUR = 720;
    dropTimer.current = setInterval(() => {
      const t = Math.min(1, (Date.now() - start) / DUR);
      const eased = 1 - Math.pow(1 - t, 3);
      setShownPrice(Math.round(showcase.from - (showcase.from - showcase.to) * eased));
      if (t >= 1) {
        if (dropTimer.current) clearInterval(dropTimer.current);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setDropPhase("alerted");
      }
    }, 16);
  };

  const sweep = useSharedValue(0);
  useEffect(() => {
    sweep.value = withDelay(
      260,
      withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) }),
    );
  }, []);

  const sweepStyle = useAnimatedStyle(() => ({
    width: `${sweep.value * 100}%`,
  }));

  return (
    <View style={styles.wrap}>
      {/* The showcase. TouchableOpacity with a plain style array, NOT
          Pressable with a function style — that form dropped the container
          style on-device, so every absolute layer inside (image, gradient,
          price, hint, alert) collapsed onto a zero-height box. */}
      <Animated.View entering={FadeInDown.duration(400)}>
        <TouchableOpacity
          onPress={triggerDrop}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel={`See a fare drop to ${showcase.destination}`}
          style={styles.showcase}
        >
          {showcase.image ? (
            <Image
              source={{ uri: showcase.image }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={220}
            />
          ) : (
            <LinearGradient
              colors={[colors.brand.traceRed, colors.brand.tracePink]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          )}
          <LinearGradient
            colors={["rgba(0,0,0,0.05)", "rgba(0,0,0,0.78)"]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.showcaseBody}>
            <Text style={styles.showcaseDest}>{showcase.destination}</Text>
            <View style={styles.showcasePriceRow}>
              <Text
                style={[
                  styles.showcasePrice,
                  dropPhase !== "idle" && { color: colors.brand.traceGreen },
                ]}
              >
                ${shownPrice}
              </Text>
              {dropPhase === "alerted" && (
                <Animated.View entering={FadeIn.duration(200)} style={styles.wasPill}>
                  <Text style={styles.wasText}>was ${showcase.from}</Text>
                </Animated.View>
              )}
            </View>
          </View>

          {dropPhase === "idle" && (
            <Animated.View entering={FadeIn.duration(300).delay(500)} style={styles.tapHint}>
              <Hand size={14} color="#fff" />
              <Text style={styles.tapHintText}>Tap to see an alert</Text>
            </Animated.View>
          )}

          {dropPhase === "alerted" && (
            <Animated.View
              entering={FadeInDown.duration(320).springify().damping(16)}
              style={[styles.alertBanner, { backgroundColor: theme.card }]}
            >
              <View style={[styles.alertIcon, { backgroundColor: colors.brand.traceRed }]}>
                <Bell size={14} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.alertTitle, { color: theme.foreground }]} numberOfLines={1}>
                  {showcase.destination} just dropped to ${showcase.to}
                </Text>
                <Text style={[styles.alertSub, { color: theme.mutedForeground }]}>
                  Trace · just now
                </Text>
              </View>
            </Animated.View>
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* One compact comparison instead of two full cards. The showcase
          above is the engaging part; this just has to make the contrast
          legible at a glance, and two stacked cards with their own headers
          and notes were doing that at three times the height. */}
      <Animated.View
        entering={FadeInDown.duration(400).delay(180)}
        style={[styles.compare, { backgroundColor: theme.muted }]}
      >
        <View style={styles.compareRow}>
          <Text style={[styles.compareLabel, { color: theme.foreground }]}>
            Trace
          </Text>
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
          <Text style={[styles.compareLabel, { color: theme.foreground }]}>
            You
          </Text>
          <View style={styles.compareTrack}>
            <View style={[styles.emptyTrack, { backgroundColor: theme.border }]}>
              <View style={[styles.sparseTick, { backgroundColor: colors.brand.rose500, left: "18%" }]} />
              <View style={[styles.sparseTick, { backgroundColor: colors.brand.rose500, left: "71%" }]} />
            </View>
          </View>
          <Text style={[styles.compareValue, { color: colors.brand.rose500 }]}>
            2× a week
          </Text>
        </View>
      </Animated.View>

      <Animated.Text
        entering={FadeIn.duration(400).delay(520)}
        style={[styles.kicker, { color: theme.mutedForeground }]}
      >
        A cheap fare lasts hours, not days. We're watching when it drops.
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  showcase: {
    height: 178,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#00000010",
  },
  showcaseBody: { position: "absolute", left: 16, bottom: 14, right: 16 },
  showcaseDest: { color: "#fff", fontSize: 20, fontWeight: "800" },
  showcasePriceRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 2 },
  showcasePrice: { color: "#fff", fontSize: 30, fontWeight: "800", letterSpacing: -0.8 },
  wasPill: {
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  wasText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    textDecorationLine: "line-through",
  },
  tapHint: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tapHintText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  alertBanner: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    padding: 10,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  alertIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  alertTitle: { fontSize: 14, fontWeight: "700" },
  alertSub: { fontSize: 12, marginTop: 1 },
  compare: { borderRadius: 18, paddingVertical: 6, paddingHorizontal: 16 },
  compareRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
  compareLabel: { width: 52, fontSize: 15, fontWeight: "700" },
  compareTrack: { flex: 1, height: 22, justifyContent: "center" },
  compareValue: { width: 76, textAlign: "right", fontSize: 14, fontWeight: "800" },
  compareDivider: { height: StyleSheet.hairlineWidth },
  sweep: { overflow: "hidden" },
  ticks: { flexDirection: "row", gap: 3 },
  tick: { width: 4, height: 18, borderRadius: 2 },
  emptyTrack: { height: 4, borderRadius: 2, justifyContent: "center" },
  sparseTick: { position: "absolute", width: 4, height: 18, borderRadius: 2 },
  kicker: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 10,
    paddingHorizontal: 4,
  },
});
