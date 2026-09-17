import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, useColorScheme } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { Bell } from "lucide-react-native";
import { colors } from "../../theme/colors";
import type { Deal } from "@trace/shared";

/**
 * The "deals don't wait for you" beat — Trace in real time vs. you, twice a
 * week, shown rather than told.
 *
 * A stream of alert cards rolls in, one every ~1.4s: a recognisable city, a
 * price that just dropped, a timestamp a few minutes old. Underneath, a
 * compact strip contrasts that stream with the two lonely times a week a
 * person checks on their own. The contrast is the whole argument.
 *
 * The alerts are ILLUSTRATIVE — marquee cities at prices that make the
 * point, not bookable fares. The previous version hung this page on a single
 * real deal from the user's feed, which meant the pitch was only as good as
 * whatever happened to be cheapest that day (it was $1,096 to Tokyo). Real
 * imagery is still used where the user's feed has a photo for the city, so
 * the cards look like the product; the numbers are the demo's.
 */
const ALERTS: { destination: string; price: number; was: number }[] = [
  { destination: "Lisbon", price: 312, was: 780 },
  { destination: "Cancún", price: 189, was: 512 },
  { destination: "Tokyo", price: 448, was: 1180 },
  { destination: "Rome", price: 389, was: 940 },
  { destination: "Honolulu", price: 297, was: 690 },
  { destination: "Paris", price: 362, was: 870 },
  { destination: "Barcelona", price: 341, was: 810 },
  { destination: "Mexico City", price: 178, was: 430 },
];

const TICK_MS = 1400;
const VISIBLE = 4;
const TICKS = 42;

interface CadenceBeatProps {
  /** Used only to borrow a real photo for a city when the feed has one. */
  deals?: Deal[];
}

type Alert = (typeof ALERTS)[number] & { id: number; minutesAgo: number };

export default function CadenceBeat({ deals = [] }: CadenceBeatProps) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;

  // City → image from the user's real feed, so the cards wear the product's
  // own photography even though the prices are illustrative.
  const imageFor = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of deals) {
      if (!d.destination || !d.image_url) continue;
      const key = d.destination.toLowerCase();
      if (!map.has(key)) map.set(key, d.image_url);
    }
    return (city: string) => {
      const k = city.toLowerCase();
      for (const [name, url] of map) {
        if (name.includes(k) || k.includes(name)) return url;
      }
      return null;
    };
  }, [deals]);

  // Rolling window of alerts. New one at the front, oldest falls off.
  const [visible, setVisible] = useState<Alert[]>([]);
  const idxRef = useRef(0);
  const idRef = useRef(0);
  useEffect(() => {
    const push = () => {
      const base = ALERTS[idxRef.current % ALERTS.length];
      idxRef.current += 1;
      idRef.current += 1;
      const next: Alert = {
        ...base,
        id: idRef.current,
        minutesAgo: 1 + Math.floor(Math.random() * 6),
      };
      setVisible((prev) => [next, ...prev].slice(0, VISIBLE));
      // A tick for the first few arrivals only — enough to feel live, not
      // enough to become a metronome.
      if (idRef.current <= 3) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
    };
    push();
    const id = setInterval(push, TICK_MS);
    return () => clearInterval(id);
  }, []);

  // The dense "Trace" tick-track sweeps in once.
  const sweep = useSharedValue(0);
  useEffect(() => {
    sweep.value = withDelay(
      300,
      withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) }),
    );
  }, []);
  const sweepStyle = useAnimatedStyle(() => ({ width: `${sweep.value * 100}%` }));

  return (
    <View style={styles.wrap}>
      {/* Alert stream */}
      <View style={styles.stream}>
        {visible.map((a, i) => {
          const img = imageFor(a.destination);
          return (
            <Animated.View
              key={a.id}
              entering={FadeInDown.duration(360).springify().damping(18)}
              exiting={FadeOut.duration(220)}
              layout={LinearTransition.duration(320)}
              style={[
                styles.alert,
                {
                  backgroundColor: theme.card,
                  borderColor: theme.border,
                  opacity: 1 - i * 0.18,
                },
              ]}
            >
              <View style={styles.alertThumb}>
                {img ? (
                  <Image
                    source={{ uri: img }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={200}
                  />
                ) : (
                  <LinearGradient
                    colors={[colors.brand.traceRed, colors.brand.tracePink]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                )}
                <View style={styles.alertBell}>
                  <Bell size={10} color="#fff" strokeWidth={2.6} />
                </View>
              </View>
              <View style={styles.alertBody}>
                <Text style={[styles.alertTitle, { color: theme.foreground }]} numberOfLines={1}>
                  {a.destination} just dropped to{" "}
                  <Text style={{ color: colors.brand.traceGreen }}>${a.price}</Text>
                </Text>
                <Text style={[styles.alertSub, { color: theme.mutedForeground }]} numberOfLines={1}>
                  was ${a.was} · {a.minutesAgo}m ago
                </Text>
              </View>
            </Animated.View>
          );
        })}
        {/* Fade the tail so the stream reads as continuing off-screen. */}
        <LinearGradient
          colors={["transparent", theme.background]}
          style={styles.streamFade}
          pointerEvents="none"
        />
      </View>

      {/* Compact contrast strip */}
      <Animated.View
        entering={FadeInDown.duration(400).delay(260)}
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
        entering={FadeIn.duration(400).delay(600)}
        style={[styles.kicker, { color: theme.mutedForeground }]}
      >
        A cheap fare lasts hours, not days. We're watching when it drops.
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  stream: { gap: 10, minHeight: 4 * 66 + 3 * 10, position: "relative" },
  streamFade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 70 },
  alert: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 10,
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
  alertSub: { fontSize: 12 },
  compare: { borderRadius: 18, paddingVertical: 6, paddingHorizontal: 16 },
  compareRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  compareLabel: { width: 52, fontSize: 15, fontWeight: "700" },
  compareTrack: { flex: 1, height: 22, justifyContent: "center" },
  compareValue: { width: 76, textAlign: "right", fontSize: 14, fontWeight: "800" },
  compareDivider: { height: StyleSheet.hairlineWidth },
  sweep: { overflow: "hidden" },
  ticks: { flexDirection: "row", gap: 3 },
  tick: { width: 4, height: 18, borderRadius: 2 },
  emptyTrack: { height: 4, borderRadius: 2, justifyContent: "center" },
  sparseTick: { position: "absolute", width: 4, height: 18, borderRadius: 2 },
  kicker: { fontSize: 15, lineHeight: 22, textAlign: "center", paddingHorizontal: 4 },
});
