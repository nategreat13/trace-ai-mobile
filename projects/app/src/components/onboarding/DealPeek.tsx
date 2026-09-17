import React from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeIn,
  FadeInDown,
  SlideInDown,
  Easing,
} from "react-native-reanimated";
import { X, Lock, Plane, Calendar, Flame, Sparkles } from "lucide-react-native";
import { colors } from "../../theme/colors";
import type { Deal } from "@trace/shared";

/**
 * A five-second sales sheet for a deal, shown from the gated feed.
 *
 * The full deal page (`ExpandedDeal`) is a utility screen: tabs, meta rows,
 * a guide, a booking tip. It shows the product honestly and sells it badly —
 * wordy, no urgency, and the only conversion action is buried in a footer.
 * This is the opposite: one image, one price against what it usually costs,
 * three facts, one true reason to hurry, two locked teasers, one button.
 *
 * Half-sheet on purpose. A full-screen page invites reading; a sheet invites
 * a decision.
 */
interface DealPeekProps {
  deal: Deal | null;
  homeAirport: string;
  ctaLabel: string;
  onClose: () => void;
  onCta: () => void;
}

function isDomestic(d: Deal): boolean {
  return (d.domestic_or_international || "").toLowerCase().includes("domestic");
}

export default function DealPeek({
  deal,
  homeAirport,
  ctaLabel,
  onClose,
  onCta,
}: DealPeekProps) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;

  if (!deal) return null;

  const pct = Math.round(deal.discount_pct || 0);
  const was = deal.original_price && deal.original_price > deal.price ? deal.original_price : null;

  const facts = [
    deal.travel_window ? { Icon: Calendar, text: deal.travel_window } : null,
    deal.airlines ? { Icon: Plane, text: deal.airlines } : null,
    deal.layover_info
      ? { Icon: Plane, text: deal.layover_info }
      : isDomestic(deal)
        ? null
        : { Icon: Plane, text: "International" },
  ].filter(Boolean) as { Icon: typeof Plane; text: string }[];

  // One true reason to move. Only the API's own urgency flag earns the
  // strong line; everything else gets the honest general one.
  const urgency =
    (deal.urgency || "").toLowerCase() === "high"
      ? "Fares like this usually sell out within 24–48 hours."
      : "Fares like this usually last hours, not days.";

  const teasers = (deal.experiences ?? []).slice(0, 2).map((e) => e.title);

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View entering={FadeIn.duration(200)} style={StyleSheet.absoluteFill} />
      </Pressable>

      <Animated.View
        entering={SlideInDown.duration(340).easing(Easing.out(Easing.cubic))}
        style={[styles.sheet, { backgroundColor: theme.background }]}
      >
        {/* Hero */}
        <View style={styles.hero}>
          {!!deal.image_url && (
            <Image
              source={{ uri: deal.image_url }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={220}
            />
          )}
          <LinearGradient
            colors={["rgba(0,0,0,0.05)", "rgba(0,0,0,0.82)"]}
            style={StyleSheet.absoluteFill}
          />
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={styles.close}
          >
            <X size={18} color="#fff" strokeWidth={2.6} />
          </TouchableOpacity>

          <View style={styles.heroBody}>
            <View style={styles.routePill}>
              <Text style={styles.routeText}>
                {homeAirport} → {deal.destination_code || deal.destination}
              </Text>
            </View>
            <Text style={styles.heroDest} numberOfLines={1}>
              {deal.destination}
            </Text>
            <View style={styles.priceRow}>
              <Text style={styles.heroPrice}>${Math.round(deal.price)}</Text>
              {!!was && <Text style={styles.heroWas}>${Math.round(was)}</Text>}
              {pct > 0 && (
                <View style={styles.offPill}>
                  <Text style={styles.offText}>{pct}% OFF</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <View style={styles.body}>
          {/* Facts */}
          {facts.length > 0 && (
            <Animated.View entering={FadeInDown.duration(320).delay(120)} style={styles.facts}>
              {facts.map(({ Icon, text }, i) => (
                <View key={i} style={[styles.fact, { backgroundColor: theme.muted }]}>
                  <Icon size={13} color={theme.mutedForeground} />
                  <Text style={[styles.factText, { color: theme.foreground }]} numberOfLines={1}>
                    {text}
                  </Text>
                </View>
              ))}
            </Animated.View>
          )}

          {/* Urgency */}
          <Animated.View
            entering={FadeInDown.duration(320).delay(200)}
            style={[styles.urgency, { backgroundColor: colors.brand.traceRed + "12" }]}
          >
            <Flame size={15} color={colors.brand.traceRed} />
            <Text style={[styles.urgencyText, { color: theme.foreground }]}>{urgency}</Text>
          </Animated.View>

          {/* Locked teasers */}
          <Animated.View entering={FadeInDown.duration(320).delay(280)} style={styles.teasers}>
            <Text style={[styles.teaserLabel, { color: theme.mutedForeground }]}>
              IN YOUR {deal.destination.toUpperCase()} GUIDE
            </Text>
            {(teasers.length ? teasers : ["Where to stay", "What to do"]).map((t, i) => (
              <View key={i} style={styles.teaserRow}>
                <Lock size={13} color={theme.mutedForeground} />
                <Text style={[styles.teaserText, { color: theme.mutedForeground }]} numberOfLines={1}>
                  {t}
                </Text>
              </View>
            ))}
            <View style={styles.teaserRow}>
              <Lock size={13} color={theme.mutedForeground} />
              <Text style={[styles.teaserText, { color: theme.mutedForeground }]}>
                Neighbourhoods, day trips, what to avoid…
              </Text>
            </View>
          </Animated.View>
        </View>

        <SafeAreaView edges={["bottom"]} style={styles.footer}>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              onCta();
            }}
            activeOpacity={0.9}
            accessibilityRole="button"
          >
            <LinearGradient
              colors={[colors.brand.traceRed, colors.brand.tracePink]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.cta}
            >
              <Sparkles size={17} color="#fff" />
              <Text style={styles.ctaText}>{ctaLabel}</Text>
            </LinearGradient>
          </TouchableOpacity>
          <Text style={[styles.ctaSub, { color: theme.mutedForeground }]}>
            Unlock this fare, the guide, and every deal after it.
          </Text>
        </SafeAreaView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    overflow: "hidden",
  },
  hero: { height: 210 },
  close: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroBody: { position: "absolute", left: 20, right: 20, bottom: 16, gap: 6 },
  routePill: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  routeText: { color: "#fff", fontSize: 12, fontWeight: "800", letterSpacing: 0.5 },
  heroDest: { color: "#fff", fontSize: 30, fontWeight: "800", letterSpacing: -0.6 },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  heroPrice: { color: "#fff", fontSize: 34, fontWeight: "800", letterSpacing: -1 },
  heroWas: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 18,
    fontWeight: "700",
    textDecorationLine: "line-through",
  },
  offPill: {
    backgroundColor: colors.brand.traceGreen,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  offText: { color: "#fff", fontSize: 12, fontWeight: "900", letterSpacing: 0.4 },
  body: { paddingHorizontal: 20, paddingTop: 16, gap: 14 },
  facts: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  fact: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
    maxWidth: "100%",
  },
  factText: { fontSize: 13, fontWeight: "600" },
  urgency: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  urgencyText: { flex: 1, fontSize: 14, fontWeight: "600", lineHeight: 19 },
  teasers: { gap: 8 },
  teaserLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 0.9, marginBottom: 2 },
  teaserRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  teaserText: { flex: 1, fontSize: 14, fontWeight: "500" },
  footer: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 22, gap: 8 },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    paddingVertical: 17,
  },
  ctaText: { color: "#fff", fontSize: 17, fontWeight: "800" },
  ctaSub: { fontSize: 12, textAlign: "center" },
});
