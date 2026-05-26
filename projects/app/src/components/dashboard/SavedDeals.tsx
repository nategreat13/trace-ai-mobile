import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  useColorScheme,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Image } from "expo-image";
import {
  Plane,
  Clock,
  Trash2,
  Search,
} from "lucide-react-native";
import { colors } from "../../theme/colors";
import type { SavedDeal } from "@trace/shared";

interface SavedDealEntry {
  id: string;
  deal: SavedDeal;
  savedAt: Date;
}

interface SavedDealsProps {
  deals: SavedDealEntry[];
  onDelete: (id: string) => void;
  onBook: (url: string) => void;
}

type SortMode = "date" | "price_asc" | "price_desc" | "discount";

const FILTER_CHIPS: { label: string; value: string | null }[] = [
  { label: "All", value: null },
  { label: "✈️ Adventure", value: "adventure" },
  { label: "✨ Luxury", value: "luxury" },
  { label: "🏛️ Cultural", value: "cultural" },
  { label: "🏖️ Relaxation", value: "relaxation" },
  { label: "👨‍👩‍👧‍👦 Family", value: "family" },
  { label: "💰 Budget", value: "budget" },
];

const SORT_OPTIONS: { label: string; value: SortMode }[] = [
  { label: "Recently saved", value: "date" },
  { label: "Price ↑", value: "price_asc" },
  { label: "Price ↓", value: "price_desc" },
  { label: "Biggest discount", value: "discount" },
];

export default function SavedDeals({ deals, onDelete, onBook }: SavedDealsProps) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;
  const [sortBy, setSortBy] = useState<SortMode>("date");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSortMenu, setShowSortMenu] = useState(false);

  const filtered = useMemo(() => {
    let result = [...deals];

    // Text search
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        ({ deal }) =>
          deal.destination?.toLowerCase().includes(q) ||
          deal.origin?.toLowerCase().includes(q) ||
          deal.travelWindow?.toLowerCase().includes(q)
      );
    }

    // Deal type filter
    if (activeFilter) {
      result = result.filter(({ deal }) => deal.dealType === activeFilter);
    }

    // Sort
    if (sortBy === "price_asc") {
      result.sort((a, b) => a.deal.price - b.deal.price);
    } else if (sortBy === "price_desc") {
      result.sort((a, b) => b.deal.price - a.deal.price);
    } else if (sortBy === "discount") {
      result.sort((a, b) => (b.deal.discountPct || 0) - (a.deal.discountPct || 0));
    } else {
      // date — newest first (already sorted from Firestore but re-sort for safety)
      result.sort(
        (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
      );
    }

    return result;
  }, [deals, searchQuery, activeFilter, sortBy]);

  const activeSortLabel = SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? "Sort";

  const renderItem = useCallback(
    ({ item, index }: { item: SavedDealEntry; index: number }) => {
      const { deal } = item;
      const savedDate = new Date(item.savedAt);
      const formattedDate = savedDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });

      return (
        <Animated.View
          entering={FadeInDown.delay(index * 40).duration(280)}
          style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
        >
          <TouchableOpacity
            style={styles.cardContent}
            activeOpacity={0.7}
            onPress={() => deal.url && onBook(deal.url)}
          >
            <View style={styles.imageWrap}>
              <Image
                source={{ uri: deal.imageUrl }}
                style={styles.dealImage}
                contentFit="cover"
                transition={200}
              />
              <View style={styles.priceTag}>
                <Text style={styles.priceTagText}>${deal.price}</Text>
              </View>
            </View>

            <View style={styles.cardBody}>
              {/* Destination */}
              <View style={styles.destinationRow}>
                <Text
                  style={[styles.destination, { color: theme.foreground }]}
                  numberOfLines={1}
                >
                  {deal.destination}
                </Text>
                {deal.isBusinessClass && (
                  <View style={styles.bizBadge}>
                    <Text style={styles.bizBadgeText}>Biz</Text>
                  </View>
                )}
              </View>

              {/* Flight route */}
              <View style={styles.routeRow}>
                <Text style={[styles.routeText, { color: theme.mutedForeground }]}>
                  {deal.origin || "Your airport"}
                </Text>
                <Plane size={10} color={colors.brand.traceRed} style={styles.routePlane} />
                <Text style={[styles.routeText, { color: theme.mutedForeground }]} numberOfLines={1}>
                  {deal.destination}
                </Text>
              </View>

              {/* Chips row */}
              <View style={styles.metaRow}>
                {deal.duration ? (
                  <View style={[styles.metaChip, { backgroundColor: "rgba(59,130,246,0.1)" }]}>
                    <Clock size={10} color="#3b82f6" />
                    <Text style={[styles.metaChipText, { color: "#3b82f6" }]}>
                      {deal.duration}
                    </Text>
                  </View>
                ) : null}
                <View style={[styles.metaChip, { backgroundColor: "rgba(168,85,247,0.1)" }]}>
                  <Plane size={10} color="#a855f7" />
                  <Text style={[styles.metaChipText, { color: "#a855f7" }]}>
                    {deal.travelWindow}
                  </Text>
                </View>
                {deal.discountPct > 0 && (
                  <Text style={styles.discountText}>-{deal.discountPct}%</Text>
                )}
              </View>

              <Text style={[styles.savedDate, { color: theme.mutedForeground }]}>
                Saved {formattedDate}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => onDelete(item.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Trash2 size={16} color="#ef4444" />
          </TouchableOpacity>
        </Animated.View>
      );
    },
    [theme, onDelete, onBook]
  );

  if (deals.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={styles.emptyEmoji}>✈️</Text>
        <Text style={[styles.emptyText, { color: theme.mutedForeground }]}>
          No saved deals yet.{"\n"}Swipe right on a deal to save it!
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.card, borderColor: theme.border }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.foreground }]}>
          Saved Deals ({deals.length})
        </Text>
        {/* Sort button */}
        <View style={{ position: "relative" }}>
          <TouchableOpacity
            style={[styles.sortButton, { backgroundColor: `${colors.brand.traceRed}15` }]}
            onPress={() => setShowSortMenu((v) => !v)}
            activeOpacity={0.7}
          >
            <Text style={[styles.sortButtonText, { color: colors.brand.traceRed }]}>
              {activeSortLabel}
            </Text>
            <Text style={{ fontSize: 10, color: colors.brand.traceRed, marginLeft: 2 }}>▾</Text>
          </TouchableOpacity>
          {showSortMenu && (
            <View style={[styles.sortMenu, { backgroundColor: theme.card, borderColor: theme.border }]}>
              {SORT_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.sortMenuItem,
                    sortBy === opt.value && { backgroundColor: `${colors.brand.traceRed}12` },
                  ]}
                  onPress={() => { setSortBy(opt.value); setShowSortMenu(false); }}
                >
                  <Text
                    style={[
                      styles.sortMenuItemText,
                      { color: sortBy === opt.value ? colors.brand.traceRed : theme.foreground },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>

      {/* Search bar */}
      <View style={[styles.searchBar, { backgroundColor: theme.muted, borderColor: theme.border }]}>
        <Search size={14} color={theme.mutedForeground} />
        <TextInput
          style={[styles.searchInput, { color: theme.foreground }]}
          placeholder="Search destinations…"
          placeholderTextColor={theme.mutedForeground}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          clearButtonMode="while-editing"
          autoCorrect={false}
        />
      </View>

      {/* Filter chips */}
      <FlatList
        data={FILTER_CHIPS}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.label}
        contentContainerStyle={styles.filterChipsContent}
        style={styles.filterChips}
        renderItem={({ item }) => {
          const isActive = activeFilter === item.value;
          return (
            <TouchableOpacity
              onPress={() => setActiveFilter(isActive ? null : item.value)}
              style={[
                styles.filterChip,
                {
                  backgroundColor: isActive ? colors.brand.traceRed : theme.muted,
                  borderColor: isActive ? colors.brand.traceRed : theme.border,
                },
              ]}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterChipText, { color: isActive ? "#fff" : theme.mutedForeground }]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        }}
      />

      {/* Results */}
      {filtered.length === 0 ? (
        <View style={styles.noResultsContainer}>
          <Text style={[styles.noResultsText, { color: theme.mutedForeground }]}>
            No deals match your search.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
  },
  sortButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  sortButtonText: {
    fontSize: 12,
    fontWeight: "600",
  },
  sortMenu: {
    position: "absolute",
    top: 32,
    right: 0,
    borderRadius: 10,
    borderWidth: 1,
    zIndex: 99,
    minWidth: 160,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 8,
  },
  sortMenuItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  sortMenuItemText: {
    fontSize: 13,
    fontWeight: "600",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  filterChips: {
    marginBottom: 12,
    marginHorizontal: -16,
  },
  filterChipsContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  listContent: {
    paddingBottom: 4,
  },
  card: {
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  cardContent: {
    flex: 1,
    flexDirection: "row",
  },
  imageWrap: {
    width: 88,
    position: "relative",
  },
  dealImage: {
    width: 88,
    height: 96,
  },
  priceTag: {
    position: "absolute",
    bottom: 6,
    left: 6,
    backgroundColor: "rgba(0,0,0,0.62)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  priceTagText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#fff",
  },
  cardBody: {
    flex: 1,
    padding: 10,
    justifyContent: "space-between",
  },
  destinationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  destination: {
    fontSize: 17,
    fontWeight: "800",
    flexShrink: 1,
    letterSpacing: -0.3,
  },
  bizBadge: {
    backgroundColor: "rgba(245,158,11,0.15)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 99,
  },
  bizBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#d97706",
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 3,
  },
  routePlane: {
    marginHorizontal: 1,
  },
  routeText: {
    fontSize: 11,
    fontWeight: "500",
    flexShrink: 1,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 99,
  },
  metaChipText: {
    fontSize: 9,
    fontWeight: "600",
  },
  discountText: {
    fontSize: 9,
    fontWeight: "600",
    color: "#22c55e",
  },
  savedDate: {
    fontSize: 9,
    marginTop: 4,
  },
  deleteButton: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
  },
  emptyEmoji: {
    fontSize: 36,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  noResultsContainer: {
    paddingVertical: 24,
    alignItems: "center",
  },
  noResultsText: {
    fontSize: 13,
    textAlign: "center",
  },
});
