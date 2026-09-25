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
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";
import { Bell } from "lucide-react-native";
import { colors } from "../../theme/colors";
import { marqueeRank } from "../../lib/marquee";
import { SHOWCASE_DEALS } from "../../lib/showcaseDeals";
import { fadeTo } from "../../lib/fade";
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
/**
 * The alert stream runs on the shared showcase set — the same cities, prices
 * and images as the landing deck and the swipe demo. It used to keep its own
 * list, which is how Cancún ended up at $269 on the landing screen and $189
 * two screens later. See lib/showcaseDeals.ts.
 */
const ALERTS: {
  destination: string;
  price: number;
  was: number;
  /** Absent on entries backfilled from the user's own feed. */
  image?: string;
}[] = SHOWCASE_DEALS.map((d) => ({
  destination: d.destination,
  price: d.price,
  was: d.was,
  image: d.image,
}));

// Slower and shorter than it was. Four cards arriving every 1.4s read as
// churn rather than coverage — the page is making one point and needs to let
// it land, not prove it repeatedly.
const TICK_MS = 2200;
const VISIBLE = 3;

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

  /**
   * The alert list is the curated set filtered to cities the user's feed
   * actually has a photo for, backfilled from the feed's most recognisable
   * destinations. Curated entries keep their illustrative prices; backfill
   * entries use the real fare. Either way every card wears a real photo —
   * a curated city with no image was rendering as a flat pink box.
   */
  const alerts = useMemo(() => {
    const curated = ALERTS.filter((a) => !!imageFor(a.destination));
    const used = new Set(curated.map((a) => a.destination.toLowerCase()));
    const seen = new Set<string>();
    const backfill = deals
      .filter((d) => d.destination && d.image_url)
      .filter((d) => {
        const k = d.destination.toLowerCase();
        if (used.has(k) || seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .sort((a, b) => marqueeRank(a.destination) - marqueeRank(b.destination))
      .slice(0, Math.max(0, ALERTS.length - curated.length))
      .map((d) => ({
        destination: d.destination,
        price: Math.round(d.price),
        was:
          d.original_price && d.original_price > d.price
            ? Math.round(d.original_price)
            : Math.round(d.price * 2.1),
      }));
    const list = [...curated, ...backfill];
    // Before the feed has loaded there's nothing to match against; show the
    // curated set so the stream starts immediately, and let the images fill
    // in as the fetch lands.
    return list.length >= 4 ? list : ALERTS;
  }, [deals, imageFor]);

  // Rolling window of alerts. New one at the front, oldest falls off.
  const [visible, setVisible] = useState<Alert[]>([]);
  /** Cards the user has tapped open — the page invites a tap, so it answers one. */
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const idxRef = useRef(0);
  const idRef = useRef(0);
  useEffect(() => {
    const push = () => {
      const base = alerts[idxRef.current % alerts.length];
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alerts]);

  return (
    <View style={styles.wrap}>
      {/* Alert stream */}
      <View style={styles.stream}>
        {visible.map((a, i) => {
          const img = a.image || imageFor(a.destination);
          return (
            <Animated.View
              key={a.id}
              entering={FadeInDown.duration(420).springify().damping(20)}
              exiting={FadeOut.duration(260)}
              layout={LinearTransition.duration(340)}
              style={{ opacity: 1 - i * 0.16 }}
            >
            <TouchableOpacity
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`${a.destination}, was $${a.was}, now $${a.price}`}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setRevealed((prev) => {
                  const next = new Set(prev);
                  if (next.has(a.id)) next.delete(a.id);
                  else next.add(a.id);
                  return next;
                });
              }}
              style={[
                styles.alert,
                { backgroundColor: theme.card, borderColor: theme.border },
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
                  <View
                    style={[
                      StyleSheet.absoluteFill,
                      styles.alertPlaceholder,
                      { backgroundColor: colors.brand.traceRed + "1F" },
                    ]}
                  >
                    <Text style={[styles.alertInitial, { color: colors.brand.traceRed }]}>
                      {a.destination.charAt(0)}
                    </Text>
                  </View>
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
                  {revealed.has(a.id)
                    ? `Was $${a.was} — you'd save $${a.was - a.price}`
                    : `was $${a.was} · ${a.minutesAgo}m ago`}
                </Text>
              </View>
            </TouchableOpacity>
            </Animated.View>
          );
        })}
        {/* Fade the tail so the stream reads as continuing off-screen. */}
        <LinearGradient
          colors={fadeTo(theme.background)}
          style={styles.streamFade}
          pointerEvents="none"
        />
      </View>

      <Animated.Text
        entering={FadeIn.duration(400).delay(600)}
        style={[styles.kicker, { color: theme.mutedForeground }]}
      >
        Tap one to see what it was going for.
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
  alertPlaceholder: { alignItems: "center", justifyContent: "center" },
  alertInitial: { fontSize: 20, fontWeight: "800" },
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
  kicker: { fontSize: 15, lineHeight: 22, textAlign: "center", paddingHorizontal: 4 },
});
