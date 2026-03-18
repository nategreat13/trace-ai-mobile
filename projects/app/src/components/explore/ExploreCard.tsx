import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  Dimensions,
} from "react-native";
import { Image } from "expo-image";
import { Heart } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInUp } from "react-native-reanimated";
import { colors } from "../../theme/colors";
import type { Deal } from "@trace/shared";

const CARD_GAP = 12;
const SCREEN_PADDING = 16;
const CARD_WIDTH =
  (Dimensions.get("window").width - SCREEN_PADDING * 2 - CARD_GAP) / 2;

interface ExploreCardProps {
  deal: Deal;
  onSave: (deal: Deal) => void;
  isSaved?: boolean;
}

export default function ExploreCard({
  deal,
  onSave,
  isSaved = false,
}: ExploreCardProps) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;

  return (
    <Animated.View
      entering={FadeInUp.duration(400)}
      style={[styles.card, { backgroundColor: theme.card, width: CARD_WIDTH }]}
    >
      {/* Image */}
      <View style={styles.imageContainer}>
        <Image
          source={{
            uri:
              deal.image_url ||
              "https://via.placeholder.com/400x300?text=No+Image",
          }}
          style={styles.image}
          contentFit="cover"
          transition={200}
        />

        {/* Gradient overlay */}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.25)", "rgba(0,0,0,0.7)"]}
          style={styles.gradient}
        />

        {/* Save button */}
        <TouchableOpacity
          onPress={() => onSave(deal)}
          style={[
            styles.saveButton,
            isSaved
              ? styles.saveButtonActive
              : styles.saveButtonInactive,
          ]}
          activeOpacity={0.7}
        >
          <Heart
            size={14}
            color={isSaved ? colors.brand.traceRed : "#ffffff"}
            fill={isSaved ? colors.brand.traceRed : "none"}
          />
        </TouchableOpacity>

        {/* Bottom content overlay */}
        <View style={styles.overlayContent}>
          {/* Destination & Price */}
          <View style={styles.headerRow}>
            <Text style={styles.destination} numberOfLines={1}>
              {deal.destination}
            </Text>
            <Text style={styles.price}>${deal.price}</Text>
          </View>

          {/* Badges */}
          <View style={styles.badgeRow}>
            {deal.is_business_class && (
              <View style={[styles.badge, styles.businessBadge]}>
                <Text style={styles.businessBadgeText}>Business</Text>
              </View>
            )}
            {deal.discount_pct > 0 && (
              <View style={[styles.badge, styles.discountBadge]}>
                <Text style={styles.discountBadgeText}>
                  {deal.discount_pct}% OFF
                </Text>
              </View>
            )}
          </View>

          {/* Travel window */}
          {deal.travel_window ? (
            <View style={[styles.badge, styles.windowBadge]}>
              <Text style={styles.windowBadgeText}>{deal.travel_window}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  imageContainer: {
    height: 200,
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  gradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "100%",
  },
  saveButton: {
    position: "absolute",
    top: 8,
    right: 8,
    zIndex: 20,
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonActive: {
    backgroundColor: "#ffffff",
  },
  saveButtonInactive: {
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  overlayContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 4,
    marginBottom: 4,
  },
  destination: {
    fontSize: 16,
    fontWeight: "900",
    color: "#ffffff",
    flex: 1,
  },
  price: {
    fontSize: 16,
    fontWeight: "900",
    color: "#ffffff",
    flexShrink: 0,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginBottom: 4,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  businessBadge: {
    backgroundColor: colors.brand.amber500,
  },
  businessBadgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "900",
  },
  discountBadge: {
    backgroundColor: colors.brand.traceGreen,
  },
  discountBadgeText: {
    color: "#000000",
    fontSize: 10,
    fontWeight: "900",
  },
  windowBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    alignSelf: "flex-start",
  },
  windowBadgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "700",
  },
});
