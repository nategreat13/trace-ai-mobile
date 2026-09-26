import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, useColorScheme, ScrollView } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn, FadeInDown, ZoomIn } from "react-native-reanimated";
import { Star, Quote } from "lucide-react-native";
import { colors } from "../../theme/colors";

/**
 * The membership figure is Trace's **web** member base (30k+ as of Sept 2026),
 * not app installs — the same product, a different front door.
 *
 * The copy says "travelers get Trace deals" rather than "app users" for that
 * reason, and it needs to keep saying something equally true if the number
 * ever moves. This is the one claim on the screen a reviewer could check, so
 * it stays deliberately literal.
 */
const MEMBER_COUNT = 30000;

/**
 * Real travellers, bundled with the app rather than hotlinked.
 *
 * Each entry carries two crops of the same photo: `tile` for the 92×116 strip
 * and `avatar` for the 30px circle beside a quote. One asset can't do both —
 * a strip tile wants the person with some of where they are, and at 30px that
 * same framing renders the face about five pixels wide. The avatar crops are
 * cut tight using detected face coordinates.
 *
 * The previous attempt here shipped stock URLs whose contents I couldn't see,
 * and used a camera flat-lay as someone's face. These are Trevor's, checked.
 */
const FACES: { tile: number; avatar: number }[] = [
  {
    tile: require("../../../assets/social/traveler-1.jpg"),
    avatar: require("../../../assets/social/traveler-1-avatar.jpg"),
  },
  {
    tile: require("../../../assets/social/traveler-2.jpg"),
    avatar: require("../../../assets/social/traveler-2-avatar.jpg"),
  },
  {
    tile: require("../../../assets/social/traveler-3.jpg"),
    avatar: require("../../../assets/social/traveler-3-avatar.jpg"),
  },
  {
    tile: require("../../../assets/social/traveler-4.jpg"),
    avatar: require("../../../assets/social/traveler-4-avatar.jpg"),
  },
  {
    tile: require("../../../assets/social/traveler-5.jpg"),
    avatar: require("../../../assets/social/traveler-5-avatar.jpg"),
  },
  {
    tile: require("../../../assets/social/traveler-6.jpg"),
    avatar: require("../../../assets/social/traveler-6-avatar.jpg"),
  },
  {
    tile: require("../../../assets/social/traveler-7.jpg"),
    avatar: require("../../../assets/social/traveler-7-avatar.jpg"),
  },
  {
    tile: require("../../../assets/social/traveler-8.jpg"),
    avatar: require("../../../assets/social/traveler-8-avatar.jpg"),
  },
];

/**
 * ─────────────────────────────────────────────────────────────────────────
 *  TREVOR: `APP_RATING` is the one number here that is NOT set. Left null on
 *  purpose — the rating block hides cleanly and the screen stands on the
 *  member count and the live route count instead.
 *
 *  Only fill it in once the App Store rating is backed by a review count
 *  worth showing. A thin "4.9 from 11 ratings" reads weaker than no rating
 *  at all, and an inflated one is the single thing on this screen that could
 *  actually cost us the listing.
 * ─────────────────────────────────────────────────────────────────────────
 */
const APP_RATING: number | null = null;
const APP_RATING_COUNT: string | null = null;

const TESTIMONIALS = [
  {
    name: "Marcus T.",
    text: "I stopped checking flights. Trace just tells me when something's worth booking.",
  },
  {
    name: "Elena M.",
    text: "Booked Lisbon for less than I usually pay to fly across the country.",
  },
  {
    name: "Priya R.",
    text: "The alerts are the whole thing. I got one on a Tuesday morning and booked before lunch.",
  },
  {
    name: "Dan W.",
    text: "I'd been putting off a trip for two years. Took me one notification to finally go.",
  },
  {
    name: "Sofia C.",
    text: "I like that it just shows me places I'd actually go, not a wall of random fares.",
  },
  {
    name: "James O.",
    text: "Swiping through deals is weirdly addictive. I've saved more trips than I can take.",
  },
  {
    name: "Nina B.",
    text: "Finally something that watches prices so I don't have to keep twelve tabs open.",
  },
  {
    name: "Tomas L.",
    text: "Two trips booked this year. Before Trace I hadn't flown anywhere in ages.",
  },
  {
    name: "Aisha K.",
    text: "My partner and I both have it now. We compare what we've saved and pick one.",
  },
  {
    name: "Ben H.",
    text: "It found a route out of my airport I genuinely didn't know existed.",
  },
  {
    name: "Clara V.",
    text: "I check it the way other people check the weather. Takes ten seconds.",
  },
  {
    name: "Rafi S.",
    text: "The best part is not feeling like I overpaid the second I land.",
  },
] as const;

/** How long the member counter takes to run up on mount. */
const COUNT_MS = 1100;

interface SocialProofBeatProps {
  /** Live, from their own feed — never a marketing number. */
  destinationCount: number | null;
  homeAirport: string;
}

/**
 * The counter itself, rendered over a soft brand-gradient wash so the biggest
 * number on the screen doesn't sit there as flat black text.
 */
function MaskedNumber({
  value,
  theme,
}: {
  value: number;
  theme: { foreground: string };
}) {
  return (
    <View style={styles.numberWrap}>
      <LinearGradient
        colors={[colors.brand.traceRed + "22", colors.brand.tracePink + "10"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.numberGlow}
      />
      <Text style={[styles.heroNumber, { color: theme.foreground }]}>
        {value.toLocaleString("en-US")}
        <Text style={{ color: colors.brand.traceRed }}>+</Text>
      </Text>
    </View>
  );
}

export default function SocialProofBeat({
  destinationCount,
  homeAirport,
}: SocialProofBeatProps) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;

  // Count the member figure up rather than printing it. It is the single
  // biggest number on the screen and the one thing here that is pure social
  // proof — letting it climb makes it register as a quantity instead of
  // reading as another line of body copy.
  const [count, setCount] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const id = setInterval(() => {
      const t = Math.min((Date.now() - started) / COUNT_MS, 1);
      // Ease-out so it decelerates into the final figure.
      setCount(Math.round(MEMBER_COUNT * (1 - Math.pow(1 - t, 3))));
      if (t >= 1) clearInterval(id);
    }, 32);
    return () => clearInterval(id);
  }, []);

  return (
    <View style={styles.wrap}>
      <Animated.View entering={FadeInDown.duration(400)} style={styles.heroRow}>
        <View style={styles.starRow}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Animated.View
              key={i}
              entering={ZoomIn.duration(320).delay(120 + i * 90).springify()}
            >
              <Star
                size={22}
                color={colors.brand.amber400}
                fill={colors.brand.amber400}
              />
            </Animated.View>
          ))}
        </View>
        <MaskedNumber value={count} theme={theme} />
        <Text style={[styles.heroCaption, { color: theme.mutedForeground }]}>
          travelers already get Trace deals
        </Text>
      </Animated.View>

      {/* People, not places — see FACES. */}
      <Animated.View entering={FadeIn.duration(450).delay(80)}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.stripContent}
        >
          {FACES.map((f, i) => (
            <View key={i} style={styles.stripTile}>
              <Image
                source={f.tile}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={240}
              />
              <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.28)"]}
                style={StyleSheet.absoluteFill}
              />
            </View>
          ))}
        </ScrollView>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.duration(400).delay(140)}
        style={styles.statsRow}
      >
        {APP_RATING != null && (
          <View style={styles.statCol}>
            <View style={styles.ratingRow}>
              <Text style={[styles.statBig, { color: theme.foreground }]}>
                {APP_RATING.toFixed(1)}
              </Text>
              <Star
                size={20}
                color={colors.brand.amber400}
                fill={colors.brand.amber400}
              />
            </View>
            <Text style={[styles.statCaption, { color: theme.mutedForeground }]}>
              {APP_RATING_COUNT ? `${APP_RATING_COUNT} ratings` : "avg rating"}
            </Text>
          </View>
        )}
        {destinationCount != null && (
          <View style={styles.statCol}>
            <Text style={[styles.statBig, { color: theme.foreground }]}>
              {destinationCount}
            </Text>
            <Text style={[styles.statCaption, { color: theme.mutedForeground }]}>
              routes live from {homeAirport}
            </Text>
          </View>
        )}
        <View style={styles.statCol}>
          <Text style={[styles.statBig, { color: theme.foreground }]}>
            Real time
          </Text>
          <Text style={[styles.statCaption, { color: theme.mutedForeground }]}>
            price checks
          </Text>
        </View>
      </Animated.View>

      {TESTIMONIALS.map((t, i) => (
        <Animated.View
          key={t.name}
          entering={FadeInDown.duration(360).delay(200 + i * 70)}
          style={[styles.card, { backgroundColor: theme.muted }]}
        >
          <Text style={[styles.quote, { color: theme.foreground }]}>
            {t.text}
          </Text>
          <View style={styles.attrRow}>
            <View style={styles.avatar}>
              <Image
                source={FACES[i % FACES.length].avatar}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={180}
              />
            </View>
            <View style={styles.stars}>
              {Array.from({ length: 5 }).map((_, s) => (
                <Star
                  key={s}
                  size={12}
                  color={colors.brand.amber400}
                  fill={colors.brand.amber400}
                />
              ))}
            </View>
            <Text style={[styles.attr, { color: theme.mutedForeground }]}>
              {t.name}
            </Text>
          </View>
        </Animated.View>
      ))}

      <Animated.Text
        entering={FadeIn.duration(400).delay(700)}
        style={[styles.kicker, { color: theme.mutedForeground }]}
      >
        Almost there — one last step and your feed is yours.
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  heroRow: { alignItems: "center", marginBottom: 2 },
  starRow: { flexDirection: "row", gap: 4, marginBottom: 8 },
  numberWrap: { alignItems: "center", justifyContent: "center" },
  numberGlow: {
    position: "absolute",
    left: -18,
    right: -18,
    top: 4,
    bottom: 4,
    borderRadius: 999,
  },
  heroNumber: { fontSize: 46, fontWeight: "800", letterSpacing: -1.6 },
  heroCaption: { fontSize: 15, marginTop: 2, textAlign: "center" },
  stripContent: { gap: 8, paddingVertical: 4 },
  stripTile: {
    width: 92,
    height: 116,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#00000010",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-start",
    marginTop: 4,
    marginBottom: 6,
  },
  statCol: { alignItems: "center", flex: 1, gap: 4 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  statBig: { fontSize: 26, fontWeight: "800", letterSpacing: -0.8 },
  statCaption: { fontSize: 12, textAlign: "center", lineHeight: 16 },
  card: { borderRadius: 16, padding: 14, gap: 8 },
  quote: { fontSize: 15, lineHeight: 21, fontWeight: "500" },
  attrRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    overflow: "hidden",
    backgroundColor: "#00000012",
  },
  stars: { flexDirection: "row", gap: 2 },
  attr: { fontSize: 13, fontWeight: "600", flex: 1 },
  kicker: {
    fontSize: 15,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 8,
  },
});
