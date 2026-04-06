import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  FlatList,
  ViewToken,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColorScheme } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { colors } from "../theme/colors";
import { fetchDeals } from "../services/dealsApi";
import { Deal } from "@trace/shared";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
type Nav = NativeStackNavigationProp<RootStackParamList>;

const CARD_WIDTH = SCREEN_WIDTH - 48;
const CARD_HEIGHT = CARD_WIDTH * 0.85;
const AUTO_ADVANCE_MS = 4000;

export default function LandingScreen() {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;
  const navigation = useNavigation<Nav>();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>(null);

  useEffect(() => {
    fetchDeals("LAX")
      .then((all) => {
        // Pick 5 deals with good images spread across destinations
        const shuffled = all.sort(() => Math.random() - 0.5);
        const seen = new Set<string>();
        const picked: Deal[] = [];
        for (const d of shuffled) {
          if (!seen.has(d.destination) && d.image_url) {
            seen.add(d.destination);
            picked.push(d);
            if (picked.length >= 5) break;
          }
        }
        setDeals(picked);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Auto-advance carousel
  useEffect(() => {
    if (deals.length <= 1) return;
    timerRef.current = setInterval(() => {
      setActiveIndex((prev) => {
        const next = (prev + 1) % deals.length;
        flatListRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, AUTO_ADVANCE_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [deals.length]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setActiveIndex(viewableItems[0].index);
      }
    },
  ).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const renderCard = ({ item }: { item: Deal }) => (
    <View style={{ width: CARD_WIDTH }}>
      <View
        style={{
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
          borderRadius: 20,
          overflow: "hidden",
          backgroundColor: "#1a1a1a",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
          elevation: 8,
        }}
      >
        <Image
          source={{ uri: item.image_url }}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
        />
        <LinearGradient
          colors={[
            "rgba(0,0,0,0.0)",
            "rgba(0,0,0,0.0)",
            "rgba(0,0,0,0.5)",
            "rgba(0,0,0,0.88)",
          ]}
          locations={[0, 0.4, 0.7, 1]}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
          }}
        />
        {/* Top row: origin pill + price pill */}
        <View
          style={{
            position: "absolute",
            top: 16,
            left: 16,
            right: 16,
            flexDirection: "row",
            justifyContent: "space-between",
          }}
        >
          <View
            style={{
              backgroundColor: "rgba(0,0,0,0.45)",
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 12,
            }}
          >
            <Text
              style={{
                color: "#fff",
                fontWeight: "700",
                fontSize: 13,
                letterSpacing: 0.3,
              }}
            >
              From {item.origin}
            </Text>
          </View>
          <View
            style={{
              backgroundColor: colors.brand.traceGreen,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 12,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>
              ${item.price}
            </Text>
          </View>
        </View>
        {/* Destination */}
        <View style={{ position: "absolute", bottom: 20, left: 20, right: 20 }}>
          <Text
            style={{
              color: "#fff",
              fontSize: 34,
              fontWeight: "900",
              textShadowColor: "rgba(0,0,0,0.6)",
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 4,
            }}
          >
            {item.destination}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View style={{ alignItems: "center", marginTop: 16, marginBottom: 20 }}>
        <Text style={{ fontSize: 36, marginBottom: 10 }}>✈️</Text>
        <Text
          style={{
            fontSize: 28,
            fontWeight: "900",
            color: theme.foreground,
            textAlign: "center",
          }}
        >
          Your next adventure{"\n"}starts with a{" "}
          <Text style={{ color: colors.brand.traceRed }}>swipe</Text>
        </Text>
      </View>

      {/* Deal carousel — fills available space */}
      <View style={{ flex: 1, justifyContent: "center" }}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.brand.traceRed} />
        ) : deals.length > 0 ? (
          <View>
            <FlatList
              ref={flatListRef}
              data={deals}
              renderItem={renderCard}
              keyExtractor={(item) => item.id}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              snapToInterval={CARD_WIDTH + 12}
              decelerationRate="fast"
              contentContainerStyle={{ paddingHorizontal: 24, gap: 12 }}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
              getItemLayout={(_, index) => ({
                length: CARD_WIDTH + 12,
                offset: (CARD_WIDTH + 12) * index,
                index,
              })}
            />
            {/* Dots */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "center",
                marginTop: 14,
                gap: 6,
              }}
            >
              {deals.map((_, i) => (
                <View
                  key={i}
                  style={{
                    width: activeIndex === i ? 20 : 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor:
                      activeIndex === i
                        ? colors.brand.traceRed
                        : theme.border,
                  }}
                />
              ))}
            </View>
          </View>
        ) : null}
      </View>

      {/* CTA section — pinned to bottom */}
      <View style={{ paddingHorizontal: 24, paddingBottom: 12 }}>
        <Text
          style={{
            textAlign: "center",
            color: theme.mutedForeground,
            fontSize: 15,
            lineHeight: 22,
            marginBottom: 16,
          }}
        >
          Sign up to get flight deals personalized{"\n"}to{" "}
          <Text style={{ color: colors.brand.traceRed, fontWeight: "700" }}>
            your airport
          </Text>
          , right when they drop.
        </Text>
        <TouchableOpacity
          onPress={() => navigation.navigate("Login")}
          style={{
            backgroundColor: colors.brand.traceRed,
            borderRadius: 14,
            paddingVertical: 16,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#fff", fontSize: 17, fontWeight: "700" }}>
            Get started
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.navigate("Login")}
          style={{ marginTop: 14, alignItems: "center" }}
        >
          <Text style={{ color: theme.mutedForeground, fontSize: 14 }}>
            Already have an account?{" "}
            <Text style={{ color: theme.foreground, fontWeight: "600" }}>
              Sign in
            </Text>
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
