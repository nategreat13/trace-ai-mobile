import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  useColorScheme,
  RefreshControl,
  Linking,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Search, SlidersHorizontal, Bookmark, BookmarkCheck, X } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { colors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";
import { fetchDeals } from "../services/dealsApi";
import { createSwipeAction, saveDeal, getSwipeActions } from "../services/firestore";
import { dealMatchesType } from "../lib/dealClassifier";
import ExploreFilters, { ExploreFilterState } from "../components/explore/ExploreFilters";
import ExpandedDeal from "../components/swipe/ExpandedDeal";
import ExternalLinkDisclosure from "../components/ExternalLinkDisclosure";
import type { Deal } from "@trace/shared";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function ExploreScreen() {
  const navigation = useNavigation<Nav>();
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;
  const { user, profile, isPremium } = useAuth();

  const [deals, setDeals] = useState<Deal[]>([]);
  const [savedDealIds, setSavedDealIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedDeal, setExpandedDeal] = useState<Deal | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showDisclosure, setShowDisclosure] = useState(false);
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
      const apiDeals = await fetchDeals(airportCode);

      // Filter to 6-month window
      const now = new Date();
      const sixMonths = new Date(now);
      sixMonths.setMonth(sixMonths.getMonth() + 6);
      const months = [
        "january", "february", "march", "april", "may", "june",
        "july", "august", "september", "october", "november", "december",
      ];

      const filtered = apiDeals.filter((deal) => {
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
      deduped.sort((a, b) => {
        if ((b.discount_pct || 0) !== (a.discount_pct || 0))
          return (b.discount_pct || 0) - (a.discount_pct || 0);
        return (a.price || 0) - (b.price || 0);
      });
    }

    return { filteredDeals: deduped, dealVariants: variantsMap };
  }, [deals, searchTerm, filters]);

  const handleSave = async (deal: Deal) => {
    if (!user || !profile) return;
    if (!isPremium && savedDealIds.size >= 3) {
      setShowDisclosure(true);
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

  // For free users: show 4 normal + 3 blurred
  const displayDeals = isPremium ? filteredDeals : filteredDeals.slice(0, 7);
  const freeVisibleCount = 4;

  const renderDeal = ({ item: baseDeal, index }: { item: Deal; index: number }) => {
    const variants = dealVariants.get(baseDeal.destination) || [baseDeal];
    const cheapestIdx = variants.reduce((best, v, i) => (v.price || 0) < (variants[best].price || 0) ? i : best, 0);
    const selectedIdx = selectedMonthIndex[baseDeal.destination] ?? cheapestIdx;
    const deal = variants[selectedIdx] ?? baseDeal;
    const isSaved = savedDealIds.has(deal.id);
    const isBlurred = !isPremium && index >= freeVisibleCount;

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => isBlurred ? setShowDisclosure(true) : setExpandedDeal(deal)}
        style={{
          backgroundColor: theme.card,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: theme.border,
          overflow: "hidden",
          marginBottom: 12,
          opacity: isBlurred ? 0.3 : 1,
        }}
      >
        <View style={{ position: "relative", height: 200 }}>
          <Image
            source={{ uri: deal.image_url }}
            style={{ width: "100%", height: 200 }}
            contentFit="cover"
          />
          {/* Rich multi-stop gradient for depth */}
          <LinearGradient
            colors={["rgba(0,0,0,0.0)", "rgba(0,0,0,0.15)", "rgba(0,0,0,0.55)", "rgba(0,0,0,0.92)"]}
            locations={[0, 0.35, 0.65, 1]}
            style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "100%" }}
          />
          {deal.discount_pct > 0 && (
            <LinearGradient
              colors={["#00D665", "#00B84D"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                position: "absolute",
                top: 10,
                left: 10,
                borderRadius: 8,
                paddingHorizontal: 9,
                paddingVertical: 4,
              }}
            >
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "800" }}>
                {deal.discount_pct}% OFF
              </Text>
            </LinearGradient>
          )}
          {!isBlurred && (
            <TouchableOpacity
              onPress={() => handleSave(deal)}
              style={{
                position: "absolute",
                top: 10,
                right: 10,
                backgroundColor: isSaved ? "#fff" : "rgba(0,0,0,0.45)",
                borderRadius: 999,
                padding: 8,
              }}
            >
              {isSaved ? (
                <BookmarkCheck color={colors.brand.traceRed} size={18} fill={colors.brand.traceRed} />
              ) : (
                <Bookmark color="#fff" size={18} />
              )}
            </TouchableOpacity>
          )}
          {/* Destination & price overlaid on image */}
          <View style={{ position: "absolute", bottom: 12, left: 14, right: 14 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
              <Text style={{ fontSize: 20, fontWeight: "900", color: "#fff", flex: 1, textShadowColor: "rgba(0,0,0,0.6)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 }} numberOfLines={1}>
                {deal.destination}
              </Text>
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
            {deal.vibe_description && (
              <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 2 }} numberOfLines={1}>
                {deal.vibe_description}
              </Text>
            )}
          </View>
        </View>
        <View style={{ paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12 }}>
          {deal.duration && (
            <Text style={{ fontSize: 11, color: theme.mutedForeground, marginBottom: 8 }}>
              ✈️ {deal.duration}
            </Text>
          )}
          {/* Month selector pills */}
          {variants.length > 0 && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
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
                      onPress={() => !isBlurred && setSelectedMonthIndex((prev) => ({ ...prev, [baseDeal.destination]: i }))}
                      style={{ paddingHorizontal: 12, paddingVertical: 7, flexDirection: "row", alignItems: "center", gap: 5 }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: "800", color: "#fff" }}>
                        {v.travel_window || `Option ${i + 1}`}
                      </Text>
                      <View style={{ width: 1, height: 12, backgroundColor: "rgba(255,255,255,0.4)" }} />
                      <Text style={{ fontSize: 12, fontWeight: "900", color: "#fff" }}>
                        ${v.price}
                      </Text>
                    </TouchableOpacity>
                  </LinearGradient>
                ) : (
                  <TouchableOpacity
                    key={v.id}
                    onPress={() => !isBlurred && setSelectedMonthIndex((prev) => ({ ...prev, [baseDeal.destination]: i }))}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                      borderRadius: 999,
                      backgroundColor: theme.muted,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: "700", color: theme.mutedForeground }}>
                      {v.travel_window || `Option ${i + 1}`}
                    </Text>
                    <View style={{ width: 1, height: 12, backgroundColor: theme.border }} />
                    <Text style={{ fontSize: 12, fontWeight: "800", color: theme.foreground }}>
                      ${v.price}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background, justifyContent: "center", alignItems: "center" }} edges={["top", "left", "right"]}>
        <ActivityIndicator size="large" color={colors.brand.traceRed} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={["top", "left", "right"]}>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: theme.border }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <Text style={{ fontSize: 24, fontWeight: "900", color: theme.foreground }}>Explore Deals</Text>
          {profile?.homeAirport && (
            <View style={{ backgroundColor: theme.muted, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 }}>
              <Text style={{ fontSize: 12, fontWeight: "600", color: theme.mutedForeground }}>From {profile.homeAirport}</Text>
            </View>
          )}
        </View>
        <Text style={{ fontSize: 12, color: theme.mutedForeground }}>Browse and save flights that match your vibe</Text>
      </View>

      {/* Search + Filter button */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
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
              onChangeText={setSearchTerm}
              style={{ flex: 1, paddingVertical: 12, fontSize: 14, color: theme.foreground }}
            />
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
      </View>

      {/* Active filter tags */}
      {hasActiveFilters && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 8 }}
        >
          {(searchTerm || filters.search) && (
            <TouchableOpacity
              onPress={() => removeFilter("search")}
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
              <Text style={{ fontSize: 12, color: theme.foreground }}>🔍 {searchTerm || filters.search}</Text>
              <X size={12} color={theme.mutedForeground} />
            </TouchableOpacity>
          )}
          {filters.cabinClass === "business" && (
            <TouchableOpacity
              onPress={() => removeFilter("cabinClass")}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                backgroundColor: colors.brand.amber100,
                borderRadius: 999,
                paddingHorizontal: 12,
                paddingVertical: 6,
              }}
            >
              <Text style={{ fontSize: 12, color: colors.brand.amber600 }}>👑 Business Class</Text>
              <X size={12} color={colors.brand.amber600} />
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

      {/* Deal count */}
      <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
        <Text style={{ fontSize: 12, fontWeight: "600", color: theme.mutedForeground }}>
          Showing {Math.min(displayDeals.length, isPremium ? displayDeals.length : freeVisibleCount)} deal{displayDeals.length !== 1 ? "s" : ""}
          {!isPremium && filteredDeals.length > freeVisibleCount && ` of ${filteredDeals.length}`}
        </Text>
      </View>

      {/* Deals list */}
      <FlatList
        data={displayDeals}
        renderItem={renderDeal}
        keyExtractor={(item) => item.id}
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
          !isPremium && filteredDeals.length > freeVisibleCount ? (
            <View
              style={{
                backgroundColor: theme.card,
                borderRadius: 16,
                padding: 24,
                borderWidth: 1,
                borderColor: theme.border,
                alignItems: "center",
                marginTop: 4,
              }}
            >
              <Text style={{ fontSize: 20, fontWeight: "800", color: theme.foreground, marginBottom: 8 }}>
                🔓 Unlock Full Access
              </Text>
              <Text style={{ fontSize: 13, color: theme.mutedForeground, textAlign: "center", marginBottom: 20 }}>
                Get access to all {filteredDeals.length}+ deals with premium features
              </Text>

              {/* Benefits grid */}
              <View style={{ flexDirection: "row", gap: 12, marginBottom: 20, width: "100%" }}>
                {[
                  { emoji: "♾️", label: "Unlimited\nSwipes" },
                  { emoji: "🔍", label: "Full\nExplore" },
                  { emoji: "🔔", label: "Deal\nAlerts" },
                ].map((b, i) => (
                  <View
                    key={i}
                    style={{
                      flex: 1,
                      alignItems: "center",
                      padding: 12,
                      backgroundColor: theme.muted,
                      borderRadius: 12,
                    }}
                  >
                    <Text style={{ fontSize: 24, marginBottom: 4 }}>{b.emoji}</Text>
                    <Text style={{ fontSize: 11, fontWeight: "600", color: theme.mutedForeground, textAlign: "center" }}>
                      {b.label}
                    </Text>
                  </View>
                ))}
              </View>

              <LinearGradient
                colors={[colors.brand.traceRed, colors.brand.tracePink]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ borderRadius: 12, width: "100%" }}
              >
                <TouchableOpacity
                  onPress={() => setShowDisclosure(true)}
                  style={{
                    paddingVertical: 14,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>View Plans</Text>
                </TouchableOpacity>
              </LinearGradient>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingVertical: 48 }}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>🔍</Text>
            <Text style={{ fontSize: 18, fontWeight: "700", color: theme.foreground, marginBottom: 8 }}>No deals found</Text>
            <Text style={{ fontSize: 14, color: theme.mutedForeground }}>
              {searchTerm ? `No deals for "${searchTerm}" right now` : "No deals match your filters"}
            </Text>
          </View>
        }
      />

      {/* Filters modal */}
      {showFilters && (
        <ExploreFilters
          filters={filters}
          onFiltersChange={handleFiltersChange}
          onClose={() => setShowFilters(false)}
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

      <ExternalLinkDisclosure
        visible={showDisclosure}
        onClose={() => setShowDisclosure(false)}
        plan="premium"
        email={user?.email || undefined}
      />
    </SafeAreaView>
  );
}
