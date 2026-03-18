import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Image } from "expo-image";
import {
  Plane,
  Clock,
  Trash2,
  ChevronDown,
  MapPin,
} from "lucide-react-native";
import { colors } from "../../theme/colors";
import type { SavedDeal } from "../../types/deal";

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

type SortMode = "date" | "price";

export default function SavedDeals({ deals, onDelete, onBook }: SavedDealsProps) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;
  const [sortBy, setSortBy] = useState<SortMode>("date");

  const sorted = useMemo(() => {
    const copy = [...deals];
    if (sortBy === "price") {
      copy.sort((a, b) => a.deal.price - b.deal.price);
    } else {
      copy.sort(
        (a, b) =>
          new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
      );
    }
    return copy;
  }, [deals, sortBy]);

  const toggleSort = useCallback(() => {
    setSortBy((prev) => (prev === "date" ? "price" : "date"));
  }, []);

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
          entering={FadeInDown.delay(index * 50).duration(300)}
          style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
        >
          <TouchableOpacity
            style={styles.cardContent}
            activeOpacity={0.7}
            onPress={() => deal.url && onBook(deal.url)}
          >
            <Image
              source={{ uri: deal.imageUrl }}
              style={styles.dealImage}
              contentFit="cover"
              transition={200}
            />
            <View style={styles.cardBody}>
              <View style={styles.cardHeader}>
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
                <Text style={[styles.price, { color: theme.foreground }]}>
                  ${deal.price}
                </Text>
              </View>

              <View style={styles.originRow}>
                <MapPin size={10} color={theme.mutedForeground} />
                <Text style={[styles.originText, { color: theme.mutedForeground }]}>
                  {deal.origin || "Your airport"}
                </Text>
              </View>

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
          No saved deals yet. Start swiping!
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.foreground }]}>
          Saved Deals ({deals.length})
        </Text>
        <TouchableOpacity
          style={[styles.sortButton, { backgroundColor: `${colors.brand.traceRed}15` }]}
          onPress={toggleSort}
          activeOpacity={0.7}
        >
          <Text style={[styles.sortButtonText, { color: colors.brand.traceRed }]}>
            {sortBy === "date" ? "Recent" : "Price"}
          </Text>
          <ChevronDown size={12} color={colors.brand.traceRed} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={sorted}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      />
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
  dealImage: {
    width: 80,
    height: 88,
  },
  cardBody: {
    flex: 1,
    padding: 10,
    justifyContent: "space-between",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  destinationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  destination: {
    fontSize: 14,
    fontWeight: "700",
    flexShrink: 1,
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
  price: {
    fontSize: 16,
    fontWeight: "800",
    marginLeft: 8,
  },
  originRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 2,
  },
  originText: {
    fontSize: 10,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
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
  },
});
