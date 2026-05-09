import React, { useMemo } from "react";
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
import WeatherPreview from "./WeatherPreview";
import DealInterestingFacts from "./DealInterestingFacts";
import DealTravelTips from "./DealTravelTips";
import DealDestinationTab from "./DealDestinationTab";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const HERO_HEIGHT = SCREEN_HEIGHT * 0.65;

interface ExpandedDealProps {
  deal: Deal;
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
  onBook: () => void;
  userProfile?: any;
}

type FitLevel = { color: "green" | "yellow" | "red" };

function getDealFitLevel(deal: Deal, profile: any): FitLevel {
  const preferredTypes: string[] = profile.dealTypes || [];
  const destPref: string = profile.destinationPreference || "both";
  const isIntl = (deal.domestic_or_international || "")
    .toLowerCase()
    .includes("international");

  const typeMatch =
    preferredTypes.length === 0 ||
    preferredTypes.includes(deal.deal_type || "") ||
    preferredTypes.includes("surprise");
  const destMatch =
    destPref === "both" ||
    (destPref === "international" && isIntl) ||
    (destPref === "domestic" && !isIntl);

  if (typeMatch && destMatch) return { color: "green" };
  if (typeMatch || destMatch) return { color: "yellow" };
  return { color: "red" };
}

type Segment = { text: string; bold?: boolean };
const b = (text: string): Segment => ({ text, bold: true });
const t = (text: string): Segment => ({ text });

function generateFitSummary(deal: Deal, profile: any): Segment[] {
  const preferredTypes: string[] = profile.dealTypes || [];
  const destPref: string = profile.destinationPreference || "both";
  const isIntl = (deal.domestic_or_international || "")
    .toLowerCase()
    .includes("international");

  const typeMatch =
    preferredTypes.length === 0 ||
    preferredTypes.includes(deal.deal_type || "") ||
    preferredTypes.includes("surprise");
  const destMatch =
    destPref === "both" ||
    (destPref === "international" && isIntl) ||
    (destPref === "domestic" && !isIntl);

  const dest = deal.destination || "This destination";
  const vibe = deal.vibe_description
    ? deal.vibe_description.split(/[.!?]/)[0].trim()
    : "";

  const typeOffers: Record<string, string> = {
    luxury: "upscale stays and premium experiences",
    adventure: "outdoor adventure and active exploration",
    budget: "strong value without sacrificing the experience",
    cultural: "rich history, local culture, and real depth",
    family: "activities the whole family enjoys",
    relaxation: "beaches, slow mornings, and genuine downtime",
    romantic: "intimate settings built for two",
  };
  const offerDesc = typeOffers[deal.deal_type || ""] || "a solid travel experience";

  let s1: Segment[];
  if (typeMatch && destMatch) {
    if (vibe) {
      s1 = [t("This one is "), b("right in your wheelhouse"), t(`. ${vibe}, which is exactly the type of trip you gravitate toward.`)];
    } else {
      s1 = [b(dest), t(" delivers "), b(offerDesc), t(", which lines up well with how you like to travel.")];
    }
  } else if (typeMatch) {
    if (vibe) {
      s1 = [b(vibe), t(", and that style of travel is exactly what you tend to look for. The destination might be new territory, but the experience is familiar.")];
    } else {
      s1 = [t("The style of this trip "), b("matches how you like to travel"), t(". "), b(dest), t(` delivers ${offerDesc}, even if it stretches your usual geography.`)];
    }
  } else if (destMatch) {
    if (vibe) {
      s1 = [b(dest), t(" is headed in the right direction. "), b(vibe), t(", so even if it's a little different from your usual vibe, there is real appeal here.")];
    } else {
      s1 = [b(dest), t(" fits where you want to go. The deal type is a bit outside your usual, but the location itself is on point.")];
    }
  } else {
    if (vibe) {
      s1 = [b(vibe), t(". It's a bit outside your usual range, but that contrast is "), b("exactly what makes it worth a second look"), t(".")];
    } else {
      s1 = [b(dest), t(" is outside your usual picks, but sometimes the trips you least expect end up being the most memorable.")];
    }
  }

  let s2: Segment[];
  if (deal.discount_pct >= 40) {
    s2 = [t(" At "), b(`${deal.discount_pct}% off`), t(", the price alone makes this hard to ignore.")];
  } else if (deal.discount_pct >= 15) {
    s2 = [t(" The "), b(`${deal.discount_pct}% off`), t(" regular fares makes the timing genuinely good right now.")];
  } else if (deal.discount_pct > 0) {
    s2 = [t(" You're saving "), b(`${deal.discount_pct}%`), t(" off normal prices, which gives this deal a real edge.")];
  } else if (deal.price) {
    s2 = [t(" At "), b(`$${deal.price}`), t(", it's solid value for everything "), b(dest), t(" brings to the table.")];
  } else {
    s2 = [t(" The timing on this makes it worth acting on sooner rather than later.")];
  }

  return [...s1, ...s2];
}

function parseStringArray(
  items: string[] | undefined
): { title: string; description: string }[] {
  if (!items || items.length === 0) return [];
  return items.map((item) => {
    const colonIdx = item.indexOf(":");
    const dashIdx = item.indexOf(" - ");
    if (colonIdx > 0 && colonIdx < 60) {
      return { title: item.slice(0, colonIdx).trim(), description: item.slice(colonIdx + 1).trim() };
    }
    if (dashIdx > 0 && dashIdx < 60) {
      return { title: item.slice(0, dashIdx).trim(), description: item.slice(dashIdx + 3).trim() };
    }
    return { title: "", description: item };
  });
}

function getDealTier(discountPct: number): { label: string; bg: string } | null {
  if (discountPct >= 40) return { label: "🔥 Hot Deal", bg: colors.brand.traceRed };
  if (discountPct >= 20) return { label: "✨ Good Deal", bg: colors.brand.amber500 };
  return null;
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
  const [activeTab, setActiveTab] = React.useState<"flight" | "destination">("flight");

  const fitData = useMemo(
    () =>
      userProfile && deal
        ? { segments: generateFitSummary(deal, userProfile), level: getDealFitLevel(deal, userProfile) }
        : null,
    [deal?.id, userProfile]
  );

  if (!deal) return null;

  const travelTipObjects = parseStringArray(deal.travel_tips);
  const factObjects = parseStringArray(deal.interesting_facts);
  const dealTier = getDealTier(deal.discount_pct);

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
          {/* ── Hero ────────────────────────────────────────────────────── */}
          <View style={styles.heroContainer}>
            <Image
              source={{ uri: deal.image_url }}
              style={styles.heroImage}
              contentFit="cover"
              transition={200}
            />
            <LinearGradient
              colors={["transparent", "rgba(10,10,15,0.35)", "rgba(10,10,15,0.92)"]}
              locations={[0.3, 0.6, 1]}
              style={StyleSheet.absoluteFillObject}
            />

            <View style={styles.heroOverlay}>
              {/* Route + deal tier row */}
              <View style={styles.heroTopRow}>
                <View style={styles.routeBadge}>
                  <Text style={styles.routeText}>
                    {deal.origin} {"→"} {deal.destination_code}
                  </Text>
                </View>
                {!!dealTier && (
                  <View style={[styles.dealTierBadge, { backgroundColor: dealTier.bg }]}>
                    <Text style={styles.dealTierText}>{dealTier.label}</Text>
                  </View>
                )}
              </View>

              {/* Destination name */}
              <Text style={styles.destinationText} numberOfLines={2}>
                {deal.destination}
              </Text>

              {/* Price row */}
              {deal.price > 0 && (
                <View style={styles.heroPriceRow}>
                  <Text style={styles.heroPriceText}>${deal.price}</Text>
                  {deal.original_price > 0 && deal.original_price !== deal.price && (
                    <Text style={styles.heroOriginalPrice}>${deal.original_price}</Text>
                  )}
                </View>
              )}

              {/* Travel window */}
              {!!deal.travel_window && (
                <View style={styles.travelWindowRow}>
                  <Clock size={13} color="rgba(255,255,255,0.65)" />
                  <Text style={styles.travelWindowText}>{deal.travel_window}</Text>
                </View>
              )}
            </View>
          </View>

          {/* ── Tab Row ───────────────────────────────────────────────── */}
          <View style={[styles.tabRow, { backgroundColor: theme.background }]}>
            <View style={[styles.tabPills, { backgroundColor: theme.muted }]}>
              {(["flight", "destination"] as const).map((tab) => (
                <TouchableOpacity
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  activeOpacity={0.7}
                  style={[styles.tabPill, activeTab === tab && { backgroundColor: theme.card }]}
                >
                  <Text style={[styles.tabPillText, { color: activeTab === tab ? theme.foreground : theme.mutedForeground }]}>
                    {tab === "flight" ? "✈️  Flight" : "🗺️  Destination"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {activeTab === "destination" ? (
            <DealDestinationTab deal={deal} />
          ) : (
            <>
          {/* ── Content ───────────────────────────────────────────────── */}
          <View style={styles.contentContainer}>

            {/* Booking tip strip */}
            {!!deal.best_time_to_book && (
              <View
                style={[
                  styles.bookTipStrip,
                  {
                    backgroundColor: scheme === "dark"
                      ? "rgba(245,158,11,0.12)"
                      : "rgba(245,158,11,0.08)",
                    borderColor: scheme === "dark"
                      ? "rgba(245,158,11,0.30)"
                      : "rgba(245,158,11,0.22)",
                  },
                ]}
              >
                <Text style={styles.bookTipIcon}>⏰</Text>
                <Text style={[styles.bookTipText, { color: theme.foreground }]}>
                  {deal.best_time_to_book}
                </Text>
              </View>
            )}

            {/* Flight Details */}
            {(deal.origin || deal.destination_code || deal.duration || deal.layover_info) && (
              <View
                style={[
                  styles.flightCard,
                  { backgroundColor: theme.card, borderColor: theme.border },
                ]}
              >
                <View style={[styles.sectionHeaderRow, { marginBottom: 0, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.border }]}>
                  <Plane size={13} color={theme.mutedForeground} />
                  <Text style={[styles.sectionHeaderText, { color: theme.mutedForeground, fontSize: 11, letterSpacing: 1.5 }]}>
                    FLIGHT DETAILS
                  </Text>
                </View>

                {(deal.origin || deal.destination_code) && (
                  <View style={[styles.routeRow, { borderBottomColor: theme.border }]}>
                    <View style={styles.routeEndpoint}>
                      <Text style={[styles.routeCode, { color: theme.foreground }]}>
                        {deal.origin || "—"}
                      </Text>
                      <Text style={[styles.routeSubLabel, { color: theme.mutedForeground }]}>
                        Origin
                      </Text>
                    </View>

                    <View style={styles.routeMiddle}>
                      <View style={styles.routeLine}>
                        <View style={[styles.dashedLine, { borderBottomColor: theme.border }]} />
                        <Plane size={14} color={colors.brand.traceRed} />
                        <View style={[styles.dashedLine, { borderBottomColor: theme.border }]} />
                      </View>
                      {!!deal.duration && (
                        <Text style={[styles.durationText, { color: theme.mutedForeground }]}>
                          {deal.duration}
                        </Text>
                      )}
                    </View>

                    <View style={styles.routeEndpoint}>
                      <Text style={[styles.routeCode, { color: theme.foreground }]}>
                        {deal.destination_code ||
                          deal.destination?.slice(0, 3).toUpperCase() ||
                          "—"}
                      </Text>
                      <Text style={[styles.routeSubLabel, { color: theme.mutedForeground }]}>
                        Destination
                      </Text>
                    </View>
                  </View>
                )}

                {!!deal.travel_window && (
                  <View style={[styles.metaRow, { borderBottomColor: theme.border }]}>
                    <Text style={[styles.metaLabel, { color: theme.mutedForeground }]}>Travel window</Text>
                    <Text style={[styles.metaValue, { color: theme.foreground }]}>{deal.travel_window}</Text>
                  </View>
                )}
                {!!deal.airlines && (
                  <View style={[styles.metaRow, { borderBottomColor: theme.border }]}>
                    <Text style={[styles.metaLabel, { color: theme.mutedForeground }]}>Airlines</Text>
                    <Text style={[styles.metaValue, { color: theme.foreground, textAlign: "right", flex: 1 }]}>
                      {deal.airlines}
                    </Text>
                  </View>
                )}
                {!!deal.layover_info && (
                  <View style={[styles.metaRow, { borderBottomColor: theme.border }]}>
                    <Text style={[styles.metaLabel, { color: theme.mutedForeground }]}>Layovers</Text>
                    <Text style={[styles.metaValue, { color: theme.foreground, textAlign: "right", flex: 1 }]}>
                      {deal.layover_info}
                    </Text>
                  </View>
                )}
                {!!deal.price_will_last && (
                  <View style={[styles.metaRow, { borderBottomColor: theme.border }]}>
                    <Text style={[styles.metaLabel, { color: theme.mutedForeground }]}>Price valid</Text>
                    <Text style={[styles.metaValue, { color: theme.foreground, textAlign: "right", flex: 1 }]}>
                      {deal.price_will_last}
                    </Text>
                  </View>
                )}
                {!!deal.price_trend && deal.price_trend !== "stable" && (() => {
                  const isRising = deal.price_trend.toLowerCase().includes("rising") || deal.price_trend.toLowerCase().includes("up");
                  const isFalling = deal.price_trend.toLowerCase().includes("falling") || deal.price_trend.toLowerCase().includes("down");
                  const trendColor = isRising ? "#ef4444" : isFalling ? "#16a34a" : theme.mutedForeground;
                  const trendLabel = isRising ? "📈 Rising" : isFalling ? "📉 Falling" : deal.price_trend;
                  return (
                    <View style={styles.metaRow}>
                      <Text style={[styles.metaLabel, { color: theme.mutedForeground }]}>Price trend</Text>
                      <Text style={[styles.metaValue, { color: trendColor, textAlign: "right", flex: 1, fontWeight: "700" }]}>
                        {trendLabel}
                      </Text>
                    </View>
                  );
                })()}
              </View>
            )}

            {/* Urgency strip */}
            {deal.urgency?.toLowerCase() === "high" && (
              <View style={[styles.urgencyStrip, { backgroundColor: scheme === "dark" ? "rgba(239,68,68,0.12)" : "rgba(239,68,68,0.07)", borderColor: scheme === "dark" ? "rgba(239,68,68,0.30)" : "rgba(239,68,68,0.20)" }]}>
                <Text style={styles.urgencyIcon}>🔥</Text>
                <Text style={[styles.urgencyText, { color: theme.foreground }]}>This price won't last — deals like this typically sell out within 24–48 hours.</Text>
              </View>
            )}

            {/* Weather */}
            <WeatherPreview deal={deal} />

            {/* Personal AI Fit */}
            {!!userProfile && !!fitData && (() => {
              const matchConfig =
                fitData.level.color === "green"
                  ? { label: "Strong Match", dot: "#16a34a", dotBg: "rgba(22,163,74,0.12)" }
                  : fitData.level.color === "yellow"
                  ? { label: "Good Match",   dot: "#b45309", dotBg: "rgba(202,138,4,0.12)" }
                  : { label: "Mixed Match",  dot: colors.brand.traceRed, dotBg: "rgba(255,101,91,0.12)" };
              return (
                <View style={[styles.fitCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <View style={styles.fitHeader}>
                    <View style={styles.fitTitleRow}>
                      <Sparkles size={14} color={scheme === "dark" ? "#a78bfa" : "#7c3aed"} />
                      <Text style={[styles.fitTitle, { color: theme.foreground }]}>Your AI Fit</Text>
                    </View>
                    <View style={[styles.matchBadge, { backgroundColor: matchConfig.dotBg }]}>
                      <View style={[styles.matchDot, { backgroundColor: matchConfig.dot }]} />
                      <Text style={[styles.matchLabel, { color: matchConfig.dot }]}>{matchConfig.label}</Text>
                    </View>
                  </View>
                  <Animated.Text entering={FadeIn.duration(400)} style={[styles.fitText, { color: theme.mutedForeground }]}>
                    {fitData.segments.map((seg, i) =>
                      seg.bold
                        ? <Text key={i} style={[styles.fitTextBold, { color: theme.foreground }]}>{seg.text}</Text>
                        : <Text key={i}>{seg.text}</Text>
                    )}
                  </Animated.Text>
                </View>
              );
            })()}

            {/* AI Insight */}
            {(!!deal.ai_insight || !!deal.vibe_description) && (
              <View
                style={[
                  styles.aiCard,
                  {
                    backgroundColor: scheme === "dark" ? "rgba(139,92,246,0.08)" : "rgba(139,92,246,0.05)",
                    borderColor: scheme === "dark" ? "rgba(139,92,246,0.25)" : "rgba(139,92,246,0.15)",
                  },
                ]}
              >
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.aiIconWrap}>
                    <Sparkles size={14} color="#ffffff" />
                  </View>
                  <Text style={[styles.aiLabel, { color: scheme === "dark" ? "#a78bfa" : "#7c3aed" }]}>
                    AI Insight
                  </Text>
                </View>
                {!!deal.ai_insight && (
                  <Text style={[styles.aiText, { color: theme.foreground }]}>{deal.ai_insight}</Text>
                )}
                {!!deal.vibe_description && (
                  <Text style={[styles.vibeText, { color: theme.mutedForeground }]}>{deal.vibe_description}</Text>
                )}
              </View>
            )}
          </View>

          {/* ── Padded sections ───────────────────────────────────────── */}
          <View style={styles.contentContainer}>
            {deal.interesting_facts && deal.interesting_facts.length > 0 && (
              <DealInterestingFacts facts={factObjects} />
            )}
            {deal.travel_tips && deal.travel_tips.length > 0 && (
              <DealTravelTips tips={travelTipObjects} />
            )}
          </View>
            </>
          )}
        </ScrollView>

        {/* ── Bottom action bar ─────────────────────────────────────── */}
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
              style={[styles.saveButton, { backgroundColor: theme.card, borderColor: theme.border }]}
            >
              <Bookmark size={16} color={theme.foreground} />
              <Text style={[styles.saveButtonText, { color: theme.foreground }]}>Save</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={onBook} activeOpacity={0.8} style={styles.bookButton}>
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

        <TouchableOpacity
          onPress={onClose}
          style={[styles.closeButton, { top: insets.top + 12 }]}
          activeOpacity={0.8}
        >
          <X size={20} color="#1a1a1a" strokeWidth={2.5} />
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { flexGrow: 1 },

  // ── Hero ──────────────────────────────────────────────────────────────────
  heroContainer: {
    height: HERO_HEIGHT,
    width: "100%",
    overflow: "hidden",
  },
  heroImage: {
    position: "absolute",
    top: 0,
    left: 0,
    width: SCREEN_WIDTH,
    height: HERO_HEIGHT,
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
    paddingBottom: 28,
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  routeBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.30)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  routeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: 0.5,
  },
  dealTierBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  dealTierText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: 0.3,
  },
  destinationText: {
    fontSize: 48,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: -1,
    lineHeight: 52,
    marginBottom: 6,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  heroPriceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 10,
    marginBottom: 10,
  },
  heroPriceText: {
    fontSize: 40,
    fontWeight: "900",
    color: "#ffffff",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  heroOriginalPrice: {
    fontSize: 18,
    fontWeight: "600",
    color: "rgba(255,255,255,0.50)",
    textDecorationLine: "line-through",
  },
  travelWindowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  travelWindowText: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.75)",
  },

  // ── Tab row ───────────────────────────────────────────────────────────────
  tabRow: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  tabPills: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 3,
  },
  tabPill: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 9,
    borderRadius: 10,
  },
  tabPillText: {
    fontSize: 13,
    fontWeight: "700",
  },

  // ── Content containers ────────────────────────────────────────────────────
  contentContainer: {
    padding: 20,
    gap: 18,
  },
  fullBleedSection: {
    paddingTop: 4,
    paddingBottom: 4,
  },

  // ── Booking tip strip ─────────────────────────────────────────────────────
  bookTipStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bookTipIcon: { fontSize: 14 },
  bookTipText: { fontSize: 13, lineHeight: 18, flex: 1 },

  // ── Section header ────────────────────────────────────────────────────────
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  sectionHeaderBar: {
    width: 4,
    height: 18,
    borderRadius: 2,
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: "700",
  },

  // ── Flight card ───────────────────────────────────────────────────────────
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
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
  },
  routeEndpoint: { alignItems: "center" },
  routeCode: { fontSize: 24, fontWeight: "900" },
  routeSubLabel: { fontSize: 11, fontWeight: "500", marginTop: 2 },
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
  durationText: { fontSize: 11, fontWeight: "600" },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  metaLabel: { fontSize: 13, fontWeight: "500" },
  metaValue: { fontSize: 13, fontWeight: "600" },

  // ── Personal fit card ─────────────────────────────────────────────────────
  fitCard: {
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
  },
  fitHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  fitTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  fitTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  matchBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  matchDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  matchLabel: {
    fontSize: 11,
    fontWeight: "700",
  },
  fitText: { fontSize: 14, lineHeight: 22 },
  fitTextBold: { fontWeight: "700" },

  // ── AI Insight card ───────────────────────────────────────────────────────
  aiCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
  },
  aiIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
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
  aiText: { fontSize: 14, lineHeight: 21, marginBottom: 8 },
  vibeText: { fontSize: 13, lineHeight: 19 },

  // ── Urgency strip ─────────────────────────────────────────────────────────
  urgencyStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  urgencyIcon: { fontSize: 14 },
  urgencyText: { fontSize: 13, lineHeight: 18, flex: 1 },

  // ── Itinerary card ────────────────────────────────────────────────────────
  itineraryCard: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
  },
  itineraryIcon: { fontSize: 13 },
  itineraryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  itineraryNumber: {
    fontSize: 13,
    fontWeight: "900",
    width: 24,
    letterSpacing: -0.5,
  },
  itineraryText: { fontSize: 14, fontWeight: "600", lineHeight: 20 },
  itineraryDesc: { fontSize: 13, lineHeight: 19 },

  // ── Bottom bar ────────────────────────────────────────────────────────────
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  buttonRow: { flexDirection: "row", gap: 12 },
  saveButton: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    borderWidth: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  saveButtonText: { fontSize: 15, fontWeight: "700" },
  bookButton: {
    flex: 2,
    height: 50,
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: colors.brand.traceRed,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  bookGradient: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  bookButtonText: { fontSize: 15, fontWeight: "700", color: "#ffffff" },
});
