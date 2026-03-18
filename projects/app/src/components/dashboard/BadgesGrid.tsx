import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  StyleSheet,
  useColorScheme,
} from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import { Lock, X, Check } from "lucide-react-native";
import { colors } from "../../theme/colors";

interface BadgeDefinition {
  id: string;
  name: string;
  emoji: string;
  description: string;
}

interface BadgesGridProps {
  earnedBadges: string[];
  allBadges: BadgeDefinition[];
}

export default function BadgesGrid({ earnedBadges, allBadges }: BadgesGridProps) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;
  const [selectedBadge, setSelectedBadge] = useState<BadgeDefinition | null>(null);

  const earnedSet = new Set(earnedBadges);
  const earnedCount = allBadges.filter((b) => earnedSet.has(b.id)).length;

  const handleBadgePress = useCallback((badge: BadgeDefinition) => {
    setSelectedBadge(badge);
  }, []);

  const handleClose = useCallback(() => {
    setSelectedBadge(null);
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.header}>
        <Text style={[styles.sectionTitle, { color: theme.mutedForeground }]}>
          BADGES
        </Text>
        <Text style={[styles.earnedCount, { color: theme.mutedForeground }]}>
          {earnedCount}/{allBadges.length} earned
        </Text>
      </View>

      <View style={styles.grid}>
        {allBadges.map((badge, i) => {
          const earned = earnedSet.has(badge.id);
          return (
            <Animated.View
              key={badge.id}
              entering={ZoomIn.delay(i * 50).duration(300)}
              style={{ width: "31%", flexGrow: 0 }}
            >
              <TouchableOpacity
                style={[
                  styles.badgeCell,
                  {
                    backgroundColor: earned ? theme.muted : theme.muted,
                    borderColor: earned ? theme.border : theme.border,
                    opacity: earned ? 1 : 0.35,
                  },
                ]}
                activeOpacity={0.7}
                onPress={() => handleBadgePress(badge)}
              >
                {earned ? (
                  <Text style={styles.badgeEmoji}>{badge.emoji}</Text>
                ) : (
                  <Lock size={20} color={theme.mutedForeground} />
                )}
                <Text
                  style={[styles.badgeName, { color: theme.foreground }]}
                  numberOfLines={2}
                >
                  {badge.name}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>

      {/* Badge detail modal */}
      <Modal
        visible={selectedBadge !== null}
        transparent
        animationType="fade"
        onRequestClose={handleClose}
      >
        <Pressable style={styles.backdrop} onPress={handleClose}>
          <Pressable
            style={[styles.modalCard, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={(e) => e.stopPropagation()}
          >
            {selectedBadge && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalEmoji}>
                    {selectedBadge.emoji}
                  </Text>
                  <TouchableOpacity onPress={handleClose} style={styles.modalClose}>
                    <X size={20} color={theme.mutedForeground} />
                  </TouchableOpacity>
                </View>

                <Text style={[styles.modalTitle, { color: theme.foreground }]}>
                  {selectedBadge.name}
                </Text>
                <Text style={[styles.modalDesc, { color: theme.mutedForeground }]}>
                  {selectedBadge.description}
                </Text>

                {earnedSet.has(selectedBadge.id) && (
                  <View style={styles.earnedRow}>
                    <Check size={16} color="#22c55e" />
                    <Text style={styles.earnedText}>Earned</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.gotItButton, { backgroundColor: colors.brand.traceRed }]}
                  onPress={handleClose}
                  activeOpacity={0.8}
                >
                  <Text style={styles.gotItText}>Got it</Text>
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
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
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
  },
  earnedCount: {
    fontSize: 12,
    fontWeight: "600",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "flex-start",
  },
  badgeCell: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    minHeight: 90,
  },
  badgeEmoji: {
    fontSize: 28,
    marginBottom: 6,
  },
  badgeName: {
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 13,
  },
  // Modal styles
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  modalEmoji: {
    fontSize: 48,
  },
  modalClose: {
    padding: 4,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
  },
  modalDesc: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  earnedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 16,
  },
  earnedText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#22c55e",
  },
  gotItButton: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  gotItText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
});
