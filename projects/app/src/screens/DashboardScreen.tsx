import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  useColorScheme,
  RefreshControl,
  Alert,
  Linking,
  Modal,
  Animated as RNAnimated,
  PanResponder,
  Share,
} from "react-native";
import { useRoute, useNavigation, useFocusEffect } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { TabParamList, RootStackParamList } from "../navigation/types";
import Animated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronRight, ChevronDown, ChevronUp, Trash2, BellRing, Plane } from "lucide-react-native";
import ExpandedDeal from "../components/swipe/ExpandedDeal";
import ShareNamePromptModal from "../components/ShareNamePromptModal";
import TraceLoader from "../components/TraceLoader";
import { colors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";
import {
  getSavedDeals,
  getSwipeActions,
  deleteSavedDeal,
  deleteSwipeAction,
  getDealAlerts,
  deleteDealAlert,
  updateUserProfile,
} from "../services/firestore";
import { ALL_BADGES, getDestinationFlag, getLevelInfo, SWIPES_PER_LEVEL } from "../lib/constants";
import { createShare } from "../services/shareApi";
import { fetchDeals } from "../services/dealsApi";
import { prefetchDestinationInfo } from "../hooks/useDestinationInfo";

export default function DashboardScreen() {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;
  const { user, profile, isPremium } = useAuth();
  const route = useRoute<RouteProp<TabParamList, "Dashboard">>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [deals, setDeals] = useState<any[]>([]);
  const [dealStatuses, setDealStatuses] = useState<Record<string, { status: "ok" | "price_changed" | "past"; livePrice?: number }>>({});
  const [swipes, setSwipes] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [showAlertsUpgrade, setShowAlertsUpgrade] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<"saved" | "alerts">("saved");
  const [alertSavedToast, setAlertSavedToast] = useState(false);
  const [expandedDeal, setExpandedDeal] = useState<any | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [selectedBadge, setSelectedBadge] = useState<(typeof ALL_BADGES)[number] | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showShareNamePrompt, setShowShareNamePrompt] = useState(false);
  const [pendingShareDeal, setPendingShareDeal] = useState<any | null>(null);

  async function doShare(deal: any, name: string) {
    try {
      const shareId = await createShare(deal, user!.uid, name);
      // Do NOT pass `url` — it's already embedded in `message`. On iOS the
      // share sheet appends `url` to the message automatically, which would
      // print the App Store link twice.
      await Share.share({
        title: `${deal.destination} deal on Trace`,
        message: `${name} found an amazing deal to ${deal.destination} for $${deal.price}! Download Trace to see it 👉 https://apps.apple.com/us/app/trace-travel/id6760838076`,
      });
    } catch {}
  }

  function handleShareDeal() {
    if (!expandedDeal || !user) return;
    // Prefer the Firebase Auth displayName (set by Google/Apple sign-in).
    // Fall back to the Firestore profile name, but skip "Travel Explorer" —
    // that's the placeholder set during onboarding, not the user's real name.
    const rawName = user.displayName || profile?.displayName;
    const name = rawName && rawName !== "Travel Explorer" ? rawName : null;
    if (!name) {
      setPendingShareDeal(expandedDeal);
      setShowShareNamePrompt(true);
    } else {
      doShare(expandedDeal, name);
    }
  }

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const [savedDeals, swipeData, alertData] = await Promise.all([
        getSavedDeals(user.uid),
        getSwipeActions(user.uid),
        getDealAlerts(user.uid),
      ]);
      setDeals(savedDeals);
      setSwipes(swipeData);
      setAlerts(alertData);

      // Kick off destination-info prefetch for saved deals so the
      // Destination tab opens instantly instead of showing a spinner.
      for (const d of savedDeals) prefetchDestinationInfo(d as any);

      // Cross-reference saved deals against live API
      const airportCode = profile?.homeAirport || "LAX";
      try {
        const liveDeals = await fetchDeals(airportCode);
        const liveByDest = new Map<string, any>();
        for (const d of liveDeals) {
          liveByDest.set(d.destination?.toLowerCase(), d);
        }

        const MONTHS = ["january","february","march","april","may","june","july","august","september","october","november","december"];
        const now = new Date();

        const statuses: Record<string, { status: "ok" | "price_changed" | "past"; livePrice?: number }> = {};
        for (const saved of savedDeals) {
          // Check if travel date is in the past
          const dateStr = (saved.travelWindow || saved.dateString || "").toLowerCase();
          const monthIdx = MONTHS.findIndex((m) => dateStr.includes(m));
          if (monthIdx !== -1) {
            let year = now.getFullYear();
            const yearMatch = dateStr.match(/20\d\d/);
            if (yearMatch) year = parseInt(yearMatch[0]);
            const dealDate = new Date(year, monthIdx, 28); // end of month
            if (dealDate < now && !yearMatch) {
              // Try next year before marking past
              const nextYear = new Date(year + 1, monthIdx, 1);
              if (nextYear < now) {
                statuses[saved.id] = { status: "past" };
                continue;
              }
            } else if (dealDate < now) {
              statuses[saved.id] = { status: "past" };
              continue;
            }
          }

          // Check if deal still exists and if price changed
          const liveDeal = liveByDest.get(saved.destination?.toLowerCase());
          if (!liveDeal) {
            statuses[saved.id] = { status: "price_changed" };
          } else {
            const savedPrice = saved.price || 0;
            const livePrice = liveDeal.dealPriceUSD || liveDeal.price || 0;
            if (livePrice > 0 && Math.abs(livePrice - savedPrice) > 5) {
              statuses[saved.id] = { status: "price_changed", livePrice };
            } else {
              statuses[saved.id] = { status: "ok" };
            }
          }
        }
        setDealStatuses(statuses);
      } catch {
        // Silent fail — statuses just won't show
      }
    } catch (err) {
      console.error("Failed to load dashboard:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.uid, profile?.homeAirport]);

  // Reload every time the Dashboard tab gains focus. Using useFocusEffect
  // (instead of a one-shot useEffect) is required because tab screens stay
  // mounted across tab switches — without this, deals saved on another
  // tab don't appear here until pull-to-refresh.
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  useEffect(() => {
    const params = route.params;
    if (!params) return;
    if (params.tab) setTab(params.tab);
    if (params.alertSaved) {
      loadData();
      setAlertSavedToast(true);
      setTimeout(() => setAlertSavedToast(false), 3500);
    }
  }, [route.params]);

  const handleDeleteDeal = async (dealId: string) => {
    setDeletingIds((prev) => new Set(prev).add(dealId));
    setTimeout(async () => {
      await deleteSavedDeal(dealId);
      setDeals((prev) => prev.filter((d) => d.id !== dealId));
      setDeletingIds((prev) => { const s = new Set(prev); s.delete(dealId); return s; });
      const swipe = swipes.find((s: any) => s.dealId === dealId && s.action === "super");
      if (swipe) await deleteSwipeAction(swipe.id);
    }, 250);
  };

  const handleClearAll = () => {
    Alert.alert("Clear All Saved Deals", "Remove all saved deals? This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear All",
        style: "destructive",
        onPress: async () => {
          for (const deal of deals) {
            await deleteSavedDeal(deal.id);
            const swipe = swipes.find((s: any) => s.dealId === deal.id && s.action === "super");
            if (swipe) await deleteSwipeAction(swipe.id);
          }
          setDeals([]);
        },
      },
    ]);
  };

  let personality: { title?: string; emoji?: string; description?: string } = {};
  try {
    if (profile?.travelPersonality) personality = JSON.parse(profile.travelPersonality);
  } catch {}

  const earnedBadges = ALL_BADGES.filter((b) =>
    profile?.badges?.includes(b.id) || b.requirement(profile || {}, swipes)
  );

  const level = profile?.dealHunterLevel || 1;
  const swipeCount = profile?.swipeCount || 0;
  const streakDays = profile?.streakDays || 0;

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={["top", "left", "right"]}>
        <TraceLoader />
      </SafeAreaView>
    );
  }

  const savedDealToDeal = (item: any) => ({
    id: item.originalDealId || item.id,
    destination: item.destination || "",
    destination_code: item.destinationCode || "",
    origin: item.origin || "",
    price: item.price || 0,
    original_price: item.originalPrice || 0,
    discount_pct: item.discountPct || 0,
    travel_window: item.travelWindow || "",
    dateString: "",
    deal_type: item.dealType || null,
    image_url: item.imageUrl || "",
    ai_insight: item.aiInsight || "",
    vibe_description: item.vibeDescription || "",
    continent: item.continent || "",
    urgency: item.urgency || "",
    price_trend: item.priceTrend || "",
    itinerary_ideas: [],
    neighborhood_previews: [],
    best_time_to_book: "",
    experiences: [],
    travel_tips: [],
    quick_tips: [],
    interesting_facts: [],
    weather_preview: item.weatherPreview || "",
    url: item.url || "",
    airlines: item.airlines || "",
    month_type: "",
    layover_info: item.layoverInfo || "",
    duration: item.duration || "",
    domestic_or_international: "",
    price_will_last: "",
    is_business_class: item.isBusinessClass || false,
  });

  const renderSavedDeal = ({ item }: { item: any }) => {
    const isDeleting = deletingIds.has(item.id);
    const dealStatus = dealStatuses[item.id];
    const isPast = dealStatus?.status === "past";
    const isPriceChanged = dealStatus?.status === "price_changed";
    return (
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(220)}
        layout={LinearTransition.duration(200)}
        style={{
          backgroundColor: theme.card,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: isPast ? theme.border : isPriceChanged ? "#F59E0B40" : theme.border,
          overflow: "hidden",
          marginBottom: 12,
          opacity: isDeleting ? 0.4 : isPast ? 0.5 : 1,
        }}
      >
        <TouchableOpacity activeOpacity={0.85} onPress={() => setExpandedDeal(savedDealToDeal(item))}>
          {item.imageUrl ? (
            <View style={{ position: "relative" }}>
              <Image source={{ uri: item.imageUrl }} style={{ width: "100%", height: 160 }} contentFit="cover" />
              {/* Destination name overlaid on image */}
              <View style={{
                position: "absolute", bottom: 0, left: 0, right: 0,
                paddingHorizontal: 12, paddingBottom: 12, paddingTop: 32,
              }}>
                <View style={{
                  backgroundColor: "rgba(0,0,0,0.52)",
                  borderRadius: 10,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  alignSelf: "flex-start",
                  maxWidth: "80%",
                }}>
                  <Text style={{ fontSize: 18, fontWeight: "900", color: "#fff", letterSpacing: -0.3 }} numberOfLines={1}>
                    {item.destination}
                  </Text>
                  {item.origin ? (
                    <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.72)", fontWeight: "500", marginTop: 1 }}>
                      {item.origin} → {item.destination}
                    </Text>
                  ) : null}
                </View>
              </View>
              {/* Discount badge */}
              {item.discountPct > 0 && (
                <View style={{
                  position: "absolute", top: 10, left: 10,
                  backgroundColor: item.discountPct >= 50 ? "#FF8C00" : "#16a34a",
                  borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
                }}>
                  <Text style={{ color: "#fff", fontSize: 12, fontWeight: "800" }}>
                    -{Math.round(item.discountPct)}%
                  </Text>
                </View>
              )}
              {/* Duration pill */}
              {item.duration && !isPast && !isPriceChanged && (
                <View style={{
                  position: "absolute", top: 10, right: 10,
                  backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 8,
                  paddingHorizontal: 8, paddingVertical: 4,
                }}>
                  <Text style={{ color: "#fff", fontSize: 11, fontWeight: "600" }}>{item.duration}</Text>
                </View>
              )}
              {/* Status badges */}
              {isPast && (
                <View style={{
                  position: "absolute", top: 10, right: 10,
                  backgroundColor: "rgba(0,0,0,0.65)", borderRadius: 8,
                  paddingHorizontal: 8, paddingVertical: 4,
                }}>
                  <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 11, fontWeight: "700" }}>📅 Dates passed</Text>
                </View>
              )}
              {isPriceChanged && (
                <View style={{
                  position: "absolute", top: 10, right: 10,
                  backgroundColor: "#F59E0B", borderRadius: 8,
                  paddingHorizontal: 8, paddingVertical: 4,
                }}>
                  <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>
                    {dealStatus?.livePrice ? `Now $${dealStatus.livePrice}` : "Price changed"}
                  </Text>
                </View>
              )}
            </View>
          ) : (
            /* No image fallback — show destination prominently */
            <View style={{ paddingHorizontal: 12, paddingTop: 14, paddingBottom: 4 }}>
              <Text style={{ fontSize: 20, fontWeight: "900", color: theme.foreground, letterSpacing: -0.4 }} numberOfLines={1}>
                {item.destination}
              </Text>
              {item.origin ? (
                <Text style={{ fontSize: 12, color: theme.mutedForeground, fontWeight: "500", marginTop: 2 }}>
                  {item.origin} → {item.destination}
                </Text>
              ) : null}
            </View>
          )}
          <View style={{ padding: 12, paddingTop: 10 }}>
            {/* Price row + trash */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
                <Text style={{ fontSize: 22, fontWeight: "800", color: theme.foreground }}>${item.price}</Text>
                {item.originalPrice > 0 && item.originalPrice !== item.price && (
                  <Text style={{ fontSize: 13, color: theme.mutedForeground, textDecorationLine: "line-through" }}>
                    ${item.originalPrice}
                  </Text>
                )}
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <ChevronRight size={16} color={theme.mutedForeground} />
                <TouchableOpacity
                  onPress={() => handleDeleteDeal(item.id)}
                  disabled={isDeleting}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Trash2 size={16} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </View>
            {/* Travel window + airline */}
            <View style={{ flexDirection: "row", gap: 12, marginTop: 5 }}>
              {item.travelWindow && (
                <Text style={{ fontSize: 12, color: theme.mutedForeground }} numberOfLines={1}>
                  📅 {item.travelWindow}
                </Text>
              )}
              {item.airlines && (
                <Text style={{ fontSize: 12, color: theme.mutedForeground }} numberOfLines={1}>
                  ✈️ {item.airlines}
                </Text>
              )}
            </View>
            {/* Vibe */}
            {item.vibeDescription && (
              <Text style={{ fontSize: 12, color: theme.mutedForeground, marginTop: 4, fontStyle: "italic" }} numberOfLines={2}>
                {item.vibeDescription}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const SwipeableAlert = ({ item }: { item: any }) => {
    const translateX = useRef(new RNAnimated.Value(0)).current;
    const pulseScale = useRef(new RNAnimated.Value(1)).current;
    const pulseOpacity = useRef(new RNAnimated.Value(0.6)).current;
    const DELETE_THRESHOLD = -80;
    const isMatched = item.status === "matched";
    const accentColor = isMatched ? "#22c55e" : "#3b82f6";

    useEffect(() => {
      const pulse = RNAnimated.loop(
        RNAnimated.sequence([
          RNAnimated.parallel([
            RNAnimated.timing(pulseScale, { toValue: 1.8, duration: 900, useNativeDriver: true }),
            RNAnimated.timing(pulseOpacity, { toValue: 0, duration: 900, useNativeDriver: true }),
          ]),
          RNAnimated.parallel([
            RNAnimated.timing(pulseScale, { toValue: 1, duration: 0, useNativeDriver: true }),
            RNAnimated.timing(pulseOpacity, { toValue: 0.6, duration: 0, useNativeDriver: true }),
          ]),
          RNAnimated.delay(500),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }, []);

    const panResponder = useRef(
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 5 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderMove: (_, g) => {
          if (g.dx < 0) translateX.setValue(g.dx);
        },
        onPanResponderRelease: (_, g) => {
          if (g.dx < DELETE_THRESHOLD) {
            RNAnimated.timing(translateX, { toValue: -500, duration: 220, useNativeDriver: true }).start(async () => {
              await deleteDealAlert(item.id);
              setAlerts((prev) => prev.filter((a) => a.id !== item.id));
            });
          } else {
            RNAnimated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
          }
        },
      })
    ).current;

    const deleteOpacity = translateX.interpolate({ inputRange: [-120, -40], outputRange: [1, 0], extrapolate: "clamp" });

    return (
      <View style={{ marginBottom: 8, overflow: "hidden", borderRadius: 14 }}>
        {/* Red delete background */}
        <RNAnimated.View
          style={{
            position: "absolute", top: 0, bottom: 0, right: 0, left: 0,
            backgroundColor: "#ef4444",
            borderRadius: 14,
            alignItems: "flex-end",
            justifyContent: "center",
            paddingRight: 20,
            opacity: deleteOpacity,
          }}
        >
          <Trash2 size={20} color="#fff" />
        </RNAnimated.View>

        <RNAnimated.View
          style={{ transform: [{ translateX }] }}
          {...panResponder.panHandlers}
        >
          <View
            style={{
              backgroundColor: theme.card,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: theme.border,
              flexDirection: "row",
              alignItems: "stretch",
              overflow: "hidden",
            }}
          >
            {/* Left color stripe */}
            <View style={{ width: 4, backgroundColor: accentColor }} />

            {/* Plane icon block */}
            <View style={{
              width: 52,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: `${accentColor}14`,
            }}>
              <Plane size={20} color={accentColor} />
            </View>

            {/* Content */}
            <View style={{ flex: 1, paddingVertical: 14, paddingLeft: 10, paddingRight: 4, gap: 3 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={{ fontSize: 17, fontWeight: "800", color: theme.foreground, letterSpacing: -0.3, flexShrink: 1 }} numberOfLines={1}>
                  {item.destination}
                </Text>
                {getDestinationFlag(item.destination) ? (
                  <Text style={{ fontSize: 18 }}>{getDestinationFlag(item.destination)}</Text>
                ) : null}
              </View>
              {item.month && (
                <Text style={{ fontSize: 12, color: theme.mutedForeground }}>
                  📅 {item.month}
                </Text>
              )}
              {/* Pulsing status row */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                <View style={{ width: 10, height: 10, alignItems: "center", justifyContent: "center" }}>
                  <RNAnimated.View style={{
                    position: "absolute",
                    width: 10, height: 10, borderRadius: 5,
                    borderWidth: 1.5, borderColor: accentColor,
                    transform: [{ scale: pulseScale }],
                    opacity: pulseOpacity,
                  }} />
                  <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: accentColor }} />
                </View>
                <Text style={{ fontSize: 11, fontWeight: "600", color: accentColor }}>
                  {isMatched ? "Deal matched!" : "Watching for deals"}
                </Text>
              </View>
            </View>

            {/* Swipe hint */}
            <View style={{ justifyContent: "center", paddingRight: 14 }}>
              <Text style={{ fontSize: 10, color: theme.mutedForeground, opacity: 0.5 }}>⟵</Text>
            </View>
          </View>
        </RNAnimated.View>
      </View>
    );
  };

  const renderAlert = ({ item }: { item: any }) => <SwipeableAlert item={item} />;

  const isBadgeEarned = (badge: (typeof ALL_BADGES)[number]) =>
    earnedBadges.some((b) => b.id === badge.id);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={["top", "left", "right"]}>
      <FlatList
        data={tab === "saved" ? deals : alerts}
        renderItem={tab === "saved" ? renderSavedDeal : renderAlert}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadData(); }}
            tintColor={colors.brand.traceRed}
          />
        }
        ListHeaderComponent={
          <View style={{ paddingTop: 16 }}>
            <Text style={{ fontSize: 24, fontWeight: "900", color: theme.foreground, marginBottom: 16 }}>
              Dashboard
            </Text>

            {/* Collapsible profile section — single unified card */}
            <View
              style={{
                backgroundColor: theme.card,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: "#2563eb",
                marginBottom: 16,
                overflow: "hidden",
              }}
            >
              {/* Header row — always visible */}
              {(() => {
                const { current, next, isMax, swipesToNext } = getLevelInfo(level, swipeCount);
                const progress = (swipeCount % SWIPES_PER_LEVEL) / SWIPES_PER_LEVEL;
                return (
                  <TouchableOpacity activeOpacity={0.8} onPress={() => setShowProfile((v) => !v)}>
                    <LinearGradient
                      colors={["#1e3a8a", "#2563eb", "#3b82f6"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14, gap: 12 }}
                    >
                      {/* Top row: personality + chevron */}
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                        <Text style={{ fontSize: 30 }}>{personality.emoji || "🌍"}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 15, fontWeight: "800", color: "#fff" }}>
                            {personality.title || "Explorer"}
                          </Text>
                          <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>
                            {earnedBadges.length}/{ALL_BADGES.length} badges earned
                          </Text>
                        </View>
                        {showProfile
                          ? <ChevronUp size={18} color="rgba(255,255,255,0.6)" />
                          : <ChevronDown size={18} color="rgba(255,255,255,0.6)" />
                        }
                      </View>

                      {/* Level row — always visible */}
                      <View style={{
                        backgroundColor: "rgba(0,0,0,0.2)",
                        borderRadius: 10,
                        padding: 10,
                        gap: 6,
                      }}>
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <Text style={{ fontSize: 16 }}>{current.emoji}</Text>
                            <Text style={{ fontSize: 14, fontWeight: "800", color: "#fff" }}>
                              {current.title}
                            </Text>
                          </View>
                          <Text style={{ fontSize: 11, fontWeight: "700", color: "rgba(255,255,255,0.6)", letterSpacing: 1 }}>
                            LVL {level}
                          </Text>
                        </View>
                        {!isMax && (
                          <>
                            <View style={{ height: 4, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 2, overflow: "hidden" }}>
                              <View style={{ height: "100%", width: `${Math.max(4, Math.round(progress * 100))}%`, backgroundColor: "#fff", borderRadius: 2 }} />
                            </View>
                            <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>
                              {swipesToNext} swipe{swipesToNext === 1 ? "" : "s"} to {next.emoji} {next.title}
                            </Text>
                          </>
                        )}
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                );
              })()}

              {/* Expanded content */}
              {showProfile && (
                <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(140)}>
                  {/* Description */}
                  <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14, borderTopWidth: 1, borderTopColor: theme.border }}>
                    <Text style={{ fontSize: 13, color: theme.mutedForeground, lineHeight: 19 }}>
                      {personality.description || "Ready for any adventure"}
                    </Text>
                  </View>

                  {/* Stats row */}
                  <View style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: theme.border, paddingVertical: 14 }}>
                    {[
                      { value: swipeCount, label: "Swipes" },
                      { value: streakDays, label: "Day streak" },
                      { value: deals.length, label: "Saved" },
                    ].map(({ value, label }, i, arr) => (
                      <View
                        key={label}
                        style={{
                          flex: 1,
                          alignItems: "center",
                          borderRightWidth: i < arr.length - 1 ? 1 : 0,
                          borderRightColor: theme.border,
                        }}
                      >
                        <Text style={{ fontSize: 20, fontWeight: "800", color: theme.foreground }}>{value}</Text>
                        <Text style={{ fontSize: 11, color: theme.mutedForeground, marginTop: 2 }}>{label}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Badges */}
                  <View style={{ borderTopWidth: 1, borderTopColor: theme.border, padding: 16 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: theme.foreground }}>Badges</Text>
                      <Text style={{ fontSize: 12, color: theme.mutedForeground }}>
                        {earnedBadges.length}/{ALL_BADGES.length} earned
                      </Text>
                    </View>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      {ALL_BADGES.map((badge) => {
                        const earned = isBadgeEarned(badge);
                        return (
                          <TouchableOpacity
                            key={badge.id}
                            onPress={() => setSelectedBadge(badge)}
                            activeOpacity={0.7}
                            style={{
                              alignItems: "center",
                              width: "22%",
                              paddingVertical: 10,
                              paddingHorizontal: 4,
                              borderRadius: 12,
                              backgroundColor: earned ? colors.brand.traceRed + "10" : theme.muted,
                              borderWidth: 1,
                              borderColor: earned ? colors.brand.traceRed + "30" : theme.border,
                              opacity: earned ? 1 : 0.45,
                            }}
                          >
                            <Text style={{ fontSize: 24 }}>{badge.emoji}</Text>
                            <Text
                              style={{ fontSize: 9, fontWeight: "600", color: theme.mutedForeground, textAlign: "center", marginTop: 5 }}
                              numberOfLines={2}
                            >
                              {badge.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                </Animated.View>
              )}
            </View>

            {/* Tabs + clear all */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <View style={{ flex: 1, flexDirection: "row", backgroundColor: theme.muted, borderRadius: 12, padding: 4 }}>
                <TouchableOpacity
                  onPress={() => setTab("saved")}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 10,
                    backgroundColor: tab === "saved" ? theme.card : "transparent",
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: "600", color: tab === "saved" ? colors.brand.traceRed : theme.mutedForeground }}>
                    Saved
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => isPremium ? setTab("alerts") : setShowAlertsUpgrade(true)}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 10,
                    backgroundColor: tab === "alerts" ? theme.card : "transparent",
                    alignItems: "center",
                    flexDirection: "row",
                    justifyContent: "center",
                    gap: 5,
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: "600", color: tab === "alerts" ? colors.brand.traceRed : theme.mutedForeground }}>
                    Alerts
                  </Text>
                  {!isPremium && (
                    <View style={{ backgroundColor: colors.brand.traceRed, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 }}>
                      <Text style={{ fontSize: 9, fontWeight: "800", color: "#fff" }}>PRO</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
              {tab === "saved" && deals.length > 0 && (
                <TouchableOpacity onPress={handleClearAll} style={{ paddingHorizontal: 10, paddingVertical: 8 }}>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: "#ef4444" }}>Clear All</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingVertical: 48 }}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>{tab === "saved" ? "✈️" : "🔔"}</Text>
            <Text style={{ fontSize: 16, fontWeight: "700", color: theme.foreground, marginBottom: 8 }}>
              {tab === "saved" ? "No saved deals yet" : "No alerts set"}
            </Text>
            <Text style={{ fontSize: 14, color: theme.mutedForeground, textAlign: "center" }}>
              {tab === "saved"
                ? "Swipe up on a deal to save it here"
                : "Set alerts in Explore to get notified"}
            </Text>
          </View>
        }
      />

      {expandedDeal && (
        <ExpandedDeal
          deal={expandedDeal}
          visible={!!expandedDeal}
          userProfile={profile}
          onClose={() => setExpandedDeal(null)}
          onSave={() => setExpandedDeal(null)}
          onBook={() => { if (expandedDeal?.url) Linking.openURL(expandedDeal.url); }}
          onShare={handleShareDeal}
        />
      )}

      <ShareNamePromptModal
        visible={showShareNamePrompt}
        onDismiss={() => { setShowShareNamePrompt(false); setPendingShareDeal(null); }}
        onSave={(name) => {
          setShowShareNamePrompt(false);
          if (pendingShareDeal) doShare(pendingShareDeal, name);
          setPendingShareDeal(null);
          // Persist so they're never asked again
          if (profile?.id) updateUserProfile(profile.id, { displayName: name }).catch(() => {});
        }}
      />

      {/* Badge detail popup */}
      <Modal
        transparent
        animationType="fade"
        visible={!!selectedBadge}
        onRequestClose={() => setSelectedBadge(null)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", paddingHorizontal: 32 }}
          activeOpacity={1}
          onPress={() => setSelectedBadge(null)}
        >
          {selectedBadge && (() => {
            const earned = isBadgeEarned(selectedBadge);
            return (
              <TouchableOpacity activeOpacity={1} onPress={() => {}}>
                <View
                  style={{
                    backgroundColor: theme.card,
                    borderRadius: 24,
                    paddingVertical: 28,
                    paddingHorizontal: 24,
                    width: 300,
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: theme.border,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.15,
                    shadowRadius: 16,
                    elevation: 10,
                  }}
                >
                  <Text style={{ fontSize: 52, marginBottom: 14, opacity: earned ? 1 : 0.35 }}>{selectedBadge.emoji}</Text>

                  <Text style={{ fontSize: 11, fontWeight: "700", color: earned ? colors.brand.traceRed : theme.mutedForeground, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
                    {earned ? "✓  Earned" : "Not yet earned"}
                  </Text>

                  <Text style={{ fontSize: 20, fontWeight: "900", color: theme.foreground, textAlign: "center", marginBottom: 8 }}>
                    {selectedBadge.name}
                  </Text>

                  {!earned && (
                    <>
                      <View style={{ width: "100%", height: 1, backgroundColor: theme.border, marginVertical: 16 }} />
                      <Text style={{ fontSize: 10, fontWeight: "800", color: theme.mutedForeground, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
                        How to unlock
                      </Text>
                      <Text style={{ fontSize: 14, color: theme.foreground, textAlign: "center", lineHeight: 20, marginBottom: 4 }}>
                        {selectedBadge.desc}
                      </Text>
                    </>
                  )}

                  {earned && (
                    <Text style={{ fontSize: 13, color: theme.mutedForeground, textAlign: "center", lineHeight: 19, marginTop: 4 }}>
                      {selectedBadge.desc}
                    </Text>
                  )}

                  <TouchableOpacity
                    onPress={() => setSelectedBadge(null)}
                    style={{
                      marginTop: 24,
                      borderRadius: 999,
                      paddingVertical: 11,
                      paddingHorizontal: 32,
                      borderWidth: 1.5,
                      borderColor: theme.border,
                    }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: "700", color: theme.mutedForeground }}>Close</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })()}
        </TouchableOpacity>
      </Modal>

      {alertSavedToast && (
        <View style={{
          position: "absolute", bottom: 24, left: 24, right: 24,
          backgroundColor: colors.brand.traceRed,
          borderRadius: 14, paddingVertical: 14, paddingHorizontal: 18,
          flexDirection: "row", alignItems: "center", gap: 10,
          shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2, shadowRadius: 8, elevation: 8,
        }}>
          <BellRing size={18} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700", flex: 1 }}>
            Alert saved! We'll notify you when a deal pops up.
          </Text>
        </View>
      )}

      {/* Alerts upgrade modal */}
      <Modal visible={showAlertsUpgrade} transparent animationType="fade" onRequestClose={() => setShowAlertsUpgrade(false)}>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}
          activeOpacity={1}
          onPress={() => setShowAlertsUpgrade(false)}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={{ backgroundColor: theme.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: theme.border, alignSelf: "center", marginBottom: 24 }} />
              <Text style={{ fontSize: 28, textAlign: "center", marginBottom: 12 }}>🔔</Text>
              <Text style={{ fontSize: 20, fontWeight: "900", color: theme.foreground, textAlign: "center", marginBottom: 8 }}>
                Deal Alerts is a Premium Feature
              </Text>
              <Text style={{ fontSize: 14, color: theme.mutedForeground, textAlign: "center", lineHeight: 20, marginBottom: 28 }}>
                Upgrade to get notified the moment a deal drops for your saved destinations — before anyone else.
              </Text>
              <TouchableOpacity
                onPress={() => { setShowAlertsUpgrade(false); navigation.navigate("Paywall", { entryPoint: "dashboard_alerts_upgrade" }); }}
                activeOpacity={0.85}
                style={{ borderRadius: 14, overflow: "hidden", marginBottom: 12 }}
              >
                <LinearGradient
                  colors={[colors.brand.traceRed, colors.brand.tracePink]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ paddingVertical: 15, alignItems: "center" }}
                >
                  <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>Upgrade to Premium</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowAlertsUpgrade(false)}
                style={{ paddingVertical: 13, alignItems: "center" }}
              >
                <Text style={{ fontSize: 14, color: theme.mutedForeground, fontWeight: "600" }}>Maybe later</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}
