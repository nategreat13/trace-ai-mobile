import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Modal,
  StyleSheet,
  useColorScheme,
  SafeAreaView,
} from "react-native";
import { X, PartyPopper } from "lucide-react-native";
import { colors } from "../../theme/colors";
import type { Deal } from "@trace/shared";
import ExploreCard from "./ExploreCard";

interface MatchedDealsModalProps {
  visible: boolean;
  onClose: () => void;
  deals: Deal[];
  alertDestination: string;
}

export default function MatchedDealsModal({
  visible,
  onClose,
  deals,
  alertDestination,
}: MatchedDealsModalProps) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;

  const renderDealCard = ({ item }: { item: Deal }) => (
    <View style={styles.cardWrapper}>
      <ExploreCard deal={item} onSave={() => {}} />
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <View style={styles.headerContent}>
            <Text style={[styles.headerTitle, { color: theme.foreground }]}>
              Your Alert Matched!
            </Text>
            <Text
              style={[styles.headerSubtitle, { color: theme.mutedForeground }]}
            >
              {deals.length} deal{deals.length !== 1 ? "s" : ""} found for{" "}
              {alertDestination}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={[styles.closeButton, { backgroundColor: theme.muted }]}
          >
            <X size={18} color={theme.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* Deals list */}
        {deals.length > 0 ? (
          <FlatList
            data={deals}
            keyExtractor={(item) => item.id}
            renderItem={renderDealCard}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        ) : (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: theme.mutedForeground }]}>
              No matched deals yet. We'll notify you when we find one!
            </Text>
          </View>
        )}
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
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "900",
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  cardWrapper: {
    width: "100%",
  },
  separator: {
    height: 16,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
});
