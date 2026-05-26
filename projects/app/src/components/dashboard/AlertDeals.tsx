import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  useColorScheme,
  Animated,
} from "react-native";
import ReanimatedView, { FadeInDown } from "react-native-reanimated";
import { Bell, X, Plane, MapPin } from "lucide-react-native";
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

function PulsingDot({ color }: { color: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, { toValue: 1.5, duration: 800, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 800, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.6, duration: 0, useNativeDriver: true }),
        ]),
        Animated.delay(400),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  return (
    <View style={styles.dotWrap}>
      <Animated.View
        style={[
          styles.dotRing,
          { borderColor: color, transform: [{ scale }], opacity },
        ]}
      />
      <View style={[styles.dotCore, { backgroundColor: color }]} />
    </View>
  );
}

export default function AlertDeals({ alerts, onDelete }: AlertDealsProps) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;
  const isDark = scheme === "dark";

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
    const isMatched = item.status === "matched";
    const accentColor = isMatched ? "#22c55e" : "#3b82f6";

    return (
      <ReanimatedView.View
        entering={FadeInDown.delay(index * 60).duration(300)}
        style={[
          styles.alertCard,
          {
            backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "#fff",
            borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)",
          },
        ]}
      >
        {/* Left color stripe */}
        <View style={[styles.stripe, { backgroundColor: accentColor }]} />

        {/* Plane icon block */}
        <View style={[styles.iconBlock, { backgroundColor: `${accentColor}18` }]}>
          <Plane size={18} color={accentColor} />
        </View>

        {/* Main content */}
        <View style={styles.alertInfo}>
          <View style={styles.destRow}>
            <Text
              style={[styles.alertDestination, { color: theme.foreground }]}
              numberOfLines={1}
            >
              {item.destination}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <MapPin size={10} color={theme.mutedForeground} />
            <Text style={[styles.alertMeta, { color: theme.mutedForeground }]}>
              {item.month ? `Travel: ${item.month}` : "Any time"}
            </Text>
          </View>
          <View style={styles.watchingRow}>
            <PulsingDot color={accentColor} />
            <Text style={[styles.watchingText, { color: accentColor }]}>
              {isMatched ? "Deal matched!" : "Watching for deals"}
            </Text>
          </View>
        </View>

        {/* Delete */}
        <TouchableOpacity
          onPress={() => onDelete(item.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.deleteBtn}
        >
          <X size={16} color={theme.mutedForeground} />
        </TouchableOpacity>
      </ReanimatedView.View>
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
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    minHeight: 70,
  },
  stripe: {
    width: 4,
    alignSelf: "stretch",
  },
  iconBlock: {
    width: 48,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
  },
  alertInfo: {
    flex: 1,
    paddingVertical: 12,
    paddingLeft: 10,
    gap: 3,
  },
  destRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  alertDestination: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  alertMeta: {
    fontSize: 11,
  },
  watchingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  watchingText: {
    fontSize: 11,
    fontWeight: "600",
  },
  dotWrap: {
    width: 10,
    height: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  dotRing: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
  },
  dotCore: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  deleteBtn: {
    padding: 12,
    justifyContent: "center",
    alignItems: "center",
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
