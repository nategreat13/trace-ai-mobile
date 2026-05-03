import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  StyleSheet,
  useColorScheme,
  SafeAreaView,
} from "react-native";
import {
  X,
  Users,
  Sparkles,
  Compass,
  Zap,
  Mountain,
  Heart,
  Crown,
  Lock,
} from "lucide-react-native";
import { colors } from "../../theme/colors";

export interface ExploreFilterState {
  search: string;
  months: string[];
  dealTypes: string[];
  sort: "price" | "discount" | "newest";
  cabinClass: "economy" | "business" | "all";
  destination: "domestic" | "international" | "both";
}

const MONTHS_IN_ORDER = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const currentMonthIdx = new Date().getMonth();
const ALL_MONTHS = [
  ...MONTHS_IN_ORDER.slice(currentMonthIdx),
  ...MONTHS_IN_ORDER.slice(0, currentMonthIdx),
];

const DEAL_TYPES = [
  { name: "family", Icon: Users, activeColor: "#3b82f6" },
  { name: "luxury", Icon: Sparkles, activeColor: "#a855f7" },
  { name: "adventure", Icon: Compass, activeColor: "#f97316" },
  { name: "budget", Icon: Zap, activeColor: "#eab308" },
  { name: "cultural", Icon: Mountain, activeColor: "#14b8a6" },
  { name: "relaxation", Icon: Heart, activeColor: "#ec4899" },
];

const SORT_OPTIONS: { value: ExploreFilterState["sort"]; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "price", label: "Price: Low to High" },
  { value: "discount", label: "Highest Discount" },
];

const CABIN_OPTIONS: { value: ExploreFilterState["cabinClass"]; label: string }[] = [
  { value: "all", label: "All" },
  { value: "economy", label: "Economy" },
  { value: "business", label: "Business" },
];

const DEST_OPTIONS: { value: ExploreFilterState["destination"]; label: string }[] = [
  { value: "both", label: "Both" },
  { value: "domestic", label: "Domestic" },
  { value: "international", label: "International" },
];

interface ExploreFiltersProps {
  filters: ExploreFilterState;
  onFiltersChange: (filters: ExploreFilterState) => void;
  onClose: () => void;
  isBusiness?: boolean;
  onUpgradeBusiness?: () => void;
}

export default function ExploreFilters({
  filters,
  onFiltersChange,
  onClose,
  isBusiness = false,
  onUpgradeBusiness,
}: ExploreFiltersProps) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;

  const [localFilters, setLocalFilters] = useState<ExploreFilterState>({
    ...filters,
  });

  const toggleMonth = (month: string) => {
    setLocalFilters((prev) => ({
      ...prev,
      months: prev.months.includes(month)
        ? prev.months.filter((m) => m !== month)
        : [...prev.months, month],
    }));
  };

  const toggleDealType = (type: string) => {
    setLocalFilters((prev) => ({
      ...prev,
      dealTypes: prev.dealTypes.includes(type)
        ? prev.dealTypes.filter((t) => t !== type)
        : [...prev.dealTypes, type],
    }));
  };

  const setSort = (sort: ExploreFilterState["sort"]) => {
    setLocalFilters((prev) => ({ ...prev, sort }));
  };

  const handleApply = () => {
    onFiltersChange(localFilters);
    onClose();
  };

  const handleReset = () => {
    const reset: ExploreFilterState = {
      search: "",
      months: [],
      dealTypes: [],
      sort: "newest",
      cabinClass: "all",
      destination: "both",
    };
    setLocalFilters(reset);
    onFiltersChange(reset);
    onClose();
  };

  const hasActiveFilters =
    localFilters.months.length > 0 ||
    localFilters.dealTypes.length > 0 ||
    localFilters.sort !== "newest" ||
    localFilters.cabinClass !== "all" ||
    localFilters.destination !== "both";

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Text style={[styles.headerTitle, { color: theme.foreground }]}>
            Filters
          </Text>
          <View style={styles.headerActions}>
            {hasActiveFilters && (
              <TouchableOpacity onPress={handleReset}>
                <Text style={styles.clearText}>Clear all</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeButton, { backgroundColor: theme.muted }]}
            >
              <X size={18} color={theme.mutedForeground} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={styles.scrollContentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Cabin Class — business only */}
          <View style={styles.section}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <Text style={[styles.sectionLabel, { color: theme.foreground, marginBottom: 0 }]}>
                Cabin Class
              </Text>
              {!isBusiness && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: colors.brand.amber100, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Crown size={10} color={colors.brand.amber600} />
                  <Text style={{ fontSize: 10, fontWeight: "700", color: colors.brand.amber600 }}>Business</Text>
                </View>
              )}
            </View>
            {isBusiness ? (
              <View style={styles.sortRow}>
                {CABIN_OPTIONS.map((opt) => {
                  const isActive = localFilters.cabinClass === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() =>
                        setLocalFilters((prev) => ({
                          ...prev,
                          cabinClass: opt.value,
                        }))
                      }
                      style={[
                        styles.sortChip,
                        isActive
                          ? { backgroundColor: colors.brand.amber500 }
                          : { backgroundColor: theme.muted },
                      ]}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.sortChipText,
                          isActive
                            ? { color: "#ffffff" }
                            : { color: theme.mutedForeground },
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <TouchableOpacity
                onPress={onUpgradeBusiness}
                activeOpacity={0.75}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  backgroundColor: theme.muted,
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 13,
                  borderWidth: 1,
                  borderColor: colors.brand.amber500 + "40",
                }}
              >
                <Lock size={14} color={colors.brand.amber600} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: theme.foreground }}>Filter by cabin class</Text>
                  <Text style={{ fontSize: 11, color: theme.mutedForeground, marginTop: 1 }}>Upgrade to Business to unlock</Text>
                </View>
                <View style={{ backgroundColor: colors.brand.amber500, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: "#fff" }}>Upgrade →</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>

          {/* Destination */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.foreground }]}>
              Destination
            </Text>
            <View style={styles.sortRow}>
              {DEST_OPTIONS.map((opt) => {
                const isActive = localFilters.destination === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() =>
                      setLocalFilters((prev) => ({
                        ...prev,
                        destination: opt.value,
                      }))
                    }
                    style={[
                      styles.sortChip,
                      isActive
                        ? styles.sortChipActive
                        : { backgroundColor: theme.muted },
                    ]}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.sortChipText,
                        isActive
                          ? styles.sortChipTextActive
                          : { color: theme.mutedForeground },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Sort */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.foreground }]}>
              Sort By
            </Text>
            <View style={styles.sortRow}>
              {SORT_OPTIONS.map((opt) => {
                const isActive = localFilters.sort === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() => setSort(opt.value)}
                    style={[
                      styles.sortChip,
                      isActive
                        ? styles.sortChipActive
                        : { backgroundColor: theme.muted },
                    ]}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.sortChipText,
                        isActive
                          ? styles.sortChipTextActive
                          : { color: theme.mutedForeground },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Months */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.foreground }]}>
              Travel Months
            </Text>
            <View style={styles.chipGrid}>
              {ALL_MONTHS.map((month) => {
                const isActive = localFilters.months.includes(month);
                return (
                  <TouchableOpacity
                    key={month}
                    onPress={() => toggleMonth(month)}
                    style={[
                      styles.monthChip,
                      isActive
                        ? styles.monthChipActive
                        : { backgroundColor: theme.muted },
                    ]}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.monthChipText,
                        isActive
                          ? styles.monthChipTextActive
                          : { color: theme.mutedForeground },
                      ]}
                    >
                      {month.slice(0, 3)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Deal Types */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.foreground }]}>
              Deal Types
            </Text>
            <View style={styles.dealTypeGrid}>
              {DEAL_TYPES.map(({ name, Icon, activeColor }) => {
                const isActive = localFilters.dealTypes.includes(name);
                return (
                  <TouchableOpacity
                    key={name}
                    onPress={() => toggleDealType(name)}
                    style={[
                      styles.dealTypeChip,
                      isActive
                        ? { backgroundColor: activeColor }
                        : { backgroundColor: theme.muted },
                    ]}
                    activeOpacity={0.7}
                  >
                    <Icon
                      size={14}
                      color={isActive ? "#ffffff" : theme.mutedForeground}
                    />
                    <Text
                      style={[
                        styles.dealTypeText,
                        isActive
                          ? styles.dealTypeTextActive
                          : { color: theme.mutedForeground },
                      ]}
                    >
                      {name.charAt(0).toUpperCase() + name.slice(1)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </ScrollView>

        {/* Apply button */}
        <View
          style={[
            styles.footer,
            { borderTopColor: theme.border, backgroundColor: theme.background },
          ]}
        >
          <TouchableOpacity
            onPress={handleApply}
            style={styles.applyButton}
            activeOpacity={0.8}
          >
            <Text style={styles.applyButtonText}>Apply Filters</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  clearText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#ef4444",
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 10,
  },
  sortRow: {
    flexDirection: "row",
    gap: 8,
  },
  sortChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  sortChipActive: {
    backgroundColor: colors.brand.traceRed,
  },
  sortChipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  sortChipTextActive: {
    color: "#ffffff",
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  monthChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 56,
    alignItems: "center",
  },
  monthChipActive: {
    backgroundColor: colors.brand.traceRed,
  },
  monthChipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  monthChipTextActive: {
    color: "#ffffff",
  },
  dealTypeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  dealTypeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  dealTypeText: {
    fontSize: 13,
    fontWeight: "600",
  },
  dealTypeTextActive: {
    color: "#ffffff",
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopWidth: 1,
  },
  applyButton: {
    backgroundColor: colors.brand.traceRed,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    shadowColor: colors.brand.traceRed,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  applyButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
});
