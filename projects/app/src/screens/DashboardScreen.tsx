import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  useColorScheme,
  RefreshControl,
  Alert,
  Linking,
  Modal,
} from "react-native";
import Animated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronRight, Trash2, Lock } from "lucide-react-native";
import ExpandedDeal from "../components/swipe/ExpandedDeal";
import { colors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";
import {
  getSavedDeals,
  getSwipeActions,
  deleteSavedDeal,
  deleteSwipeAction,
  getDealAlerts,
} from "../services/firestore";
import { ALL_BADGES } from "../lib/constants";

export default function DashboardScreen() {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;
  const { user, profile } = useAuth();

  const [deals, setDeals] = useState<any[]>([]);
  const [swipes, setSwipes] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<"saved" | "alerts">("saved");
  const [expandedDeal, setExpandedDeal] = useState<any | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [selectedBadge, setSelectedBadge] = useState<(typeof ALL_BADGES)[number] | null>(null);

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

  useEffect(() => {
    loadData();
  }, [loadData]);

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
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background, justifyContent: "center", alignItems: "center" }} edges={["top", "left", "right"]}>
        <ActivityIndicator size="large" color={colors.brand.traceRed} />
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
          {item.imageUrl && (
            <Image source={{ uri: item.imageUrl }} style={{ width: "100%", height: 120 }} contentFit="cover" />
          )}
          <View style={{ padding: 12 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 16, fontWeight: "800", color: theme.foreground, flex: 1 }} numberOfLines={1}>{item.destination}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={{ fontSize: 18, fontWeight: "800", color: theme.foreground }}>${item.price}</Text>
                <ChevronRight size={16} color={theme.mutedForeground} />
              </View>
            </View>
            {item.vibeDescription && (
              <Text style={{ fontSize: 12, color: theme.mutedForeground, marginTop: 4 }} numberOfLines={1}>
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

  const renderAlert = ({ item }: { item: any }) => (
    <View
      style={{
        backgroundColor: theme.card,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.border,
        padding: 16,
        marginBottom: 8,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <View>
        <Text style={{ fontSize: 14, fontWeight: "700", color: theme.foreground }}>{item.destination}</Text>
        {item.month && (
          <Text style={{ fontSize: 12, color: theme.mutedForeground, marginTop: 2 }}>{item.month}</Text>
        )}
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
  );

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

            {/* Personality hero card */}
            <LinearGradient
              colors={scheme === "dark" ? ["#1c1c2e", "#16213e", "#0f3460"] : ["#0f172a", "#1e3a5f", "#1a4080"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ borderRadius: 24, marginBottom: 12, overflow: "hidden", padding: 22 }}
            >
              <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, fontWeight: "800", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 14 }}>
                Travel Personality
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 20 }}>
                <View
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 20,
                    backgroundColor: "rgba(255,255,255,0.12)",
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.18)",
                  }}
                >
                  <Text style={{ fontSize: 38 }}>{personality.emoji || "🌍"}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 22, fontWeight: "900", color: "#fff", marginBottom: 5, lineHeight: 26 }}>
                    {personality.title || "Explorer"}
                  </Text>
                  <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 18 }}>
                    {personality.description || "Ready for any adventure"}
                  </Text>
                </View>
              </View>

              {/* Level bar */}
              <View style={{ borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.12)", paddingTop: 16 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: "rgba(255,255,255,0.8)" }}>
                    ⚡ Level {level} Deal Hunter
                  </Text>
                  <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>
                    {25 - (swipeCount % 25)} to Lv {level + 1}
                  </Text>
                </View>
                <View style={{ height: 6, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.15)", overflow: "hidden" }}>
                  <LinearGradient
                    colors={[colors.brand.traceRed, colors.brand.tracePink]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{
                      height: "100%",
                      borderRadius: 999,
                      width: `${Math.max(4, Math.round(progressInLevel * 100))}%`,
                    }}
                  />
                </View>
              </View>
            </LinearGradient>

            {/* Stats row */}
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
              {[
                { emoji: "👆", value: swipeCount, label: "Swipes", color: "#e65100", bg: scheme === "dark" ? "#2a1500" : "#fff3e0" },
                { emoji: "🔥", value: streakDays, label: "Streak", color: "#d97706", bg: scheme === "dark" ? "#251800" : "#fff8e1" },
                { emoji: "❤️", value: deals.length, label: "Saved", color: colors.brand.traceRed, bg: scheme === "dark" ? "#250010" : "#fce4ec" },
                { emoji: "🏅", value: `${earnedBadges.length}/${ALL_BADGES.length}`, label: "Badges", color: "#7c3aed", bg: scheme === "dark" ? "#1a0d2e" : "#f3e5f5" },
              ].map(({ emoji, value, label, color, bg }) => (
                <View key={label} style={{ flex: 1, backgroundColor: bg, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 6, alignItems: "center" }}>
                  <Text style={{ fontSize: 20 }}>{emoji}</Text>
                  <Text style={{ fontSize: 18, fontWeight: "900", color, marginTop: 4 }}>{value}</Text>
                  <Text style={{ fontSize: 10, fontWeight: "600", color, marginTop: 1, opacity: 0.8 }}>{label}</Text>
                </View>
              ))}
            </View>

            {/* Badges */}
            <View
              style={{
                backgroundColor: theme.card,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: theme.border,
                padding: 16,
                marginBottom: 16,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <Text style={{ fontSize: 15, fontWeight: "800", color: theme.foreground }}>Badges</Text>
                <Text style={{ fontSize: 12, color: theme.mutedForeground }}>
                  {earnedBadges.length} of {ALL_BADGES.length} earned
                </Text>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                {ALL_BADGES.map((badge) => {
                  const earned = isBadgeEarned(badge);
                  return (
                    <TouchableOpacity
                      key={badge.id}
                      onPress={() => setSelectedBadge(badge)}
                      activeOpacity={0.75}
                      style={{
                        alignItems: "center",
                        width: "22%",
                        paddingVertical: 12,
                        paddingHorizontal: 4,
                        borderRadius: 16,
                        backgroundColor: earned
                          ? colors.brand.traceRed + "14"
                          : theme.muted,
                        borderWidth: 1.5,
                        borderColor: earned
                          ? colors.brand.traceRed + "55"
                          : theme.border,
                      }}
                    >
                      <Text style={{ fontSize: 28, opacity: earned ? 1 : 0.3 }}>{badge.emoji}</Text>
                      <Text
                        style={{
                          fontSize: 9,
                          fontWeight: "700",
                          color: earned ? theme.foreground : theme.mutedForeground,
                          textAlign: "center",
                          marginTop: 6,
                          opacity: earned ? 1 : 0.5,
                        }}
                        numberOfLines={2}
                      >
                        {badge.name}
                      </Text>
                      {earned ? (
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brand.traceRed, marginTop: 5 }} />
                      ) : (
                        <Lock size={9} color={theme.mutedForeground} style={{ marginTop: 5, opacity: 0.4 }} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
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
                  onPress={() => setTab("alerts")}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 10,
                    backgroundColor: tab === "alerts" ? theme.card : "transparent",
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: "600", color: tab === "alerts" ? colors.brand.traceRed : theme.mutedForeground }}>
                    Alerts
                  </Text>
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
                    borderRadius: 28,
                    paddingVertical: 32,
                    paddingHorizontal: 28,
                    width: 300,
                    alignItems: "center",
                    borderWidth: 2,
                    borderColor: earned ? colors.brand.traceRed + "60" : theme.border,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 12 },
                    shadowOpacity: 0.3,
                    shadowRadius: 24,
                    elevation: 16,
                  }}
                >
                  {/* Emoji container */}
                  <View
                    style={{
                      width: 88,
                      height: 88,
                      borderRadius: 24,
                      backgroundColor: earned ? colors.brand.traceRed + "14" : theme.muted,
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: 16,
                      borderWidth: 1.5,
                      borderColor: earned ? colors.brand.traceRed + "40" : theme.border,
                    }}
                  >
                    <Text style={{ fontSize: 44, opacity: earned ? 1 : 0.4 }}>{selectedBadge.emoji}</Text>
                  </View>

                  {earned ? (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 5,
                        backgroundColor: colors.brand.traceRed + "14",
                        borderRadius: 999,
                        paddingHorizontal: 12,
                        paddingVertical: 4,
                        marginBottom: 10,
                      }}
                    >
                      <Text style={{ fontSize: 10, fontWeight: "900", color: colors.brand.traceRed, textTransform: "uppercase", letterSpacing: 1 }}>
                        ✓  Earned
                      </Text>
                    </View>
                  ) : (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 5,
                        backgroundColor: theme.muted,
                        borderRadius: 999,
                        paddingHorizontal: 12,
                        paddingVertical: 4,
                        marginBottom: 10,
                      }}
                    >
                      <Lock size={9} color={theme.mutedForeground} />
                      <Text style={{ fontSize: 10, fontWeight: "700", color: theme.mutedForeground, textTransform: "uppercase", letterSpacing: 1 }}>
                        Locked
                      </Text>
                    </View>
                  )}

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
    </SafeAreaView>
  );
}
