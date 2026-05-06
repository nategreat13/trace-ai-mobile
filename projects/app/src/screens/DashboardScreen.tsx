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
} from "react-native";
import { useRoute, useNavigation, useFocusEffect } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { TabParamList, RootStackParamList } from "../navigation/types";
import Animated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronRight, ChevronDown, ChevronUp, Trash2, BellRing } from "lucide-react-native";
import ExpandedDeal from "../components/swipe/ExpandedDeal";
import TraceLoader from "../components/TraceLoader";
import { colors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";
import { useTrialEligibility } from "../hooks/useTrialEligibility";
import {
  getSavedDeals,
  getSwipeActions,
  deleteSavedDeal,
  deleteSwipeAction,
  getDealAlerts,
  deleteDealAlert,
} from "../services/firestore";
import { ALL_BADGES } from "../lib/constants";

export default function DashboardScreen() {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;
  const { user, profile, isPremium } = useAuth();
  const trialEligible = useTrialEligibility();
  const route = useRoute<RouteProp<TabParamList, "Dashboard">>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [deals, setDeals] = useState<any[]>([]);
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
    } catch (err) {
      console.error("Failed to load dashboard:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.uid]);

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
  const progressInLevel = (swipeCount % 25) / 25;

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
    return (
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(220)}
        layout={LinearTransition.duration(200)}
        style={{
          backgroundColor: theme.card,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: theme.border,
          overflow: "hidden",
          marginBottom: 12,
          opacity: isDeleting ? 0.4 : 1,
        }}
      >
        <TouchableOpacity activeOpacity={0.85} onPress={() => setExpandedDeal(savedDealToDeal(item))}>
          {item.imageUrl ? (
            <View style={{ position: "relative" }}>
              <Image source={{ uri: item.imageUrl }} style={{ width: "100%", height: 160 }} contentFit="cover" />
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
              {item.duration && (
                <View style={{
                  position: "absolute", bottom: 10, right: 10,
                  backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 8,
                  paddingHorizontal: 8, paddingVertical: 4,
                }}>
                  <Text style={{ color: "#fff", fontSize: 11, fontWeight: "600" }}>{item.duration}</Text>
                </View>
              )}
            </View>
          ) : null}
          <View style={{ padding: 12 }}>
            {/* Origin → Destination */}
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6, gap: 4 }}>
              {item.origin ? (
                <Text style={{ fontSize: 12, color: theme.mutedForeground, fontWeight: "600" }}>
                  {item.origin} → {item.destination}
                </Text>
              ) : (
                <Text style={{ fontSize: 15, fontWeight: "800", color: theme.foreground }} numberOfLines={1}>{item.destination}</Text>
              )}
            </View>
            {/* Price row */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
                <Text style={{ fontSize: 20, fontWeight: "800", color: theme.foreground }}>${item.price}</Text>
                {item.originalPrice > 0 && item.originalPrice !== item.price && (
                  <Text style={{ fontSize: 13, color: theme.mutedForeground, textDecorationLine: "line-through" }}>
                    ${item.originalPrice}
                  </Text>
                )}
              </View>
              <ChevronRight size={16} color={theme.mutedForeground} />
            </View>
            {/* Travel window */}
            {item.travelWindow && (
              <Text style={{ fontSize: 12, color: theme.mutedForeground, marginTop: 4 }} numberOfLines={1}>
                📅 {item.travelWindow}
              </Text>
            )}
            {/* Airline */}
            {item.airlines && (
              <Text style={{ fontSize: 12, color: theme.mutedForeground, marginTop: 2 }} numberOfLines={1}>
                ✈️ {item.airlines}
              </Text>
            )}
            {/* Vibe */}
            {item.vibeDescription && (
              <Text style={{ fontSize: 12, color: theme.mutedForeground, marginTop: 4, fontStyle: "italic" }} numberOfLines={2}>
                {item.vibeDescription}
              </Text>
            )}
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleDeleteDeal(item.id)}
          disabled={isDeleting}
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: "rgba(0,0,0,0.45)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Trash2 color="#fff" size={14} />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const SwipeableAlert = ({ item }: { item: any }) => {
    const translateX = useRef(new RNAnimated.Value(0)).current;
    const DELETE_THRESHOLD = -80;

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
      <View style={{ marginBottom: 8, overflow: "hidden", borderRadius: 12 }}>
        {/* Red delete background */}
        <RNAnimated.View
          style={{
            position: "absolute", top: 0, bottom: 0, right: 0, left: 0,
            backgroundColor: "#ef4444",
            borderRadius: 12,
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
              borderRadius: 12,
              borderWidth: 1,
              borderColor: theme.border,
              padding: 16,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: theme.foreground }}>{item.destination}</Text>
              {item.month && (
                <Text style={{ fontSize: 12, color: theme.mutedForeground, marginTop: 2 }}>{item.month}</Text>
              )}
              <Text style={{ fontSize: 11, color: theme.mutedForeground, marginTop: 4 }}>Swipe left to delete</Text>
            </View>
            <View
              style={{
                backgroundColor: item.status === "matched" ? "#dcfce7" : theme.muted,
                borderRadius: 999,
                paddingHorizontal: 10,
                paddingVertical: 4,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "600",
                  color: item.status === "matched" ? "#16a34a" : theme.mutedForeground,
                }}
              >
                {item.status === "matched" ? "Matched!" : "Active"}
              </Text>
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
              <TouchableOpacity activeOpacity={0.8} onPress={() => setShowProfile((v) => !v)}>
                <LinearGradient
                  colors={["#1e3a8a", "#2563eb", "#3b82f6"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 16,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <Text style={{ fontSize: 30 }}>{personality.emoji || "🌍"}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: "800", color: "#fff" }}>
                      {personality.title || "Explorer"}
                    </Text>
                    <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>
                      Lv {level}  ·  {earnedBadges.length}/{ALL_BADGES.length} badges earned
                    </Text>
                  </View>
                  {showProfile
                    ? <ChevronUp size={18} color="rgba(255,255,255,0.6)" />
                    : <ChevronDown size={18} color="rgba(255,255,255,0.6)" />
                  }
                </LinearGradient>
              </TouchableOpacity>

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

                  {/* Level progress */}
                  <View style={{ paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 14 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                      <Text style={{ fontSize: 12, fontWeight: "600", color: theme.mutedForeground }}>
                        Level {level} Deal Hunter
                      </Text>
                      <Text style={{ fontSize: 12, color: theme.mutedForeground }}>
                        {25 - (swipeCount % 25)} to Lv {level + 1}
                      </Text>
                    </View>
                    <View style={{ height: 5, borderRadius: 999, backgroundColor: theme.muted, overflow: "hidden" }}>
                      <View
                        style={{
                          height: "100%",
                          borderRadius: 999,
                          backgroundColor: colors.brand.traceRed,
                          width: `${Math.max(4, Math.round(progressInLevel * 100))}%`,
                        }}
                      />
                    </View>
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
        />
      )}

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
                {trialEligible
                  ? "Try Premium free for 3 days — get notified the moment a deal drops for your saved destinations."
                  : "Upgrade to get notified the moment a deal drops for your saved destinations — before anyone else."}
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
                  <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>
                    {trialEligible ? "Start 3-day free trial" : "Upgrade to Premium"}
                  </Text>
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
