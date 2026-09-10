import React, { useMemo } from "react";
import { View, Text, StyleSheet, useColorScheme } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { Lock, Plane } from "lucide-react-native";
import { colors } from "../../theme/colors";
import type { Deal } from "@trace/shared";

/**
 * The payoff beat: their actual feed, with the paid locks already on.
 *
 * Nothing here is a mockup. The deals are the real response from their home
 * airport and the prices are live — that's the whole reason the screen works.
 *
 * The unlocked sample follows what they just told us in the destination step:
 * domestic-only users get the cheapest domestic fares, international-only
 * users get international, and "both" gets a 3/2 split. Showing a wall of
 * domestic fares to someone who just said "international" wastes the one
 * moment where we know exactly what they want.
 *
 * Note this intentionally diverges from `ExploreScreen`'s free-tier rule
 * (5 cheapest domestic, every international pin locked). That rule governs
 * the free app; this governs a preview shown before anyone reaches the app.
 * They only need to agree if a user can still land in the free tier after
 * onboarding — so if the post-onboarding gate is ever loosened, revisit this.
 *
 * Locked rows keep their destination and image and lose only the price.
 * Hiding the place would remove the wanting; hiding the number is what makes
 * it a lock rather than a wall.
 */
const FREE_UNLOCKED = 5;

interface FeedRevealProps {
  deals: Deal[];
  homeAirport: string;
  firstName: string;
  /** What they picked in the destination step — drives the unlocked sample. */
  destinationPreference: "" | "domestic" | "international" | "both";
  /**
   * Rendered between the title and the hero stat. GatedHome uses it for the
   * preference chips — "what we're matching you on" belongs next to the
   * identity line, not stranded under a long list of deals.
   */
  headerExtra?: React.ReactNode;
  /** Rendered after the locked-count line — the savings/price argument. */
  footerExtra?: React.ReactNode;
}

function isDomestic(d: Deal): boolean {
  return (d.domestic_or_international || "").toLowerCase().includes("domestic");
}

/**
 * Pick what the reveal shows, and what it withholds.
 *
 * Exported and pure so `GatedHomeScreen` can reason about the *same* unlocked
 * set this renders — the savings figure and the barrier answer both describe
 * "the deals below", and a second copy of this logic would drift the moment
 * either side changed.
 */
export function selectRevealDeals(
  deals: Deal[],
  destinationPreference: "" | "domestic" | "international" | "both",
) {
  // One deal per destination — the cheapest — so the list reads as places
  // rather than as duplicate routes.
  const cheapestByDest = new Map<string, Deal>();
  for (const d of deals) {
    if (!d.destination) continue;
    const existing = cheapestByDest.get(d.destination);
    if (!existing || (d.price || Infinity) < (existing.price || Infinity)) {
      cheapestByDest.set(d.destination, d);
    }
  }
  const unique = [...cheapestByDest.values()];

  const byPrice = (a: Deal, b: Deal) => (a.price || 0) - (b.price || 0);
  const domestic = unique.filter(isDomestic).sort(byPrice);
  const intl = unique.filter((d) => !isDomestic(d)).sort(byPrice);

  // Compose the unlocked sample from their stated preference, then backfill
  // from the other bucket so the count holds even for an airport that is
  // thin on one side.
  let picked: Deal[];
  if (destinationPreference === "domestic") {
    picked = [...domestic.slice(0, FREE_UNLOCKED), ...intl];
  } else if (destinationPreference === "international") {
    picked = [...intl.slice(0, FREE_UNLOCKED), ...domestic];
  } else {
    picked = [
      ...domestic.slice(0, 3),
      ...intl.slice(0, 2),
      ...domestic.slice(3),
      ...intl.slice(2),
    ];
  }
  const unlocked = picked.slice(0, FREE_UNLOCKED).sort(byPrice);
  const unlockedSet = new Set(unlocked.map((d) => d.destination));

  const ordered = [
    ...unlocked,
    // Lead the locked run with the biggest discounts — the strongest
    // argument for what is being withheld.
    ...unique
      .filter((d) => !unlockedSet.has(d.destination))
      .sort((a, b) => (b.discount_pct || 0) - (a.discount_pct || 0)),
  ];

  return {
    unlocked,
    rows: ordered.slice(0, 14).map((deal) => ({
      deal,
      locked: !unlockedSet.has(deal.destination),
    })),
    totalDestinations: unique.length,
    cheapest: unlocked[0]?.price ?? unique[0]?.price ?? null,
    lockedIntl: intl.filter((d) => !unlockedSet.has(d.destination)).length,
    unlockedIntl: intl.filter((d) => unlockedSet.has(d.destination)).length,
  };
}

export default function FeedReveal({
  deals,
  homeAirport,
  firstName,
  destinationPreference,
  headerExtra,
  footerExtra,
}: FeedRevealProps) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;

  const { rows, totalDestinations, cheapest, lockedIntl, unlockedIntl } =
    useMemo(
      () => selectRevealDeals(deals, destinationPreference),
      [deals, destinationPreference],
    );

  return (
    <View style={styles.wrap}>
      <Animated.View entering={FadeIn.duration(420)} style={styles.headerBlock}>
        <View style={[styles.badge, { backgroundColor: colors.brand.traceRed }]}>
          <Plane size={15} color="#ffffff" />
          <Text style={styles.badgeText}>{homeAirport}</Text>
        </View>
        <Text style={[styles.title, { color: theme.foreground }]}>
          {firstName ? `${firstName}, your feed is ready` : "Your feed is ready"}
        </Text>
      </Animated.View>

      {headerExtra}

      {/* Hero stat — the number is the hook, and it's theirs. */}
      <Animated.View
        entering={FadeInDown.duration(420).delay(140)}
        style={[styles.statCard, { backgroundColor: theme.muted }]}
      >
        <View style={styles.statMain}>
          <Text style={[styles.statNumber, { color: theme.foreground }]}>
            {totalDestinations}
          </Text>
          <Text style={[styles.statLabel, { color: theme.mutedForeground }]}>
            destinations we're{"\n"}tracking from {homeAirport}
          </Text>
        </View>
        {cheapest != null && (
          <View style={[styles.statDivider, { borderTopColor: theme.border }]}>
            <Text style={[styles.statSub, { color: theme.mutedForeground }]}>
              Cheapest right now
            </Text>
            <Text style={[styles.statPrice, { color: colors.brand.traceRed }]}>
              ${Math.round(cheapest)}
            </Text>
          </View>
        )}
      </Animated.View>

      <View style={styles.rows}>
        {rows.map(({ deal, locked }, i) => (
          <Animated.View
            key={deal.id || `${deal.destination}-${i}`}
            entering={FadeInDown.duration(340).delay(240 + i * 55)}
            style={[
              styles.row,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
                opacity: locked ? 0.72 : 1,
              },
            ]}
          >
            <View style={styles.thumbWrap}>
              {!!deal.image_url && (
                <Image
                  source={{ uri: deal.image_url }}
                  style={styles.thumb}
                  contentFit="cover"
                  transition={220}
                />
              )}
              {locked && (
                <View style={styles.thumbVeil}>
                  <Lock size={15} color="#ffffff" strokeWidth={2.5} />
                </View>
              )}
            </View>

            <View style={styles.rowBody}>
              <Text
                style={[styles.dest, { color: theme.foreground }]}
                numberOfLines={1}
              >
                {deal.destination}
              </Text>
              <Text
                style={[styles.meta, { color: theme.mutedForeground }]}
                numberOfLines={1}
              >
                {isDomestic(deal) ? "Domestic" : "International"}
                {deal.travel_window ? ` · ${deal.travel_window}` : ""}
              </Text>
            </View>

            {locked ? (
              <View style={[styles.lockPill, { backgroundColor: theme.muted }]}>
                <Lock size={12} color={theme.mutedForeground} strokeWidth={2.5} />
                <Text style={[styles.lockPillText, { color: theme.mutedForeground }]}>
                  •••
                </Text>
              </View>
            ) : (
              <View style={styles.priceWrap}>
                <Text style={[styles.price, { color: theme.foreground }]}>
                  ${Math.round(deal.price)}
                </Text>
                {deal.discount_pct > 0 && (
                  <Text style={[styles.off, { color: colors.brand.traceGreen }]}>
                    {Math.round(deal.discount_pct)}% off
                  </Text>
                )}
              </View>
            )}
          </Animated.View>
        ))}

        {/* Fade the tail of the list so the locked run reads as continuing
            past the fold rather than ending. */}
        <LinearGradient
          colors={["transparent", theme.background]}
          style={styles.tailFade}
          pointerEvents="none"
        />
      </View>

      {totalDestinations > FREE_UNLOCKED && (
        <Animated.Text
          entering={FadeIn.duration(400).delay(900)}
          style={[styles.lockedStat, { color: theme.mutedForeground }]}
        >
          You're seeing{" "}
          <Text style={{ color: theme.foreground, fontWeight: "700" }}>
            {FREE_UNLOCKED} of {totalDestinations}
          </Text>{" "}
          destinations
          {/* Only claim the international routes are all locked when they
              actually are — the sample now unlocks some for international
              and "both" users, and an overstated line here is the kind of
              thing a user catches ten seconds later. */}
          {lockedIntl > 0 && unlockedIntl === 0
            ? ` — every one of the ${lockedIntl} international routes is locked`
            : lockedIntl > 0
              ? ` — ${lockedIntl} more international routes still locked`
              : ""}
        </Animated.Text>
      )}

      {footerExtra}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingBottom: 8 },
  headerBlock: { marginBottom: 18 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 12,
  },
  badgeText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -0.7,
    lineHeight: 38,
  },
  statCard: { borderRadius: 22, padding: 20, marginBottom: 20 },
  statMain: { flexDirection: "row", alignItems: "center", gap: 16 },
  statNumber: { fontSize: 52, fontWeight: "800", letterSpacing: -2 },
  statLabel: { fontSize: 15, lineHeight: 20, flex: 1 },
  statDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 16,
    paddingTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statSub: { fontSize: 14 },
  statPrice: { fontSize: 22, fontWeight: "800" },
  rows: { gap: 10, position: "relative" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 10,
    gap: 12,
  },
  thumbWrap: {
    width: 52,
    height: 52,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#00000010",
  },
  thumb: { width: "100%", height: "100%" },
  thumbVeil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  rowBody: { flex: 1, gap: 3 },
  dest: { fontSize: 16, fontWeight: "700" },
  meta: { fontSize: 13 },
  priceWrap: { alignItems: "flex-end", gap: 2 },
  price: { fontSize: 18, fontWeight: "800" },
  off: { fontSize: 12, fontWeight: "700" },
  lockPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
  },
  lockPillText: { fontSize: 13, fontWeight: "800", letterSpacing: 1 },
  tailFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 90,
  },
  lockedStat: {
    fontSize: 15,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 18,
    paddingHorizontal: 8,
  },
});
