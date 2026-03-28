import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  StyleSheet,
  useColorScheme,
  StatusBar,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import {
  X,
  Clock,
  Plane,
  Bookmark,
  ExternalLink,
  Sparkles,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Deal } from "@trace/shared";
import { colors } from "../../theme/colors";
import { API_BASE_URL } from "../../lib/constants";
import WeatherPreview from "./WeatherPreview";
import DealExperiences from "./DealExperiences";
import DealInterestingFacts from "./DealInterestingFacts";
import DealQuickTips from "./DealQuickTips";
import DealTravelTips from "./DealTravelTips";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const HERO_HEIGHT = SCREEN_HEIGHT * 0.5;

// ── Props ───────────────────────────────────────────────────────────────────
interface ExpandedDealProps {
  deal: Deal;
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
  onBook: () => void;
  userProfile?: any;
}

// ── Helper: parse travel_tips / interesting_facts string[] into objects ──────
function parseStringArray(
  items: string[] | undefined
): { title: string; description: string }[] {
  if (!items || items.length === 0) return [];
  return items.map((item) => {
    // Try splitting on colon or dash for title/description
    const colonIdx = item.indexOf(":");
    const dashIdx = item.indexOf(" - ");
    if (colonIdx > 0 && colonIdx < 60) {
      return {
        title: item.slice(0, colonIdx).trim(),
        description: item.slice(colonIdx + 1).trim(),
      };
    }
    if (dashIdx > 0 && dashIdx < 60) {
      return {
        title: item.slice(0, dashIdx).trim(),
        description: item.slice(dashIdx + 3).trim(),
      };
    }
    // No clear separator -- use the whole string as description
    return { title: "", description: item };
  });
}

export default function ExpandedDeal({
  deal,
  visible,
  onClose,
  onSave,
  onBook,
  userProfile,
}: ExpandedDealProps) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;
  const insets = useSafeAreaInsets();

  const [fitSummary, setFitSummary] = useState<string | null>(null);
  const [fitLoading, setFitLoading] = useState(false);
  const firstName = (userProfile?.displayName || "").split(" ")[0] || null;

  useEffect(() => {
    if (!visible || !userProfile || !deal) return;
    setFitSummary(null);
    setFitLoading(true);
    fetch(`${API_BASE_URL}/ai/deal-fit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deal, profile: userProfile }),
    })
      .then((r) => r.json())
      .then((data) => setFitSummary(data.summary || null))
      .catch(() => setFitSummary(null))
      .finally(() => setFitLoading(false));
  }, [visible, deal?.id]);

  if (!deal) return null;

  // Parse string-based arrays into structured objects for sub-components
  const travelTipObjects = parseStringArray(deal.travel_tips);
  const factObjects = parseStringArray(deal.interesting_facts);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" />
      <Animated.View
        entering={FadeIn.duration(300)}
        style={[styles.container, { backgroundColor: theme.background }]}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
          bounces
        >
          {/* ── Hero Image ────────────────────────────────────────────── */}
          <View style={styles.heroContainer}>
            <Image
              source={{ uri: deal.image_url }}
              style={styles.heroImage}
              contentFit="cover"
              transition={200}
            />
            <LinearGradient
              colors={[
                "transparent",
                "rgba(17,24,39,0.3)",
                "rgba(17,24,39,0.9)",
              ]}
              locations={[0, 0.5, 1]}
              style={StyleSheet.absoluteFillObject}
            />

            {/* Close button */}
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeButton, { top: insets.top + 12 }]}
              activeOpacity={0.8}
            >
              <X size={22} color="#1a1a1a" strokeWidth={2.5} />
            </TouchableOpacity>

            {/* Destination overlay */}
            <View style={styles.heroOverlay}>
              <View style={styles.routeBadge}>
                <Text style={styles.routeText}>
                  {deal.origin} {"\u2192"} {deal.destination_code}
                </Text>
              </View>
              <Text style={styles.destinationText}>{deal.destination}</Text>
              {!!deal.travel_window && (
                <View style={styles.travelWindowRow}>
                  <Clock size={14} color="rgba(255,255,255,0.8)" />
                  <Text style={styles.travelWindowText}>
                    {deal.travel_window}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* ── Content ───────────────────────────────────────────────── */}
          <View style={styles.contentContainer}>
            {/* Price Card */}
            <View
              style={[
                styles.priceCard,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              <View style={styles.priceRow}>
                <View>
                  <Text
                    style={[styles.priceLabel, { color: theme.mutedForeground }]}
                  >
                    Sale Price
                  </Text>
                  <Text style={[styles.priceValue, { color: theme.foreground }]}>
                    ${deal.price}
                  </Text>
                  {deal.original_price > 0 && deal.original_price !== deal.price && (
                    <Text
                      style={[
                        styles.originalPrice,
                        { color: theme.mutedForeground },
                      ]}
                    >
                      ${deal.original_price}
                    </Text>
                  )}
                </View>
                {deal.discount_pct > 0 && (
                  <View style={styles.discountBadge}>
                    <Text style={styles.discountText}>
                      {deal.discount_pct}% OFF
                    </Text>
                  </View>
                )}
              </View>
              {!!deal.best_time_to_book && (
                <View
                  style={[styles.bookTipRow, { borderTopColor: theme.border }]}
                >
                  <Text
                    style={[styles.bookTipText, { color: theme.mutedForeground }]}
                  >
                    {deal.best_time_to_book}
                  </Text>
                </View>
              )}
            </View>

            {/* Flight Details */}
            {(deal.origin ||
              deal.destination_code ||
              deal.duration ||
              deal.layover_info) && (
              <View
                style={[
                  styles.flightCard,
                  { backgroundColor: theme.card, borderColor: theme.border },
                ]}
              >
                {/* Header */}
                <View
                  style={[
                    styles.flightHeader,
                    { borderBottomColor: theme.border },
                  ]}
                >
                  <Plane size={14} color={theme.mutedForeground} />
                  <Text
                    style={[
                      styles.flightHeaderText,
                      { color: theme.mutedForeground },
                    ]}
                  >
                    FLIGHT DETAILS
                  </Text>
                </View>

                {/* Route row */}
                {(deal.origin || deal.destination_code) && (
                  <View
                    style={[
                      styles.routeRow,
                      { borderBottomColor: theme.border },
                    ]}
                  >
                    <View style={styles.routeEndpoint}>
                      <Text
                        style={[
                          styles.routeCode,
                          { color: theme.foreground },
                        ]}
                      >
                        {deal.origin || "\u2014"}
                      </Text>
                      <Text
                        style={[
                          styles.routeSubLabel,
                          { color: theme.mutedForeground },
                        ]}
                      >
                        Origin
                      </Text>
                    </View>

                    <View style={styles.routeMiddle}>
                      <View style={styles.routeLine}>
                        <View
                          style={[
                            styles.dashedLine,
                            { borderBottomColor: theme.border },
                          ]}
                        />
                        <Plane
                          size={14}
                          color={colors.brand.traceRed}
                        />
                        <View
                          style={[
                            styles.dashedLine,
                            { borderBottomColor: theme.border },
                          ]}
                        />
                      </View>
                      {!!deal.duration && (
                        <Text
                          style={[
                            styles.durationText,
                            { color: theme.mutedForeground },
                          ]}
                        >
                          {deal.duration}
                        </Text>
                      )}
                    </View>

                    <View style={styles.routeEndpoint}>
                      <Text
                        style={[
                          styles.routeCode,
                          { color: theme.foreground },
                        ]}
                      >
                        {deal.destination_code ||
                          deal.destination?.slice(0, 3).toUpperCase() ||
                          "\u2014"}
                      </Text>
                      <Text
                        style={[
                          styles.routeSubLabel,
                          { color: theme.mutedForeground },
                        ]}
                      >
                        Destination
                      </Text>
                    </View>
                  </View>
                )}

                {/* Meta rows */}
                {!!deal.travel_window && (
                  <View
                    style={[
                      styles.metaRow,
                      { borderBottomColor: theme.border },
                    ]}
                  >
                    <Text
                      style={[
                        styles.metaLabel,
                        { color: theme.mutedForeground },
                      ]}
                    >
                      Travel window
                    </Text>
                    <Text
                      style={[styles.metaValue, { color: theme.foreground }]}
                    >
                      {deal.travel_window}
                    </Text>
                  </View>
                )}
                {!!deal.layover_info && (
                  <View
                    style={[
                      styles.metaRow,
                      { borderBottomColor: theme.border },
                    ]}
                  >
                    <Text
                      style={[
                        styles.metaLabel,
                        { color: theme.mutedForeground },
                      ]}
                    >
                      Layovers
                    </Text>
                    <Text
                      style={[
                        styles.metaValue,
                        { color: theme.foreground, textAlign: "right", flex: 1 },
                      ]}
                    >
                      {deal.layover_info}
                    </Text>
                  </View>
                )}
                {!!deal.price_will_last && (
                  <View style={styles.metaRow}>
                    <Text
                      style={[
                        styles.metaLabel,
                        { color: theme.mutedForeground },
                      ]}
                    >
                      Price valid
                    </Text>
                    <Text
                      style={[
                        styles.metaValue,
                        { color: theme.foreground, textAlign: "right", flex: 1 },
                      ]}
                    >
                      {deal.price_will_last}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Weather */}
            <WeatherPreview deal={deal} />

            {/* Personal AI fit */}
            {(fitLoading || fitSummary) && (
              <View
                style={[
                  styles.fitCard,
                  {
                    backgroundColor: scheme === "dark" ? "rgba(255,101,91,0.08)" : "rgba(255,101,91,0.05)",
                    borderColor: scheme === "dark" ? "rgba(255,101,91,0.3)" : "rgba(255,101,91,0.2)",
                  },
                ]}
              >
                <View style={styles.fitHeader}>
                  <View style={styles.fitIconWrap}>
                    <Sparkles size={15} color="#ffffff" />
                  </View>
                  <Text style={[styles.fitLabel, { color: colors.brand.traceRed }]}>
                    {firstName ? `AI fit for ${firstName}` : "Your AI fit"}
                  </Text>
                </View>
                {fitLoading ? (
                  <View style={styles.fitLoadingRow}>
                    <View style={[styles.fitPulseDot, { backgroundColor: colors.brand.traceRed }]} />
                    <Text style={[styles.fitLoadingText, { color: theme.mutedForeground }]}>
                      {firstName ? `Analyzing this deal for ${firstName}…` : "Analyzing your fit…"}
                    </Text>
                  </View>
                ) : (
                  <Animated.Text
                    entering={FadeIn.duration(400)}
                    style={[styles.fitText, { color: theme.foreground }]}
                  >
                    {fitSummary}
                  </Animated.Text>
                )}
              </View>
            )}

            {/* AI Insight */}
            {(!!deal.ai_insight || !!deal.vibe_description) && (
              <View
                style={[
                  styles.aiCard,
                  {
                    backgroundColor: scheme === "dark"
                      ? "rgba(139,92,246,0.08)"
                      : "rgba(139,92,246,0.05)",
                    borderColor: scheme === "dark"
                      ? "rgba(139,92,246,0.25)"
                      : "rgba(139,92,246,0.15)",
                  },
                ]}
              >
                <View style={styles.aiHeader}>
                  <View style={styles.aiIconWrap}>
                    <Sparkles size={16} color="#ffffff" />
                  </View>
                  <Text
                    style={[
                      styles.aiLabel,
                      {
                        color: scheme === "dark" ? "#a78bfa" : "#7c3aed",
                      },
                    ]}
                  >
                    AI Insight
                  </Text>
                </View>
                {!!deal.ai_insight && (
                  <Text
                    style={[
                      styles.aiText,
                      { color: theme.foreground },
                    ]}
                  >
                    {deal.ai_insight}
                  </Text>
                )}
                {!!deal.vibe_description && (
                  <Text
                    style={[
                      styles.vibeText,
                      { color: theme.mutedForeground },
                    ]}
                  >
                    {deal.vibe_description}
                  </Text>
                )}
              </View>
            )}

            {/* Experiences */}
            {deal.experiences && deal.experiences.length > 0 && (
              <DealExperiences experiences={deal.experiences} />
            )}

            {/* Interesting Facts */}
            {deal.interesting_facts && deal.interesting_facts.length > 0 && (
              <DealInterestingFacts facts={factObjects} />
            )}

            {/* Quick Tips */}
            {deal.quick_tips && deal.quick_tips.length > 0 && (
              <DealQuickTips tips={deal.quick_tips} />
            )}

            {/* Travel Tips */}
            {deal.travel_tips && deal.travel_tips.length > 0 && (
              <DealTravelTips tips={travelTipObjects} />
            )}
          </View>
        </ScrollView>

        {/* ── Bottom action buttons ───────────────────────────────────── */}
        <View
          style={[
            styles.bottomBar,
            {
              paddingBottom: insets.bottom + 16,
              backgroundColor: theme.background,
              borderTopColor: theme.border,
            },
          ]}
        >
          <View style={styles.buttonRow}>
            <TouchableOpacity
              onPress={onSave}
              activeOpacity={0.8}
              style={[
                styles.saveButton,
                {
                  backgroundColor: theme.card,
                  borderColor: theme.border,
                },
              ]}
            >
              <Bookmark size={16} color={theme.foreground} />
              <Text style={[styles.saveButtonText, { color: theme.foreground }]}>
                Save
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onBook}
              activeOpacity={0.8}
              style={styles.bookButton}
            >
              <LinearGradient
                colors={[colors.brand.traceRed, colors.brand.tracePink]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.bookGradient}
              >
                <ExternalLink size={16} color="#ffffff" />
                <Text style={styles.bookButtonText}>Book Now</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },

  // ── Hero ────────────────────────────────────────────────────────────────
  heroContainer: {
    height: HERO_HEIGHT,
    width: "100%",
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
  },
  closeButton: {
    position: "absolute",
    right: 16,
    zIndex: 40,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 10,
    padding: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  heroOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
  },
  routeBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 8,
  },
  routeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  destinationText: {
    fontSize: 44,
    fontWeight: "900",
    color: "#ffffff",
    marginBottom: 8,
    letterSpacing: -0.5,
    lineHeight: 48,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  travelWindowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  travelWindowText: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255,255,255,0.9)",
  },

  // ── Content ─────────────────────────────────────────────────────────────
  contentContainer: {
    padding: 20,
    gap: 20,
  },

  // ── Price card ──────────────────────────────────────────────────────────
  priceCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  priceLabel: {
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 4,
  },
  priceValue: {
    fontSize: 40,
    fontWeight: "900",
  },
  originalPrice: {
    fontSize: 13,
    textDecorationLine: "line-through",
    marginTop: 4,
  },
  discountBadge: {
    backgroundColor: "rgba(0,214,101,0.15)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  discountText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#15803d",
  },
  bookTipRow: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  bookTipText: {
    fontSize: 12,
  },

  // ── Flight card ─────────────────────────────────────────────────────────
  flightCard: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  flightHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  flightHeaderText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  routeEndpoint: {
    alignItems: "center",
  },
  routeCode: {
    fontSize: 22,
    fontWeight: "900",
  },
  routeSubLabel: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 2,
  },
  routeMiddle: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 4,
  },
  routeLine: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    gap: 4,
  },
  dashedLine: {
    flex: 1,
    borderBottomWidth: 2,
    borderStyle: "dashed",
  },
  durationText: {
    fontSize: 11,
    fontWeight: "600",
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  metaLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  metaValue: {
    fontSize: 13,
    fontWeight: "600",
  },

  // ── Personal fit card ───────────────────────────────────────────────────
  fitCard: {
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
  },
  fitHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  fitIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.brand.traceRed,
  },
  fitLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  fitLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  fitPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    opacity: 0.7,
  },
  fitLoadingText: {
    fontSize: 13,
    fontStyle: "italic",
  },
  fitText: {
    fontSize: 14,
    lineHeight: 22,
  },

  // ── AI Insight card ─────────────────────────────────────────────────────
  aiCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
  },
  aiHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  aiIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#8b5cf6",
  },
  aiLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  aiText: {
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 8,
  },
  vibeText: {
    fontSize: 13,
    lineHeight: 19,
  },

  // ── Bottom bar ──────────────────────────────────────────────────────────
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
  },
  saveButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },
  bookButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  bookGradient: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  bookButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
  },
});
