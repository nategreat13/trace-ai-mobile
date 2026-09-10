import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { Check, Plane } from "lucide-react-native";
import { colors } from "../../theme/colors";

const CHECKLIST = [
  "Scanning routes from your airport",
  "Matching your travel style",
  "Filtering for your dates",
  "Ranking by savings",
] as const;

/**
 * The "we're setting everything up for you" beat.
 *
 * Two rules govern this screen, and both exist because a fake loader is worse
 * than no loader:
 *
 *  1. It never completes before the real work does. The counter races to 90%
 *     on its own, then *parks* there until `ready` flips. Whatever the deals
 *     API is doing, the user never lands on a reveal screen that has nothing
 *     to reveal.
 *  2. It never finishes early either. Even when the fetch resolves instantly
 *     (warm cache), the screen holds for MIN_MS so the checklist actually
 *     reads. The pause is the point — this is the beat where the flow stops
 *     feeling like a form and starts feeling like something was built.
 */
const MIN_MS = 3200;

/** Size of the plane chip that rides the progress bar. */
const PLANE = 34;

interface BuildingFeedProps {
  /** Flips true when the real deal fetch has resolved (or failed). */
  ready: boolean;
  onDone: () => void;
}

export default function BuildingFeed({ ready, onDone }: BuildingFeedProps) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;

  const [pct, setPct] = useState(0);
  const [ticked, setTicked] = useState(0);
  const startedAt = useRef(Date.now());
  const finishedRef = useRef(false);

  const fill = useSharedValue(0);
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));

  // A plane rides the leading edge of the bar. Measured rather than
  // percentage-positioned so the glyph stays centred on the fill edge instead
  // of drifting off it as the track width changes.
  const [trackWidth, setTrackWidth] = useState(0);
  const planeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: fill.value * Math.max(trackWidth - PLANE, 0) }],
  }));

  // Drive the counter on an interval rather than a single timing animation so
  // the parked-at-90 behaviour is expressible: the ceiling moves only when
  // both gates (elapsed >= MIN_MS, and `ready`) are open.
  useEffect(() => {
    const id = setInterval(() => {
      setPct((prev) => {
        const elapsed = Date.now() - startedAt.current;
        const gatesOpen = ready && elapsed >= MIN_MS;
        const ceiling = gatesOpen ? 100 : 90;
        if (prev >= ceiling) return prev;
        // Ease off as it climbs so the last stretch feels like real work
        // rather than a linear sweep.
        const step = prev < 60 ? 2.4 : prev < 85 ? 1.1 : 0.7;
        return Math.min(ceiling, prev + step);
      });
    }, 40);
    return () => clearInterval(id);
  }, [ready]);

  useEffect(() => {
    fill.value = withTiming(pct / 100, {
      duration: 160,
      easing: Easing.linear,
    });
    // Tick the checklist in step with the counter — each item lands at its
    // own quarter so the list and the bar tell the same story.
    const next = Math.min(CHECKLIST.length, Math.floor(pct / 24));
    if (next > ticked) {
      setTicked(next);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    if (pct >= 100 && !finishedRef.current) {
      finishedRef.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
      setTimeout(onDone, 420);
    }
  }, [pct]);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={["top", "left", "right"]}
    >
      <View style={styles.center}>
        <Animated.Text
          entering={FadeIn.duration(400)}
          style={[styles.pct, { color: theme.foreground }]}
        >
          {Math.round(pct)}%
        </Animated.Text>
        <Animated.Text
          entering={FadeInDown.duration(400).delay(120)}
          style={[styles.headline, { color: theme.foreground }]}
        >
          Building your deal feed
        </Animated.Text>

        <View
          style={styles.trackWrap}
          onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
        >
          <View style={[styles.track, { backgroundColor: theme.border }]}>
            <Animated.View style={[styles.fillWrap, fillStyle]}>
              <LinearGradient
                colors={[colors.brand.traceRed, colors.brand.tracePink]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </View>
          <Animated.View
            style={[
              styles.plane,
              { backgroundColor: theme.background, borderColor: theme.border },
              planeStyle,
            ]}
          >
            <Plane size={17} color={colors.brand.traceRed} strokeWidth={2.4} />
          </Animated.View>
        </View>

        <View style={[styles.card, { backgroundColor: theme.muted }]}>
          {CHECKLIST.map((item, i) => {
            const done = i < ticked;
            return (
              <View key={item} style={styles.checkRow}>
                <View
                  style={[
                    styles.checkCircle,
                    {
                      backgroundColor: done
                        ? colors.brand.traceRed
                        : "transparent",
                      borderColor: done ? colors.brand.traceRed : theme.border,
                    },
                  ]}
                >
                  {done && <Check size={13} color="#ffffff" strokeWidth={3.5} />}
                </View>
                <Text
                  style={[
                    styles.checkLabel,
                    { color: done ? theme.foreground : theme.mutedForeground },
                  ]}
                >
                  {item}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: "center",
  },
  pct: {
    fontSize: 68,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: -2,
  },
  headline: {
    fontSize: 26,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 6,
    marginBottom: 34,
    letterSpacing: -0.5,
  },
  trackWrap: {
    justifyContent: "center",
    height: PLANE,
  },
  track: {
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
  },
  plane: {
    position: "absolute",
    left: 0,
    width: PLANE,
    height: PLANE,
    borderRadius: PLANE / 2,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  fillWrap: {
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
  },
  card: {
    marginTop: 34,
    borderRadius: 20,
    padding: 20,
    gap: 16,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  checkLabel: { fontSize: 15, fontWeight: "500", flex: 1 },
});
