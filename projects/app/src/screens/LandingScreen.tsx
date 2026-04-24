import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Modal,
  useColorScheme,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { X, Heart, ChevronDown, Sparkles, Lock } from "lucide-react-native";
import type { RootStackParamList } from "../navigation/types";
import { colors } from "../theme/colors";
import { fetchDeals } from "../services/dealsApi";
import { Deal } from "@trace/shared";
import SwipeCard from "../components/swipe/SwipeCard";
import AirportInput from "../components/onboarding/AirportInput";
import { logEvent } from "../lib/analytics";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const MAX_GUEST_DEALS = 10;
const SOFT_PROMPT_EVERY = 2;

function dedupeByDestination(arr: Deal[]): Deal[] {
  const seen = new Set<string>();
  return arr.filter((d) => {
    if (seen.has(d.destination)) return false;
    seen.add(d.destination);
    return true;
  });
}

function sortByBestDeal(arr: Deal[]): Deal[] {
  return [...arr].sort((a, b) => {
    if ((b.discount_pct || 0) !== (a.discount_pct || 0))
      return (b.discount_pct || 0) - (a.discount_pct || 0);
    return (a.price || 0) - (b.price || 0);
  });
}

export default function LandingScreen() {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;
  const navigation = useNavigation<Nav>();

  // Airport state
  const [airport, setAirport] = useState("LAX");
  const [showAirportPicker, setShowAirportPicker] = useState(false);

  // Deals state
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  // Swipe state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [swipeCount, setSwipeCount] = useState(0);
  const [triggerSwipe, setTriggerSwipe] = useState<"left" | "right" | "super" | null>(null);

  // Prompt state
  const [showSoftPrompt, setShowSoftPrompt] = useState(false);
  const [showDetailPrompt, setShowDetailPrompt] = useState(false);
  const [showHardWall, setShowHardWall] = useState(false);

  // Log a landing view on initial mount (not on every airport change)
  useEffect(() => {
    logEvent("landing_viewed", { airport });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load deals whenever the airport changes
  useEffect(() => {
    setLoading(true);
    fetchDeals(airport)
      .then((all) => {
        const withImages = all.filter((d) => d.image_url);
        const sorted = sortByBestDeal(withImages);
        const deduped = dedupeByDestination(sorted).slice(0, MAX_GUEST_DEALS);
        setDeals(deduped);
        // Reset swipe state for new airport
        setCurrentIndex(0);
        setSwipeCount(0);
        setShowSoftPrompt(false);
        setShowHardWall(false);
      })
      .catch(() => setDeals([]))
      .finally(() => setLoading(false));
  }, [airport]);

  // Check for prompts as swipe count changes
  useEffect(() => {
    if (swipeCount === 0) return;
    // Hard wall after the final swipe
    if (swipeCount >= MAX_GUEST_DEALS) {
      setShowHardWall(true);
      logEvent("hard_wall_shown", { airport, swipe_count: swipeCount });
      return;
    }
    // Soft prompt every N swipes
    if (swipeCount % SOFT_PROMPT_EVERY === 0) {
      setShowSoftPrompt(true);
      logEvent("soft_prompt_shown", { airport, swipe_count: swipeCount });
    }
  }, [swipeCount, airport]);

  // All swipe directions behave the same way: advance the deck and bump
  // the counter. The soft-prompt effect handles surfacing a signup modal
  // every N swipes.
  const handleSwipe = useCallback(
    (action: "left" | "right" | "super") => {
      setTriggerSwipe(null);
      setCurrentIndex((i) => i + 1);
      setSwipeCount((c) => c + 1);
      logEvent("guest_swipe", {
        airport,
        index: currentIndex,
        direction: action,
      });
    },
    [airport, currentIndex]
  );

  const handleButtonSwipe = (action: "left" | "right") => {
    setTriggerSwipe(action);
    setTimeout(() => setTriggerSwipe(null), 400);
  };

  const goToSignup = (source: string) => {
    if (showSoftPrompt) logEvent("soft_prompt_accepted", { source });
    if (showHardWall) logEvent("hard_wall_accepted", { source });
    setShowSoftPrompt(false);
    setShowDetailPrompt(false);
    setShowHardWall(false);
    logEvent("signup_viewed", { source });
    navigation.navigate("Login", { mode: "signup" });
  };

  const goToSignin = () => {
    setShowSoftPrompt(false);
    setShowDetailPrompt(false);
    setShowHardWall(false);
    navigation.navigate("Login", { mode: "signin" });
  };

  // Stack of up to 3 cards rendered behind the top
  const visibleCards = useMemo(
    () => deals.slice(currentIndex, currentIndex + 3).reverse(),
    [deals, currentIndex]
  );

  const isDeckDone = currentIndex >= deals.length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: 8,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Image
            source={require("../../assets/Bluelogo.png")}
            style={{ width: 28, height: 28, resizeMode: "contain" }}
          />
          <Text style={{ fontSize: 18, fontWeight: "900", color: theme.foreground }}>Trace</Text>
        </View>
        <TouchableOpacity
          onPress={goToSignin}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: theme.border,
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: "700", color: theme.foreground }}>Sign in</Text>
        </TouchableOpacity>
      </View>

      {/* Airport selector */}
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 }}>
        <TouchableOpacity
          onPress={() => setShowAirportPicker(true)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            alignSelf: "flex-start",
            backgroundColor: theme.muted,
            borderRadius: 999,
            paddingHorizontal: 14,
            paddingVertical: 8,
            gap: 6,
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: "600", color: theme.mutedForeground }}>
            Deals from
          </Text>
          <Text style={{ fontSize: 14, fontWeight: "800", color: theme.foreground }}>
            {airport}
          </Text>
          <ChevronDown color={theme.mutedForeground} size={14} />
        </TouchableOpacity>
        <Text
          style={{
            marginTop: 12,
            fontSize: 22,
            fontWeight: "900",
            color: theme.foreground,
            lineHeight: 28,
          }}
        >
          Today's top flight deals
        </Text>
        <Text style={{ marginTop: 4, fontSize: 13, color: theme.mutedForeground }}>
          Swipe through {MAX_GUEST_DEALS} live deals from {airport}
        </Text>
      </View>

      {/* Deck */}
      <View style={{ flex: 1, paddingHorizontal: 12, paddingTop: 12 }}>
        {loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator size="large" color={colors.brand.traceRed} />
          </View>
        ) : deals.length === 0 ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>🛫</Text>
            <Text style={{ fontSize: 16, fontWeight: "700", color: theme.foreground, textAlign: "center" }}>
              No deals from {airport} today
            </Text>
            <Text style={{ fontSize: 13, color: theme.mutedForeground, textAlign: "center", marginTop: 6 }}>
              Try a different airport
            </Text>
          </View>
        ) : isDeckDone ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }} />
        ) : (
          <View style={{ flex: 1, position: "relative" }}>
            {visibleCards.map((deal, i, arr) => (
              <SwipeCard
                key={deal.id}
                deal={deal}
                isTop={i === arr.length - 1}
                onSwipe={handleSwipe}
                onExpand={() => {
                  setShowDetailPrompt(true);
                  logEvent("guest_detail_prompt", { airport, index: currentIndex });
                }}
                triggerSwipe={i === arr.length - 1 ? triggerSwipe : null}
                isSwipeDisabled={false}
              />
            ))}
          </View>
        )}

        {/* Progress dots + action buttons */}
        {!loading && deals.length > 0 && !isDeckDone && (
          <>
            {/* Progress */}
            <View style={{ flexDirection: "row", justifyContent: "center", gap: 4, marginTop: 12 }}>
              {deals.map((_, i) => (
                <View
                  key={i}
                  style={{
                    width: i === currentIndex ? 18 : 6,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: i <= currentIndex ? colors.brand.traceRed : theme.border,
                  }}
                />
              ))}
            </View>

            {/* Action buttons */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "center",
                gap: 36,
                paddingVertical: 16,
              }}
            >
              <TouchableOpacity
                onPress={() => handleButtonSwipe("left")}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: theme.card,
                  borderWidth: 2,
                  borderColor: theme.border,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <X color="#ef4444" size={28} strokeWidth={3} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleButtonSwipe("right")}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: theme.card,
                  borderWidth: 2,
                  borderColor: theme.border,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Heart color={colors.brand.traceGreen} fill={colors.brand.traceGreen} size={28} />
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {/* Bottom CTA */}
      <View
        style={{
          paddingHorizontal: 20,
          paddingBottom: 12,
          borderTopWidth: 1,
          borderTopColor: theme.border,
          paddingTop: 12,
        }}
      >
        <TouchableOpacity
          onPress={() => goToSignup("bottom_cta")}
          style={{
            backgroundColor: colors.brand.traceRed,
            borderRadius: 14,
            paddingVertical: 14,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>Create account</Text>
        </TouchableOpacity>
      </View>

      {/* Airport picker modal */}
      <Modal
        visible={showAirportPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAirportPicker(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingHorizontal: 20,
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: theme.border,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "800", color: theme.foreground }}>
              Pick an airport
            </Text>
            <TouchableOpacity onPress={() => setShowAirportPicker(false)}>
              <X color={theme.foreground} size={24} />
            </TouchableOpacity>
          </View>
          <ScrollView
            contentContainerStyle={{ padding: 20 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Pass an empty string so AirportInput renders its search UI
                directly (it would otherwise show a "Change" pill first). */}
            <AirportInput
              value=""
              onChange={(code) => {
                if (code) {
                  logEvent("airport_changed", { from: airport, to: code });
                  setAirport(code);
                  setShowAirportPicker(false);
                }
              }}
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Soft signup prompt — non-blocking, shown every 3 swipes */}
      <Modal visible={showSoftPrompt} transparent animationType="fade">
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setShowSoftPrompt(false)}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.55)",
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 20,
          }}
        >
          <View
            style={{
              backgroundColor: theme.card,
              borderRadius: 22,
              padding: 24,
              maxWidth: 380,
              width: "100%",
              borderWidth: 1,
              borderColor: theme.border,
              alignItems: "center",
            }}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: colors.brand.traceRed + "15",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 12,
              }}
            >
              <Sparkles color={colors.brand.traceRed} size={28} />
            </View>
            <Text style={{ fontSize: 20, fontWeight: "900", color: theme.foreground, textAlign: "center", marginBottom: 8 }}>
              Loving these deals?
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: theme.mutedForeground,
                textAlign: "center",
                marginBottom: 20,
                lineHeight: 20,
              }}
            >
              Sign up to save your favorites and let our AI learn your preferences for even better matches.
            </Text>
            <TouchableOpacity
              onPress={() => goToSignup("soft_prompt")}
              style={{
                width: "100%",
                backgroundColor: colors.brand.traceRed,
                borderRadius: 12,
                paddingVertical: 13,
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>Create account</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowSoftPrompt(false)} style={{ paddingVertical: 8 }}>
              <Text style={{ color: theme.mutedForeground, fontSize: 13 }}>Maybe later</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Detail prompt — shown when a guest taps a deal card */}
      <Modal visible={showDetailPrompt} transparent animationType="fade">
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setShowDetailPrompt(false)}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.55)",
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 20,
          }}
        >
          <View
            style={{
              backgroundColor: theme.card,
              borderRadius: 22,
              padding: 24,
              maxWidth: 380,
              width: "100%",
              borderWidth: 1,
              borderColor: theme.border,
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 40, marginBottom: 8 }}>🧭</Text>
            <Text style={{ fontSize: 20, fontWeight: "900", color: theme.foreground, textAlign: "center", marginBottom: 8 }}>
              See full deal details
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: theme.mutedForeground,
                textAlign: "center",
                marginBottom: 20,
                lineHeight: 20,
              }}
            >
              Create a free account to unlock full itinerary details, AI travel advice, weather previews, and booking links for this deal.
            </Text>
            <TouchableOpacity
              onPress={() => goToSignup("detail_prompt")}
              style={{
                width: "100%",
                backgroundColor: colors.brand.traceRed,
                borderRadius: 12,
                paddingVertical: 13,
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>Create account</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowDetailPrompt(false)} style={{ paddingVertical: 8 }}>
              <Text style={{ color: theme.mutedForeground, fontSize: 13 }}>Not now</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Hard wall — after the 10th swipe, no bypass */}
      <Modal visible={showHardWall} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.75)",
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 20,
          }}
        >
          <View
            style={{
              backgroundColor: theme.card,
              borderRadius: 22,
              padding: 28,
              maxWidth: 400,
              width: "100%",
              borderWidth: 1,
              borderColor: theme.border,
              alignItems: "center",
            }}
          >
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: colors.brand.traceRed + "18",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 14,
              }}
            >
              <Lock color={colors.brand.traceRed} size={28} />
            </View>
            <Text
              style={{
                fontSize: 22,
                fontWeight: "900",
                color: theme.foreground,
                textAlign: "center",
                marginBottom: 8,
              }}
            >
              You've seen today's top 10 deals
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: theme.mutedForeground,
                textAlign: "center",
                lineHeight: 20,
                marginBottom: 20,
              }}
            >
              Sign up for 500+ personalized deals, save favorites, and get alerts when prices drop.
            </Text>
            <View style={{ width: "100%", gap: 8 }}>
              {[
                "Personalized deals powered by AI",
                "500+ deals from your home airport",
                "Save favorites & get price-drop alerts",
                "Unlimited daily swipes",
              ].map((line, i) => (
                <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ fontSize: 14, color: colors.brand.traceGreen }}>✓</Text>
                  <Text style={{ fontSize: 13, color: theme.foreground, flex: 1 }}>{line}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity
              onPress={() => goToSignup("hard_wall")}
              style={{
                width: "100%",
                backgroundColor: colors.brand.traceRed,
                borderRadius: 12,
                paddingVertical: 14,
                alignItems: "center",
                marginTop: 20,
              }}
            >
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>Create account</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={goToSignin} style={{ paddingVertical: 10, marginTop: 4 }}>
              <Text style={{ color: theme.mutedForeground, fontSize: 13 }}>
                Already have an account? <Text style={{ color: theme.foreground, fontWeight: "700" }}>Sign in</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
