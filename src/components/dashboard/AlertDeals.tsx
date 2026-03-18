import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  useColorScheme,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Bell, X } from "lucide-react-native";
import { colors } from "../../theme/colors";

interface AlertEntry {
  id: string;
  destination: string;
  month?: string;
  status: string;
}

interface AlertDealsProps {
  alerts: AlertEntry[];
  onDelete: (id: string) => void;
}

export default function AlertDeals({ alerts, onDelete }: AlertDealsProps) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;

  const activeAlerts = alerts.filter((a) => a.status === "active");

  if (activeAlerts.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Bell size={32} color={theme.mutedForeground} strokeWidth={1.5} />
        <Text style={[styles.emptyTitle, { color: theme.foreground }]}>
          No active alerts
        </Text>
        <Text style={[styles.emptySubtitle, { color: theme.mutedForeground }]}>
          Set alerts in Explore to get notified of deals
        </Text>
      </View>
    );
  }

  const renderItem = ({ item, index }: { item: AlertEntry; index: number }) => {
    const isDark = scheme === "dark";
    const statusColor =
      item.status === "matched" ? "#22c55e" : "#3b82f6";

    return (
      <Animated.View
        entering={FadeInDown.delay(index * 60).duration(300)}
        style={[
          styles.alertCard,
          {
            backgroundColor: isDark
              ? "rgba(59,130,246,0.08)"
              : "rgba(59,130,246,0.05)",
            borderColor: isDark
              ? "rgba(59,130,246,0.2)"
              : "rgba(59,130,246,0.15)",
          },
        ]}
      >
        <View style={styles.alertLeft}>
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: `${statusColor}20` },
            ]}
          >
            <Bell size={16} color={statusColor} />
          </View>
          <View style={styles.alertInfo}>
            <Text
              style={[styles.alertDestination, { color: theme.foreground }]}
              numberOfLines={1}
            >
              {item.destination}
            </Text>
            <Text style={[styles.alertMeta, { color: theme.mutedForeground }]}>
              {item.month ? `Travel: ${item.month}` : "Waiting for deals..."}
            </Text>
          </View>
        </View>

        <View style={styles.alertRight}>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: `${statusColor}18` },
            ]}
          >
            <Text style={[styles.statusBadgeText, { color: statusColor }]}>
              {item.status}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => onDelete(item.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.deleteBtn}
          >
            <X size={16} color={theme.mutedForeground} />
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.foreground }]}>
          Deal Alerts
        </Text>
        <Text style={[styles.count, { color: theme.mutedForeground }]}>
          {activeAlerts.length} alert{activeAlerts.length !== 1 ? "s" : ""}
        </Text>
      </View>

      <FlatList
        data={activeAlerts}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
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
  count: {
    fontSize: 12,
    fontWeight: "600",
  },
  alertCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  alertLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  alertInfo: {
    flex: 1,
  },
  alertDestination: {
    fontSize: 14,
    fontWeight: "600",
  },
  alertMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  alertRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  deleteBtn: {
    padding: 4,
  },
  emptyContainer: {
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 12,
    marginTop: 4,
    textAlign: "center",
  },
});
