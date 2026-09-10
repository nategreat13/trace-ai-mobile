import React, { useEffect } from "react";
import { View, Text, StyleSheet, useColorScheme } from "react-native";
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

export default function CadenceBeat() {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;

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
      {/* Ours — dense, animated sweep */}
      <Animated.View
        entering={FadeInDown.duration(400)}
        style={[styles.card, { backgroundColor: theme.muted }]}
      >
        <View style={styles.cardHead}>
          <Text style={[styles.cardTitle, { color: theme.foreground }]}>
            Trace checks
          </Text>
          <Text style={[styles.cardValue, { color: colors.brand.traceGreen }]}>
            Real time
          </Text>
        </View>
        <View style={styles.trackRow}>
          <Animated.View style={[styles.sweep, sweepStyle]}>
            <View style={styles.ticks}>
              {Array.from({ length: TICKS }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.tick,
                    { backgroundColor: colors.brand.traceGreen },
                  ]}
                />
              ))}
            </View>
          </Animated.View>
        </View>
        <Text style={[styles.cardNote, { color: theme.mutedForeground }]}>
          On every route you care about, around the clock
        </Text>
      </Animated.View>

      {/* Theirs — sparse */}
      <Animated.View
        entering={FadeInDown.duration(400).delay(220)}
        style={[styles.card, { backgroundColor: theme.muted }]}
      >
        <View style={styles.cardHead}>
          <Text style={[styles.cardTitle, { color: theme.foreground }]}>
            Checking on your own
          </Text>
          <Text style={[styles.cardValue, { color: colors.brand.rose500 }]}>
            2× a week
          </Text>
        </View>
        <View style={styles.trackRow}>
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
        <Text style={[styles.cardNote, { color: theme.mutedForeground }]}>
          Most fare drops are gone before you look
        </Text>
      </Animated.View>

      <Animated.Text
        entering={FadeIn.duration(400).delay(620)}
        style={[styles.kicker, { color: theme.mutedForeground }]}
      >
        A cheap fare usually lasts hours, not days. The difference isn't how
        hard you look — it's whether anyone's watching when it drops.
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  card: { borderRadius: 20, padding: 18 },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  cardValue: { fontSize: 16, fontWeight: "800" },
  trackRow: { height: 26, justifyContent: "center" },
  sweep: { overflow: "hidden" },
  ticks: { flexDirection: "row", gap: 3 },
  tick: { width: 4, height: 22, borderRadius: 2 },
  emptyTrack: {
    height: 4,
    borderRadius: 2,
    justifyContent: "center",
  },
  sparseTick: {
    position: "absolute",
    width: 4,
    height: 22,
    borderRadius: 2,
  },
  cardNote: { fontSize: 13, marginTop: 12, lineHeight: 18 },
  kicker: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 10,
    paddingHorizontal: 4,
  },
});
