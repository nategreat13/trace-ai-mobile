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
import { ChevronRight, ChevronDown, ChevronUp, Trash2 } from "lucide-react-native";
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

            {/* Collapsible profile section — single unified card */}
            <View
              style={{
                backgroundColor: theme.card,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: "#1e3a5f",
                marginBottom: 16,
                overflow: "hidden",
              }}
            >
              {/* Header row — always visible */}
              <TouchableOpacity activeOpacity={0.8} onPress={() => setShowProfile((v) => !v)}>
                <LinearGradient
                  colors={["#0f172a", "#1e3a5f", "#1a4080"]}
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
    </SafeAreaView>
  );
}
