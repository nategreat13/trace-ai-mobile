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
import { funnelDeals } from "../../lib/funnelDeals";
import type { RankPrefs } from "../../lib/dealRanker";
import type { Deal } from "@trace/shared";

/**
 * Trace watches in real time; you check twice a week.
 *
 * The comparison is the argument, so it's the top of the page — and it
 * answers a tap, because a big graphic that looks interactive and isn't
 * reads as broken. Tapping replays the sweep and names what each track
 * actually means.
 *
 * Underneath, three alerts rather than one. A single example didn't look
 * like a stream of drops, it looked like the one deal we had.
 *
 * Both the three destinations and their prices come from `funnelDeals`, the
 * one place the whole pre-purchase funnel gets its deals from, so what's
 * shown here is exactly what the demo deck, the map and the gated feed show.
 */
const TICKS = 42;
/** Alerts to show. Selection and pricing both live in lib/funnelDeals. */
const ALERTS = 3;


interface CadenceBeatProps {
  /** Live deals for the user's airport; falls back to the showcase set. */
  deals?: Deal[];
  /** Onboarding answers, so these are the drops they'd care about. */
  prefs?: RankPrefs;
}

interface Alert {
  id: string;
  destination: string;
  price: number;
  was: number;
  image: string;
  minutesAgo: number;
}

export default function CadenceBeat({ deals = [], prefs = {} }: CadenceBeatProps) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;

  const alerts = useMemo<Alert[]>(
    () =>
      funnelDeals(deals, prefs, ALERTS).map((d, i) => ({
        id: d.id ?? `${d.destination}-${i}`,
        destination: d.destination as string,
        price: d.price || 0,
        was: d.original_price || 0,
        image: d.image_url as string,
        // Staggered so the three read as a stream rather than a batch.
        minutesAgo: 4 + i * 9,
      })),
    [deals, prefs],
  );

  /** Which alert has had its saving revealed. */
  const [openId, setOpenId] = useState<string | null>(null);
  /** Whether the comparison card is showing its detail labels. */
  const [explained, setExplained] = useState(false);

  // The dense Trace track sweeps in once, so the contrast arrives as motion
  // rather than sitting there as a static bar chart. Tapping replays it.
  const sweep = useSharedValue(0);
  const runSweep = (delay: number) => {
    sweep.value = 0;
    sweep.value = withDelay(
      delay,
      withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) }),
    );
  };
  useEffect(() => {
    runSweep(320);
  }, []);
  const sweepStyle = useAnimatedStyle(() => ({ width: `${sweep.value * 100}%` }));

  return (
    <View style={styles.wrap}>
      <Animated.View entering={FadeInDown.duration(400)}>
        <TouchableOpacity
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel="Trace checks in real time; you check about twice a week"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            setExplained((v) => !v);
            runSweep(0);
          }}
          style={[styles.compare, { backgroundColor: theme.muted }]}
        >
          <View style={styles.compareRow}>
            <View style={styles.compareLabelCol}>
              <Text style={[styles.compareLabel, { color: theme.foreground }]}>
                Trace
              </Text>
              {explained && (
                <Animated.Text
                  entering={FadeIn.duration(220)}
                  style={[styles.compareDetail, { color: theme.mutedForeground }]}
                >
                  every 10 min
                </Animated.Text>
              )}
            </View>
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
            <View style={styles.compareLabelCol}>
              <Text style={[styles.compareLabel, { color: theme.foreground }]}>You</Text>
              {explained && (
                <Animated.Text
                  entering={FadeIn.duration(220)}
                  style={[styles.compareDetail, { color: theme.mutedForeground }]}
                >
                  if you remember
                </Animated.Text>
              )}
            </View>
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

          <Text style={[styles.tapHint, { color: theme.mutedForeground }]}>
            {explained ? "Every gap is a fare you never saw." : "Tap to compare"}
          </Text>
        </TouchableOpacity>
      </Animated.View>

      <Animated.Text
        entering={FadeIn.duration(400).delay(420)}
        style={[styles.kicker, { color: theme.mutedForeground }]}
      >
        A cheap fare lasts hours, not days. Almost every drop happens in the gap
        between your checks.
      </Animated.Text>

      <View style={styles.alerts}>
        {alerts.map((a, i) => {
          const open = openId === a.id;
          const saving = a.was - a.price;
          return (
            <Animated.View
              key={a.id}
              entering={FadeInDown.duration(380).delay(560 + i * 130)}
            >
              <TouchableOpacity
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={`${a.destination}, was $${a.was}, now $${a.price}`}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  setOpenId(open ? null : a.id);
                }}
                style={[
                  styles.alert,
                  { backgroundColor: theme.card, borderColor: theme.border },
                ]}
              >
                <View style={styles.alertThumb}>
                  <Image
                    source={{ uri: a.image }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={200}
                  />
                  <View style={styles.alertBell}>
                    <Bell size={10} color="#fff" strokeWidth={2.8} />
                  </View>
                </View>
                <View style={styles.alertBody}>
                  <Text
                    style={[styles.alertTitle, { color: theme.foreground }]}
                    numberOfLines={1}
                  >
                    {a.destination} dropped to{" "}
                    <Text style={{ color: colors.brand.traceGreen }}>${a.price}</Text>
                  </Text>
                  <Text
                    style={[styles.alertSub, { color: theme.mutedForeground }]}
                    numberOfLines={1}
                  >
                    {open
                      ? `Was $${a.was} — you'd save $${saving}`
                      : `was $${a.was} · ${a.minutesAgo}m ago · tap to see the saving`}
                  </Text>
                </View>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 18 },
  compare: { borderRadius: 18, paddingVertical: 8, paddingHorizontal: 16 },
  compareRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  compareLabelCol: { width: 62 },
  compareLabel: { fontSize: 15, fontWeight: "700" },
  compareDetail: { fontSize: 10.5, marginTop: 1 },
  compareTrack: { flex: 1, height: 22, justifyContent: "center" },
  compareValue: { width: 78, textAlign: "right", fontSize: 14, fontWeight: "800" },
  compareDivider: { height: StyleSheet.hairlineWidth },
  sweep: { overflow: "hidden" },
  ticks: { flexDirection: "row", gap: 3 },
  tick: { width: 4, height: 18, borderRadius: 2 },
  emptyTrack: { height: 4, borderRadius: 2, justifyContent: "center" },
  sparseTick: { position: "absolute", width: 4, height: 18, borderRadius: 2 },
  tapHint: {
    fontSize: 11.5,
    fontWeight: "600",
    textAlign: "center",
    paddingBottom: 10,
    paddingTop: 2,
  },
  kicker: { fontSize: 15.5, lineHeight: 23, paddingHorizontal: 2 },
  alerts: { gap: 10 },
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
