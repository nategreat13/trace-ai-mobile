import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  StyleSheet,
  useColorScheme,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Bell, MapPin, X } from "lucide-react-native";
import { colors } from "../../theme/colors";

const POPULAR_DESTINATIONS = [
  "Paris",
  "Tokyo",
  "Bali",
  "London",
  "New York",
  "Barcelona",
  "Dubai",
  "Rome",
  "Cancun",
  "Lisbon",
];

const ALL_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

interface DealAlertModalProps {
  visible: boolean;
  onClose: () => void;
  onCreateAlert: (destination: string, month?: string) => void;
}

export default function DealAlertModal({
  visible,
  onClose,
  onCreateAlert,
}: DealAlertModalProps) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;

  const [destination, setDestination] = useState("");
  const [selectedMonth, setSelectedMonth] = useState<string | undefined>(
    undefined
  );

  const handleCreate = () => {
    if (!destination.trim()) return;
    onCreateAlert(destination.trim(), selectedMonth);
    setDestination("");
    setSelectedMonth(undefined);
  };

  const handleSelectPopular = (city: string) => {
    setDestination(city);
  };

  const toggleMonth = (month: string) => {
    setSelectedMonth((prev) => (prev === month ? undefined : month));
  };

  const handleClose = () => {
    setDestination("");
    setSelectedMonth(undefined);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: theme.background }]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <View style={styles.headerLeft}>
            <View style={styles.bellWrapper}>
              <Bell size={20} color={colors.brand.orange500} />
            </View>
            <Text style={[styles.headerTitle, { color: theme.foreground }]}>
              Set Deal Alert
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleClose}
            style={[styles.closeButton, { backgroundColor: theme.muted }]}
          >
            <X size={18} color={theme.mutedForeground} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={styles.scrollContentContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Description */}
          <Text style={[styles.description, { color: theme.mutedForeground }]}>
            We'll notify you when a deal for your destination appears.
          </Text>

          {/* Destination input */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.foreground }]}>
              Where do you want to go?
            </Text>
            <View
              style={[
                styles.inputWrapper,
                { backgroundColor: theme.muted, borderColor: theme.border },
              ]}
            >
              <MapPin size={16} color={theme.mutedForeground} />
              <TextInput
                style={[styles.input, { color: theme.foreground }]}
                placeholder="e.g., Paris, Tokyo, Bali"
                placeholderTextColor={theme.mutedForeground}
                value={destination}
                onChangeText={setDestination}
                autoCapitalize="words"
                autoCorrect={false}
              />
              {destination.length > 0 && (
                <TouchableOpacity onPress={() => setDestination("")}>
                  <X size={16} color={theme.mutedForeground} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Popular destinations */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.foreground }]}>
              Popular Destinations
            </Text>
            <View style={styles.chipGrid}>
              {POPULAR_DESTINATIONS.map((city) => {
                const isSelected = destination === city;
                return (
                  <TouchableOpacity
                    key={city}
                    onPress={() => handleSelectPopular(city)}
                    style={[
                      styles.popularChip,
                      isSelected
                        ? styles.popularChipActive
                        : { backgroundColor: theme.muted },
                    ]}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.popularChipText,
                        isSelected
                          ? styles.popularChipTextActive
                          : { color: theme.mutedForeground },
                      ]}
                    >
                      {city}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Month selection (optional) */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.foreground }]}>
              When do you want to travel?{" "}
              <Text style={{ color: theme.mutedForeground, fontWeight: "400" }}>
                (Optional)
              </Text>
            </Text>
            <View style={styles.chipGrid}>
              {ALL_MONTHS.map((month) => {
                const isActive = selectedMonth === month;
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
        </ScrollView>

        {/* Create Alert button */}
        <View
          style={[
            styles.footer,
            { borderTopColor: theme.border, backgroundColor: theme.background },
          ]}
        >
          <TouchableOpacity
            onPress={handleCreate}
            disabled={!destination.trim()}
            style={[
              styles.createButton,
              !destination.trim() && styles.createButtonDisabled,
            ]}
            activeOpacity={0.8}
          >
            <Bell size={16} color="#ffffff" />
            <Text style={styles.createButtonText}>Create Alert</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  bellWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(249, 115, 22, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
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
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 10,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  popularChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  popularChipActive: {
    backgroundColor: colors.brand.orange500,
  },
  popularChipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  popularChipTextActive: {
    color: "#ffffff",
  },
  monthChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 56,
    alignItems: "center",
  },
  monthChipActive: {
    backgroundColor: colors.brand.orange500,
  },
  monthChipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  monthChipTextActive: {
    color: "#ffffff",
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopWidth: 1,
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.brand.orange500,
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: colors.brand.orange500,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
});
