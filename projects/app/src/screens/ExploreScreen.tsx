import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  useColorScheme,
  RefreshControl,
  Linking,
  ScrollView,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Search, SlidersHorizontal, Bookmark, BookmarkCheck, X, Bell, BellRing } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { colors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";
import { useFreeTrial } from "../context/TrialContext";
import { fetchDeals, fetchPremiumDeals } from "../services/dealsApi";
import { createSwipeAction, saveDeal, getSwipeActions, createDealAlert } from "../services/firestore";
import { dealMatchesType } from "../lib/dealClassifier";
import { trendingScore } from "../lib/dealScorer";
import ExploreFilters, { ExploreFilterState } from "../components/explore/ExploreFilters";
import TraceLoader from "../components/TraceLoader";
import ExpandedDeal from "../components/swipe/ExpandedDeal";
import { AIRPORTS } from "../components/onboarding/AirportInput";
import type { Deal } from "@trace/shared";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const MONTH_ABBR: Record<string, string> = {
  january: "Jan", february: "Feb", march: "Mar", april: "Apr",
  may: "May", june: "Jun", july: "Jul", august: "Aug",
  september: "Sep", october: "Oct", november: "Nov", december: "Dec",
};
function abbreviateMonths(s: string): string {
  return s.replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/gi,
    (m) => MONTH_ABBR[m.toLowerCase()] ?? m);
}

export default function ExploreScreen() {
  const navigation = useNavigation<Nav>();
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;
  const { user, profile, isPremium } = useAuth();
  const { available: trialAvailable, label: trialLabel } = useFreeTrial();

  const [deals, setDeals] = useState<Deal[]>([]);
  const [savedDealIds, setSavedDealIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedDeal, setExpandedDeal] = useState<Deal | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [pendingAlertDest, setPendingAlertDest] = useState<{ label: string; code?: string } | null>(null);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<Record<string, number>>({});
  const [filters, setFilters] = useState<ExploreFilterState>({
    search: "",
    months: [],
    dealTypes: [],
    sort: "newest",
    cabinClass: "all",
    destination: "both",
  });

  const loadDeals = async () => {
    if (!profile) return;
    try {
      const airportCode = profile.homeAirport || "LAX";
      const isBusinessMember = profile.subscriptionStatus === "business";
      const [apiDeals, premiumApiDeals] = await Promise.all([
        fetchDeals(airportCode),
        isBusinessMember ? fetchPremiumDeals(airportCode) : Promise.resolve([]),
      ]);
      // Business class deals are only shown to business members
      const allApiDeals = isBusinessMember
        ? [...apiDeals, ...premiumApiDeals]
        : apiDeals.filter((d) => !d.is_business_class);

      // Filter to 6-month window
      const now = new Date();
      const sixMonths = new Date(now);
      sixMonths.setMonth(sixMonths.getMonth() + 6);
      const months = [
        "january", "february", "march", "april", "may", "june",
        "july", "august", "september", "october", "november", "december",
      ];

      const filtered = allApiDeals.filter((deal) => {
        if (!deal.dateString) return true;
        let dealDate: Date;
        if (deal.dateString.match(/^\d{4}-\d{2}-\d{2}/)) {
          dealDate = new Date(deal.dateString);
        } else {
          const monthStr = deal.dateString.toLowerCase().trim();
          const month = months.indexOf(monthStr);
          if (month === -1) return true;
          let year = now.getFullYear();
          dealDate = new Date(year, month, 1);
          if (dealDate < now) dealDate = new Date(year + 1, month, 1);
        }
        return dealDate >= now && dealDate < sixMonths;
      });
      setDeals(filtered);

      // Get saved deal IDs
      if (user) {
        const swipes = await getSwipeActions(user.uid);
        const saved = new Set(
          swipes.filter((s: any) => s.action === "super").map((s: any) => s.dealId)
        );
        setSavedDealIds(saved);
      }
    } catch (error) {
      console.error("Failed to load explore:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDeals();
  }, [profile?.id]);


  useFocusEffect(
    useCallback(() => {
      return () => {
        setSearchTerm("");
        setSearchFocused(false);
        setPendingAlertDest(null);
      };
    }, [])
  );

  const { filteredDeals, dealVariants } = useMemo(() => {
    let result = deals;

    // Search filter
    const term = searchTerm || filters.search;
    if (term) {
      result = result.filter(
        (d) =>
          d.destination?.toLowerCase().includes(term.toLowerCase()) ||
          d.destination_code?.toLowerCase().includes(term.toLowerCase())
      );
    }

    // Cabin class filter
    if (filters.cabinClass === "business") {
      result = result.filter((d) => d.is_business_class);
    } else if (filters.cabinClass === "economy") {
      result = result.filter((d) => !d.is_business_class);
    }

    // Destination filter
    if (filters.destination === "domestic") {
      result = result.filter((d) =>
        d.domestic_or_international?.toLowerCase().includes("domestic")
      );
    } else if (filters.destination === "international") {
      result = result.filter((d) =>
        d.domestic_or_international?.toLowerCase().includes("international")
      );
    }

    // Month filter
    if (filters.months.length > 0) {
      result = result.filter((d) => {
        if (!d.travel_window) return false;
        return filters.months.some((m) =>
          d.travel_window!.toLowerCase().includes(m.toLowerCase())
        );
      });
    }

    // Deal type filter
    if (filters.dealTypes.length > 0) {
      result = result.filter((d) =>
        filters.dealTypes.some((type) => dealMatchesType({ ...d, deal_type: d.deal_type ?? undefined }, type))
      );
    }

    // Group by destination, keeping all month variants, sorted by soonest month first
    const MONTHS = ["january","february","march","april","may","june","july","august","september","october","november","december"];
    const nowMonth = new Date().getMonth(); // 0-11
    const monthSortKey = (deal: Deal): number => {
      const tw = (deal.travel_window || deal.dateString || "").toLowerCase();
      const idx = MONTHS.findIndex((m) => tw.includes(m));
      if (idx === -1) return 99;
      // Distance from now, wrapping year so soonest = smallest value
      return (idx - nowMonth + 12) % 12;
    };

    const variantsMap = new Map<string, Deal[]>();
    result.forEach((deal) => {
      const key = deal.destination;
      if (!variantsMap.has(key)) variantsMap.set(key, []);
      variantsMap.get(key)!.push(deal);
    });
    variantsMap.forEach((variants, key) => {
      variantsMap.set(key, variants.sort((a, b) => monthSortKey(a) - monthSortKey(b)));
    });

    // One entry per destination (cheapest deal as the representative)
    const deduped = Array.from(variantsMap.values()).map((variants) => variants[0]);

    // Sort
    if (filters.sort === "price") {
      deduped.sort((a, b) => (a.price || 0) - (b.price || 0));
    } else if (filters.sort === "discount") {
      deduped.sort((a, b) => (b.discount_pct || 0) - (a.discount_pct || 0));
    } else {
      // Default: trending score — blends discount, urgency, departure timing, and price trend
      deduped.sort((a, b) => trendingScore(b) - trendingScore(a));
    }

    return { filteredDeals: deduped, dealVariants: variantsMap };
  }, [deals, searchTerm, filters]);

  const handleSave = async (deal: Deal) => {
    if (!user || !profile) return;
    if (!isPremium && savedDealIds.size >= 3) {
      navigation.navigate("Paywall", { entryPoint: "explore_save_limit" });
      return;
    }
    await saveDeal({
      userId: user.uid,
      originalDealId: deal.id,
      destination: deal.destination,
      destinationCode: deal.destination_code,
      origin: deal.origin,
      price: deal.price,
      originalPrice: deal.original_price,
      discountPct: deal.discount_pct,
      travelWindow: deal.travel_window,
      dealType: deal.deal_type,
      imageUrl: deal.image_url,
      aiInsight: deal.ai_insight,
      vibeDescription: deal.vibe_description,
      weatherPreview: deal.weather_preview,
      continent: deal.continent,
      urgency: deal.urgency,
      priceTrend: deal.price_trend,
      url: deal.url,
      airlines: deal.airlines,
      duration: deal.duration,
      layoverInfo: deal.layover_info,
      isBusinessClass: deal.is_business_class || false,
    });
    await createSwipeAction({
      userId: user.uid,
      dealId: deal.id,
      action: "super",
      dealType: deal.deal_type,
      destination: deal.destination,
      continent: deal.continent,
      price: deal.price,
      domesticOrInternational: deal.domestic_or_international,
    });
    setSavedDealIds((prev) => new Set([...prev, deal.id]));
  };

  const handleFiltersChange = (newFilters: ExploreFilterState) => {
    setFilters(newFilters);
    if (newFilters.search) {
      setSearchTerm(newFilters.search);
    }
  };

  const removeFilter = (type: string, value?: string) => {
    if (type === "search") {
      setSearchTerm("");
      setFilters((prev) => ({ ...prev, search: "" }));
    } else if (type === "cabinClass") {
      setFilters((prev) => ({ ...prev, cabinClass: "all" }));
    } else if (type === "destination") {
      setFilters((prev) => ({ ...prev, destination: "both" }));
    } else if (type === "month" && value) {
      setFilters((prev) => ({
        ...prev,
        months: prev.months.filter((m) => m !== value),
      }));
    } else if (type === "dealType" && value) {
      setFilters((prev) => ({
        ...prev,
        dealTypes: prev.dealTypes.filter((t) => t !== value),
      }));
    }
  };

  const hasActiveFilters =
    !!searchTerm ||
    !!filters.search ||
    filters.cabinClass !== "all" ||
    filters.destination !== "both" ||
    filters.months.length > 0 ||
    filters.dealTypes.length > 0;

  const handleCreateAlert = async (dest: { label: string; code?: string }) => {
    if (!user) return;
    if (!isPremium) { navigation.navigate("Paywall", { entryPoint: "explore_create_alert" }); return; }
    await createDealAlert({
      userId: user.uid,
      destination: dest.label,
      month: null,
      status: "active",
    });
    setPendingAlertDest(null);
    navigation.navigate("MainTabs", {
      screen: "Dashboard",
      params: { tab: "alerts", alertSaved: true },
    });
  };

  const FREE_NORMAL = 5;
  const FREE_BLURRED = 5;

  type ListItem = Deal | { type: "paywall" };

  const isFiltered = !!(
    searchTerm ||
    filters.search ||
    filters.months.length > 0 ||
    filters.dealTypes.length > 0 ||
    filters.cabinClass !== "all" ||
    filters.destination !== "both" ||
    filters.sort !== "newest"
  );

  const listData: ListItem[] = useMemo(() => {
    if (isPremium) return filteredDeals;

    // When search/filters are active, lock all results — free picks only apply
    // to the unfiltered default view.
    if (isFiltered) {
      if (filteredDeals.length === 0) return [];
      return [{ type: "paywall" as const }, ...filteredDeals.slice(0, FREE_BLURRED)];
    }

    // Curate free sample: 3 cheapest domestic + 2 cheapest international
    const domestic = filteredDeals
      .filter((d) => d.domestic_or_international?.toLowerCase().includes("domestic"))
      .sort((a, b) => (a.price || 0) - (b.price || 0));
    const international = filteredDeals
      .filter((d) => d.domestic_or_international?.toLowerCase().includes("international"))
      .sort((a, b) => (a.price || 0) - (b.price || 0));

    const picks: Deal[] = [
      ...domestic.slice(0, 3),
      ...international.slice(0, 2),
    ];

    // Fall back to cheapest deals if we couldn't fill all 5 slots
    if (picks.length < FREE_NORMAL) {
      const pickIds = new Set(picks.map((d) => d.id));
      const fallback = filteredDeals.filter((d) => !pickIds.has(d.id));
      picks.push(...fallback.slice(0, FREE_NORMAL - picks.length));
    }

    const pickIds = new Set(picks.map((d) => d.id));
    const blurred = filteredDeals
      .filter((d) => !pickIds.has(d.id))
      .slice(0, FREE_BLURRED);

    if (filteredDeals.length <= picks.length) return picks;
    return [...picks, { type: "paywall" as const }, ...blurred];
  }, [filteredDeals, isPremium, isFiltered]);

  const renderDeal = (baseDeal: Deal, isBlurred: boolean) => {
    const variants = dealVariants.get(baseDeal.destination) || [baseDeal];
    const cheapestIdx = variants.reduce((best, v, i) => (v.price || 0) < (variants[best].price || 0) ? i : best, 0);
    const selectedIdx = selectedMonthIndex[baseDeal.destination] ?? cheapestIdx;
    const deal = variants[selectedIdx] ?? baseDeal;
    const isSaved = savedDealIds.has(deal.id);

    return (
      <View
        key={deal.id}
        style={{
          backgroundColor: theme.card,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: theme.border,
          overflow: "hidden",
          marginBottom: 12,
        }}
      >
        {/* Image */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => isBlurred ? navigation.navigate("Paywall", { entryPoint: "explore_blurred_deal" }) : setExpandedDeal(deal)}
        >
          <View style={{ position: "relative", height: 200 }}>
            <Image
              source={{ uri: deal.image_url }}
              style={{ width: "100%", height: 200 }}
              contentFit="cover"
            />
            {isBlurred ? (
              /* Dark overlay + lock badge on image */
              <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.62)", justifyContent: "center", alignItems: "center", gap: 10 }}>
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.15)", justifyContent: "center", alignItems: "center", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.35)" }}>
                  <Text style={{ fontSize: 22 }}>🔒</Text>
                </View>
                <Text style={{ fontSize: 15, fontWeight: "800", color: "#fff", letterSpacing: 0.3 }}>Premium Deal</Text>
                <View style={{ borderWidth: 1.5, borderColor: "rgba(255,255,255,0.6)", borderRadius: 999, paddingHorizontal: 18, paddingVertical: 7 }}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: "#fff" }}>{trialAvailable ? "Try Free →" : "Unlock Access →"}</Text>
                </View>
              </View>
            ) : (
              <>
                <LinearGradient
                  colors={["rgba(0,0,0,0.0)", "rgba(0,0,0,0.15)", "rgba(0,0,0,0.55)", "rgba(0,0,0,0.92)"]}
                  locations={[0, 0.35, 0.65, 1]}
                  style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "100%" }}
                />
                {deal.discount_pct > 0 && (
                  <LinearGradient
                    colors={deal.discount_pct >= 50 ? ["#FF8C00", "#FF4500"] : ["#00D665", "#00B84D"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{ position: "absolute", top: 10, left: 10, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 }}
                  >
                    <Text style={{ color: "#fff", fontSize: 12, fontWeight: "800" }}>
                      {deal.discount_pct >= 50 ? "🔥 " : ""}{deal.discount_pct}% OFF
                    </Text>
                  </LinearGradient>
                )}
                <TouchableOpacity
                  onPress={() => handleSave(deal)}
                  style={{ position: "absolute", top: 10, right: 10, backgroundColor: isSaved ? "#fff" : "rgba(0,0,0,0.45)", borderRadius: 999, padding: 8 }}
                >
                  {isSaved
                    ? <BookmarkCheck color={colors.brand.traceRed} size={18} fill={colors.brand.traceRed} />
                    : <Bookmark color="#fff" size={18} />}
                </TouchableOpacity>
                <View style={{ position: "absolute", bottom: 12, left: 14, right: 14 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={{ fontSize: 20, fontWeight: "900", color: "#fff", textShadowColor: "rgba(0,0,0,0.6)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 }} numberOfLines={1}>
                        {deal.destination}
                      </Text>
                      {deal.vibe_description && (
                        <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 2 }} numberOfLines={1}>
                          {deal.vibe_description}
                        </Text>
                      )}
                      {(deal.duration || deal.is_business_class) && (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 5, flexWrap: "wrap" }}>
                          {deal.is_business_class && (
                            <View style={{ backgroundColor: colors.brand.amber500, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
                              <Text style={{ fontSize: 11, fontWeight: "800", color: "#fff" }}>👑 Business</Text>
                            </View>
                          )}
                          {deal.duration && (
                            <View style={{ backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
                              <Text style={{ fontSize: 11, fontWeight: "600", color: "rgba(255,255,255,0.9)" }}>✈ {deal.duration}</Text>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={{ fontSize: 22, fontWeight: "900", color: "#fff", textShadowColor: "rgba(0,0,0,0.6)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 }}>
                        ${deal.price}
                      </Text>
                      {deal.original_price > 0 && (
                        <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", textDecorationLine: "line-through" }}>
                          ${deal.original_price}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
              </>
            )}
          </View>
        </TouchableOpacity>

        {!isBlurred && <View style={{ paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12 }}>
          {variants.length > 0 && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 10 }}>
              {variants.map((v, i) => {
                const isSelected = i === selectedIdx;
                return isSelected ? (
                  <LinearGradient
                    key={v.id}
                    colors={[colors.brand.traceRed, colors.brand.tracePink]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{ borderRadius: 999 }}
                  >
                    <TouchableOpacity
                      onPress={() => setSelectedMonthIndex((prev) => ({ ...prev, [baseDeal.destination]: i }))}
                      style={{ paddingHorizontal: 12, paddingVertical: 7, flexDirection: "row", alignItems: "center", gap: 5 }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: "800", color: "#fff" }}>{v.travel_window ? abbreviateMonths(v.travel_window) : `Option ${i + 1}`}</Text>
                      <View style={{ width: 1, height: 12, backgroundColor: "rgba(255,255,255,0.4)" }} />
                      <Text style={{ fontSize: 12, fontWeight: "900", color: "#fff" }}>${v.price}</Text>
                    </TouchableOpacity>
                  </LinearGradient>
                ) : (
                  <TouchableOpacity
                    key={v.id}
                    onPress={() => setSelectedMonthIndex((prev) => ({ ...prev, [baseDeal.destination]: i }))}
                    style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: theme.muted, flexDirection: "row", alignItems: "center", gap: 5 }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: "700", color: theme.mutedForeground }}>{v.travel_window ? abbreviateMonths(v.travel_window) : `Option ${i + 1}`}</Text>
                    <View style={{ width: 1, height: 12, backgroundColor: theme.border }} />
                    <Text style={{ fontSize: 12, fontWeight: "800", color: theme.foreground }}>${v.price}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

        </View>}
      </View>
    );
  };

  const renderPaywall = () => (
    <View
      style={{
        backgroundColor: theme.card,
        borderRadius: 16,
        padding: 24,
        borderWidth: 1,
        borderColor: theme.border,
        alignItems: "center",
        marginBottom: 12,
      }}
    >
      <Text style={{ fontSize: 20, fontWeight: "800", color: theme.foreground, marginBottom: 8 }}>
        {trialAvailable ? "🎉 Try Premium Free" : "🔓 Unlock Full Access"}
      </Text>
      <Text style={{ fontSize: 13, color: theme.mutedForeground, textAlign: "center", marginBottom: 20 }}>
        {trialAvailable
          ? `Start your ${trialLabel} free trial — all ${filteredDeals.length}+ deals, plus deal alerts`
          : `Get access to all ${filteredDeals.length}+ deals with premium features`}
      </Text>
      <View style={{ flexDirection: "row", gap: 12, marginBottom: 20, width: "100%" }}>
        {[
          { emoji: "♾️", label: "Unlimited\nSwipes" },
          { emoji: "🔍", label: "Full\nExplore" },
          { emoji: "🔔", label: "Deal\nAlerts" },
        ].map((b, i) => (
          <View key={i} style={{ flex: 1, alignItems: "center", padding: 12, backgroundColor: theme.muted, borderRadius: 12 }}>
            <Text style={{ fontSize: 24, marginBottom: 4 }}>{b.emoji}</Text>
            <Text style={{ fontSize: 11, fontWeight: "600", color: theme.mutedForeground, textAlign: "center" }}>{b.label}</Text>
          </View>
        ))}
      </View>
      <LinearGradient
        colors={[colors.brand.traceRed, colors.brand.tracePink]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ borderRadius: 12, width: "100%" }}
      >
        <TouchableOpacity onPress={() => navigation.navigate("Paywall", { entryPoint: "explore_view_plans" })} style={{ paddingVertical: 14, alignItems: "center" }}>
          <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>
            {trialAvailable ? `Start ${trialLabel} free trial` : "View Plans"}
          </Text>
        </TouchableOpacity>
      </LinearGradient>
    </View>
  );

  const renderItem = ({ item, index }: { item: ListItem; index: number }) => {
    if ("type" in item && item.type === "paywall") return renderPaywall();
    const isBlurred = !isPremium && (isFiltered || index > FREE_NORMAL);
    return renderDeal(item as Deal, isBlurred);
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={["top", "left", "right"]}>
        <TraceLoader />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={["top", "left", "right"]}>
      {/* Header */}
      <LinearGradient
        colors={[
          scheme === "dark" ? "rgba(255,101,91,0.18)" : "rgba(255,101,91,0.10)",
          "transparent",
        ]}
        style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: theme.border }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <Text style={{ fontSize: 24, fontWeight: "900", color: colors.brand.traceRed }}>Explore Deals</Text>
          {profile?.homeAirport && (
            <LinearGradient
              colors={[colors.brand.traceRed, colors.brand.tracePink]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 }}
            >
              <Text style={{ fontSize: 12, fontWeight: "700", color: "#fff" }}>✈ {profile.homeAirport}</Text>
            </LinearGradient>
          )}
        </View>
        <Text style={{ fontSize: 12, color: theme.mutedForeground }}>Browse and save flights that match your vibe</Text>
      </LinearGradient>

      {/* Search + Filter button + active filter tags */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: hasActiveFilters ? 0 : (searchFocused && searchTerm.length > 0 ? 0 : 12), zIndex: 20, elevation: 20 }}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: theme.muted,
              borderRadius: 12,
              paddingHorizontal: 12,
              gap: 8,
            }}
          >
            <Search color={theme.mutedForeground} size={18} />
            <TextInput
              placeholder="Search destinations..."
              placeholderTextColor={theme.mutedForeground}
              value={searchTerm}
              onChangeText={(val) => { setSearchTerm(val); setPendingAlertDest(null); }}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
              autoCorrect={false}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              style={{ flex: 1, paddingVertical: 12, fontSize: 14, color: theme.foreground }}
            />
            {searchTerm.length > 0 && (
              <TouchableOpacity onPress={() => setSearchTerm("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X color={theme.mutedForeground} size={16} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            onPress={() => setShowFilters(true)}
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              backgroundColor: hasActiveFilters ? colors.brand.traceRed : theme.muted,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <SlidersHorizontal
              color={hasActiveFilters ? "#fff" : theme.mutedForeground}
              size={20}
            />
          </TouchableOpacity>
        </View>

        {/* Destination suggestions */}
        {searchFocused && searchTerm.length > 0 && (() => {
          const q = searchTerm.toLowerCase();
          const homeCode = profile?.homeAirport?.toUpperCase();

          // Airport matches: code, city, or name
          const airportMatches = AIRPORTS.filter((a) =>
            a.code.toLowerCase().includes(q) ||
            a.city.toLowerCase().includes(q) ||
            a.name.toLowerCase().includes(q)
          );

          // Deal destination matches (unique strings)
          const dealDestMatches = deals
            .map((d) => d.destination)
            .filter((dest, i, arr) => dest && arr.indexOf(dest) === i)
            .filter((dest) => dest.toLowerCase().includes(q));

          // Build unified suggestion list: airport entries first, then pure deal dest strings not already covered
          type Suggestion = { label: string; sub?: string; code?: string; isAirport: boolean; isHome: boolean };
          const seen = new Set<string>();
          const suggestions: Suggestion[] = [];

          airportMatches.forEach((a) => {
            const label = `${a.city}, ${a.state}`;
            if (!seen.has(label)) {
              seen.add(label);
              suggestions.push({ label, sub: `${a.code} · ${a.name.split(" ").slice(0, 3).join(" ")}`, code: a.code, isAirport: true, isHome: a.code === homeCode });
            }
          });

          dealDestMatches.forEach((dest) => {
            if (!seen.has(dest)) {
              seen.add(dest);
              suggestions.push({ label: dest, isAirport: false, isHome: false });
            }
          });

          // Sort: home airport first, then airports, then deal-only
          suggestions.sort((a, b) => {
            if (a.isHome !== b.isHome) return a.isHome ? -1 : 1;
            if (a.isAirport !== b.isAirport) return a.isAirport ? -1 : 1;
            return 0;
          });

          const visible = suggestions.slice(0, 6);
          if (!visible.length) return null;

          return (
            <View
              style={{
                backgroundColor: theme.card,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: theme.border,
                marginTop: 6,
                marginBottom: 8,
                overflow: "hidden",
              }}
            >
              {visible.map((s, index) => (
                <TouchableOpacity
                  key={s.label}
                  onPress={() => { setSearchTerm(s.label); setSearchFocused(false); setPendingAlertDest({ label: s.label, code: s.code }); }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderTopWidth: index === 0 ? 0 : 1,
                    borderTopColor: theme.border,
                    gap: 10,
                  }}
                >
                  <Search color={s.isHome ? colors.brand.traceRed : theme.mutedForeground} size={14} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, color: theme.foreground }} numberOfLines={1}>{s.label}</Text>
                    {s.sub && (
                      <Text style={{ fontSize: 11, color: theme.mutedForeground, marginTop: 1 }} numberOfLines={1}>{s.sub}</Text>
                    )}
                  </View>
                  {s.isHome && (
                    <Text style={{ fontSize: 10, color: colors.brand.traceRed, fontWeight: "700" }}>HOME</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          );
        })()}

        {/* Active filter tags */}
        {hasActiveFilters && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingVertical: 8 }}
          >
          {filters.cabinClass === "business" && (
            <TouchableOpacity
              onPress={() => removeFilter("cabinClass")}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                backgroundColor: colors.brand.amber500,
                borderRadius: 999,
                paddingHorizontal: 12,
                paddingVertical: 6,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "700", color: "#fff" }}>👑 Business Class</Text>
              <X size={12} color="#fff" />
            </TouchableOpacity>
          )}
          {filters.destination !== "both" && (
            <TouchableOpacity
              onPress={() => removeFilter("destination")}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                backgroundColor: theme.muted,
                borderRadius: 999,
                paddingHorizontal: 12,
                paddingVertical: 6,
              }}
            >
              <Text style={{ fontSize: 12, color: theme.foreground }}>
                {filters.destination === "domestic" ? "🇺🇸 Domestic" : "🌍 International"}
              </Text>
              <X size={12} color={theme.mutedForeground} />
            </TouchableOpacity>
          )}
          {filters.months.map((month) => (
            <TouchableOpacity
              key={month}
              onPress={() => removeFilter("month", month)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                backgroundColor: theme.muted,
                borderRadius: 999,
                paddingHorizontal: 12,
                paddingVertical: 6,
              }}
            >
              <Text style={{ fontSize: 12, color: theme.foreground }}>📅 {month}</Text>
              <X size={12} color={theme.mutedForeground} />
            </TouchableOpacity>
          ))}
          {filters.dealTypes.map((type) => (
            <LinearGradient
              key={type}
              colors={[colors.brand.traceRed, colors.brand.tracePink]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ borderRadius: 999 }}
            >
              <TouchableOpacity
                onPress={() => removeFilter("dealType", type)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                }}
              >
                <Text style={{ fontSize: 12, color: "#fff", fontWeight: "600" }}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </Text>
                <X size={12} color="#fff" />
              </TouchableOpacity>
            </LinearGradient>
          ))}
          </ScrollView>
        )}
      </View>

      {/* Deal count */}
      <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
        <Text style={{ fontSize: 12, fontWeight: "600", color: theme.mutedForeground }}>
          {isPremium
            ? `Showing ${filteredDeals.length} deal${filteredDeals.length !== 1 ? "s" : ""}`
            : `Showing ${Math.min(filteredDeals.length, FREE_NORMAL)} of ${filteredDeals.length} deals`}
        </Text>
      </View>

      {/* 1 save left warning */}
      {!isPremium && savedDealIds.size === 2 && (
        <Animated.View entering={FadeIn.duration(300)} style={{ paddingHorizontal: 16, marginBottom: 8 }}>
          <TouchableOpacity
            onPress={() => navigation.navigate("Paywall", { entryPoint: "explore_one_save_left" })}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              alignSelf: "flex-start",
              paddingHorizontal: 12,
              paddingVertical: 6,
              backgroundColor: "#fdf2f8",
              borderRadius: 999,
              borderWidth: 1,
              borderColor: "#f9a8d4",
            }}
          >
            <Text style={{ fontSize: 14 }}>🔖</Text>
            <Text style={{ fontSize: 12, fontWeight: "600", color: "#be185d" }}>
              1 save left — upgrade for unlimited
            </Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Deals list */}
      {pendingAlertDest && filteredDeals.length > 0 && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          <TouchableOpacity
            onPress={() => handleCreateAlert(pendingAlertDest)}
            style={{
              flexDirection: "row", alignItems: "center", gap: 10,
              backgroundColor: colors.brand.traceRed + "12",
              borderWidth: 1, borderColor: colors.brand.traceRed + "40",
              borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11,
            }}
            activeOpacity={0.7}
          >
            <BellRing size={15} color={colors.brand.traceRed} />
            <Text style={{ flex: 1, fontSize: 13, fontWeight: "600", color: colors.brand.traceRed }}>
              Get alerted for {pendingAlertDest.label}
            </Text>
            {!isPremium && (
              <View style={{ backgroundColor: colors.brand.traceRed, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 }}>
                <Text style={{ fontSize: 10, fontWeight: "800", color: "#fff" }}>Premium</Text>
              </View>
            )}
            <TouchableOpacity onPress={() => setPendingAlertDest(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={14} color={colors.brand.traceRed} />
            </TouchableOpacity>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={listData}
        renderItem={renderItem}
        keyExtractor={(item) => ("type" in item ? "paywall" : item.id)}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadDeals();
            }}
            tintColor={colors.brand.traceRed}
          />
        }
        ListFooterComponent={
          !isPremium && filteredDeals.length > FREE_NORMAL ? (
            <Text style={{ textAlign: "center", fontSize: 12, color: theme.mutedForeground, paddingVertical: 16, paddingHorizontal: 24 }}>
              {filteredDeals.length - FREE_NORMAL}+ more deals available with Premium
            </Text>
          ) : null
        }
        ListEmptyComponent={() => {
          if (!searchTerm) {
            return (
              <View style={{ alignItems: "center", paddingVertical: 48 }}>
                <Text style={{ fontSize: 48, marginBottom: 16 }}>🔍</Text>
                <Text style={{ fontSize: 18, fontWeight: "700", color: theme.foreground, marginBottom: 8 }}>No deals found</Text>
                <Text style={{ fontSize: 14, color: theme.mutedForeground }}>No deals match your filters</Text>
              </View>
            );
          }

          // If a dropdown suggestion was already picked, use it directly
          if (pendingAlertDest) {
            return (
              <View style={{ paddingVertical: 24 }}>
                <View style={{ alignItems: "center", marginBottom: 24 }}>
                  <Text style={{ fontSize: 40, marginBottom: 12 }}>✈️</Text>
                  <Text style={{ fontSize: 17, fontWeight: "700", color: theme.foreground, marginBottom: 6 }}>
                    No deals for "{pendingAlertDest.label}" right now
                  </Text>
                  <Text style={{ fontSize: 13, color: theme.mutedForeground, textAlign: "center" }}>
                    Get notified the moment one pops up on our radar
                  </Text>
                </View>
                <LinearGradient
                  colors={[colors.brand.traceRed, colors.brand.tracePink]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={{ borderRadius: 12, marginHorizontal: 0 }}
                >
                  <TouchableOpacity
                    onPress={() => handleCreateAlert(pendingAlertDest)}
                    style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, gap: 8 }}
                  >
                    <BellRing size={16} color="#fff" />
                    <Text style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}>
                      {isPremium ? `Alert me for ${pendingAlertDest.label}` : `Upgrade to get alerts${pendingAlertDest.code ? ` · ${pendingAlertDest.code}` : ""}`}
                    </Text>
                  </TouchableOpacity>
                </LinearGradient>
              </View>
            );
          }

          // Build validated suggestions from AIRPORTS list + unique deal destinations
          // Strip ", Region" suffix so "New York, NY" still matches city "New York"
          const cityQuery = searchTerm.split(",")[0].trim().toLowerCase();
          const airportMatches = AIRPORTS.filter((a) => {
            const q = cityQuery;
            return a.city.toLowerCase().includes(q) || a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q);
          }).slice(0, 5).map((a) => ({ label: `${a.city}, ${a.state}`, code: a.code }));

          const dealDestMatches = deals
            .map((d) => d.destination)
            .filter((dest, i, arr) => dest && arr.indexOf(dest) === i)
            .filter((dest) => dest.toLowerCase().includes(cityQuery))
            .slice(0, 4)
            .map((dest) => ({ label: dest, code: undefined }));

          // Explicit type — without it, TS infers the union of
          // `{ code: undefined }` (from dealDestMatches' literal `code:
          // undefined`) and `{ code: string }` (from airportMatches),
          // which then collapses the array element to `never` and made
          // `dest.label` below fail type-check.
          const allSuggestions: { label: string; code?: string }[] = [
            ...dealDestMatches,
            ...airportMatches.filter((a) => !dealDestMatches.some((d) => d.label.toLowerCase().includes(a.label.split(",")[0].toLowerCase()))),
          ];

          return (
            <View style={{ paddingVertical: 24 }}>
              <View style={{ alignItems: "center", marginBottom: 24 }}>
                <Text style={{ fontSize: 40, marginBottom: 12 }}>✈️</Text>
                <Text style={{ fontSize: 17, fontWeight: "700", color: theme.foreground, marginBottom: 6 }}>
                  No deals for "{searchTerm}" right now
                </Text>
                <Text style={{ fontSize: 13, color: theme.mutedForeground, textAlign: "center" }}>
                  Get notified the moment one pops up on our radar
                </Text>
              </View>

              {allSuggestions.length > 0 && (
                <View style={{ backgroundColor: theme.card, borderRadius: 16, borderWidth: 1, borderColor: theme.border, padding: 16 }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: theme.foreground, marginBottom: 12 }}>
                    Select a destination to track:
                  </Text>
                  <View style={{ gap: 8 }}>
                    {/* Suggestion picker. By the time we render this,
                        pendingAlertDest is guaranteed null — the
                        early-return above (`if (pendingAlertDest)
                        return ...`) handles the "already selected"
                        case with a different UI. So `isSelected` is
                        always false here; the styling that branched
                        on it is dead code, dropped. */}
                    {allSuggestions.map((dest) => (
                      <TouchableOpacity
                        key={dest.label}
                        onPress={() => setPendingAlertDest(dest)}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          paddingHorizontal: 14,
                          paddingVertical: 11,
                          borderRadius: 12,
                          borderWidth: 1.5,
                          borderColor: theme.border,
                          backgroundColor: theme.muted,
                          gap: 10,
                        }}
                      >
                        <Search size={14} color={theme.mutedForeground} />
                        <Text style={{ flex: 1, fontSize: 14, fontWeight: "600", color: theme.foreground }}>
                          {dest.label}
                        </Text>
                        {dest.code && (
                          <Text style={{ fontSize: 11, fontWeight: "700", color: theme.mutedForeground }}>
                            {dest.code}
                          </Text>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* The "Alert me for X" CTA block lived here, gated on
                      `pendingAlertDest && ...`. But since the early
                      return at line ~929 handles the truthy case (with
                      a similar CTA), this block was unreachable. Removed. */}
                </View>
              )}

              {allSuggestions.length === 0 && (
                <View style={{ alignItems: "center" }}>
                  <Text style={{ fontSize: 13, color: theme.mutedForeground }}>
                    No matching destinations found. Try a city or airport code.
                  </Text>
                </View>
              )}
            </View>
          );
        }}
      />

      {/* Filters modal */}
      {showFilters && (
        <ExploreFilters
          filters={filters}
          onFiltersChange={handleFiltersChange}
          onClose={() => setShowFilters(false)}
          isBusiness={profile?.subscriptionStatus === "business"}
          onUpgradeBusiness={() => {
            setShowFilters(false);
            navigation.navigate("Paywall", { entryPoint: "explore_filters_business" });
          }}
        />
      )}

      {expandedDeal && (
        <ExpandedDeal
          deal={expandedDeal}
          visible={!!expandedDeal}
          onClose={() => setExpandedDeal(null)}
          onSave={() => {
            handleSave(expandedDeal);
            setExpandedDeal(null);
          }}
          onBook={() => {
            if (expandedDeal.url) Linking.openURL(expandedDeal.url);
          }}
        />
      )}


    </SafeAreaView>
  );
}
