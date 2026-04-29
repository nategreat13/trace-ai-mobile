import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Modal,
  Animated,
  useColorScheme,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Lock } from "lucide-react-native";
import type { RootStackParamList } from "../navigation/types";
import { colors } from "../theme/colors";
import { Deal } from "@trace/shared";
import SwipeCard from "../components/swipe/SwipeCard";
import { logEvent } from "../lib/analytics";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const MAX_GUEST_DEALS = 8;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const PREVIEW_DEALS: Pick<Deal, "id"|"destination"|"destination_code"|"origin"|"price"|"original_price"|"discount_pct"|"travel_window"|"dateString"|"deal_type"|"image_url"|"airlines"|"duration"|"ai_insight"|"vibe_description"|"continent"|"urgency"|"price_trend"|"itinerary_ideas"|"neighborhood_previews"|"best_time_to_book"|"experiences"|"travel_tips"|"quick_tips"|"interesting_facts"|"weather_preview"|"url"|"month_type"|"layover_info"|"domestic_or_international"|"price_will_last">[] = [
  { id:"p1", destination:"Tokyo",       destination_code:"TYO", origin:"", price:649,  original_price:1380, discount_pct:53, travel_window:"Jan – Mar", image_url:"https://www.dripuploads.com/uploads/image_upload/image/2696582/embeddable_6ba76abc-9af6-42e4-883c-1f830abeef8b.png", airlines:"ANA",             duration:"11h 30m", dateString:"", deal_type:null, ai_insight:"", vibe_description:"", continent:"Asia",    urgency:"", price_trend:"", itinerary_ideas:[], neighborhood_previews:[], best_time_to_book:"", experiences:[], travel_tips:[], quick_tips:[], interesting_facts:[], weather_preview:"", url:"", month_type:"", layover_info:"", domestic_or_international:"international", price_will_last:"" },
  { id:"p2", destination:"Paris",       destination_code:"CDG", origin:"", price:529,  original_price:1140, discount_pct:54, travel_window:"Feb – Apr", image_url:"https://www.dripuploads.com/uploads/image_upload/image/2750595/embeddable_ce33e13c-352c-400f-b9e7-8a851b4130bf.png", airlines:"Air France",      duration:"9h 45m",  dateString:"", deal_type:null, ai_insight:"", vibe_description:"", continent:"Europe",  urgency:"", price_trend:"", itinerary_ideas:[], neighborhood_previews:[], best_time_to_book:"", experiences:[], travel_tips:[], quick_tips:[], interesting_facts:[], weather_preview:"", url:"", month_type:"", layover_info:"", domestic_or_international:"international", price_will_last:"" },
  { id:"p3", destination:"Barcelona",   destination_code:"BCN", origin:"", price:489,  original_price:1050, discount_pct:53, travel_window:"Mar – May", image_url:"https://www.dripuploads.com/uploads/image_upload/image/2760078/embeddable_1e9d52ea-32c3-4c3d-af29-04039343f472.png", airlines:"Iberia",          duration:"10h 20m", dateString:"", deal_type:null, ai_insight:"", vibe_description:"", continent:"Europe",  urgency:"", price_trend:"", itinerary_ideas:[], neighborhood_previews:[], best_time_to_book:"", experiences:[], travel_tips:[], quick_tips:[], interesting_facts:[], weather_preview:"", url:"", month_type:"", layover_info:"", domestic_or_international:"international", price_will_last:"" },
  { id:"p4", destination:"London",      destination_code:"LHR", origin:"", price:579,  original_price:1220, discount_pct:53, travel_window:"Apr – Jun", image_url:"https://www.dripuploads.com/uploads/image_upload/image/2872586/embeddable_1464348e-bd81-49bd-8b32-6387877bce46.png", airlines:"British Airways", duration:"10h 15m", dateString:"", deal_type:null, ai_insight:"", vibe_description:"", continent:"Europe",  urgency:"", price_trend:"", itinerary_ideas:[], neighborhood_previews:[], best_time_to_book:"", experiences:[], travel_tips:[], quick_tips:[], interesting_facts:[], weather_preview:"", url:"", month_type:"", layover_info:"", domestic_or_international:"international", price_will_last:"" },
  { id:"p5", destination:"Santorini",   destination_code:"JTR", origin:"", price:629,  original_price:1350, discount_pct:53, travel_window:"May – Jul", image_url:"https://www.dripuploads.com/uploads/image_upload/image/2862015/embeddable_d3c4dab1-f04c-438b-87ba-eada8b5b9ff4.png", airlines:"Aegean",          duration:"12h 50m", dateString:"", deal_type:null, ai_insight:"", vibe_description:"", continent:"Europe",  urgency:"", price_trend:"", itinerary_ideas:[], neighborhood_previews:[], best_time_to_book:"", experiences:[], travel_tips:[], quick_tips:[], interesting_facts:[], weather_preview:"", url:"", month_type:"", layover_info:"", domestic_or_international:"international", price_will_last:"" },
  { id:"p6", destination:"Mexico City", destination_code:"MEX", origin:"", price:298,  original_price:640,  discount_pct:53, travel_window:"Jan – Apr", image_url:"https://www.dripuploads.com/uploads/image_upload/image/2884895/embeddable_9907fe52-404d-40a7-bd09-990830b237f5.png", airlines:"Aeromexico",      duration:"4h 30m",  dateString:"", deal_type:null, ai_insight:"", vibe_description:"", continent:"Americas", urgency:"", price_trend:"", itinerary_ideas:[], neighborhood_previews:[], best_time_to_book:"", experiences:[], travel_tips:[], quick_tips:[], interesting_facts:[], weather_preview:"", url:"", month_type:"", layover_info:"", domestic_or_international:"international", price_will_last:"" },
  { id:"p7", destination:"Bangkok",     destination_code:"BKK", origin:"", price:689,  original_price:1480, discount_pct:53, travel_window:"Nov – Feb", image_url:"https://www.dripuploads.com/uploads/image_upload/image/2858420/embeddable_19bf2895-3afa-413c-abfe-9420a68e4313.png", airlines:"Thai Airways",    duration:"18h 10m", dateString:"", deal_type:null, ai_insight:"", vibe_description:"", continent:"Asia",    urgency:"", price_trend:"", itinerary_ideas:[], neighborhood_previews:[], best_time_to_book:"", experiences:[], travel_tips:[], quick_tips:[], interesting_facts:[], weather_preview:"", url:"", month_type:"", layover_info:"", domestic_or_international:"international", price_will_last:"" },
  { id:"p8", destination:"Rome",        destination_code:"FCO", origin:"", price:549,  original_price:1180, discount_pct:53, travel_window:"Mar – Jun", image_url:"https://www.dripuploads.com/uploads/image_upload/image/2845097/embeddable_153fff30-5516-442c-828b-f58c08e353e9.png", airlines:"Alitalia",        duration:"11h 05m", dateString:"", deal_type:null, ai_insight:"", vibe_description:"", continent:"Europe",  urgency:"", price_trend:"", itinerary_ideas:[], neighborhood_previews:[], best_time_to_book:"", experiences:[], travel_tips:[], quick_tips:[], interesting_facts:[], weather_preview:"", url:"", month_type:"", layover_info:"", domestic_or_international:"international", price_will_last:"" },
] as Deal[];

export default function LandingScreen() {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;
  const navigation = useNavigation<Nav>();

  const [deals, setDeals] = useState<Deal[]>(() => shuffle(PREVIEW_DEALS));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [swipeCount, setSwipeCount] = useState(0);
  const swipeHint = useRef(new Animated.Value(0)).current;
  const swipeHintOpacity = useRef(new Animated.Value(0)).current;

  const [showDetailPrompt, setShowDetailPrompt] = useState(false);
  const [showHardWall, setShowHardWall] = useState(false);

  useEffect(() => {
    logEvent("landing_viewed", {});
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.sequence([
          Animated.timing(swipeHint, { toValue: 22, duration: 260, useNativeDriver: true }),
          Animated.timing(swipeHint, { toValue: -12, duration: 200, useNativeDriver: true }),
          Animated.timing(swipeHint, { toValue: 0, duration: 160, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(swipeHintOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
          Animated.delay(500),
          Animated.timing(swipeHintOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]),
      ]).start();
    }, 700);
    return () => clearTimeout(t);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setDeals(shuffle(PREVIEW_DEALS));
      setCurrentIndex(0);
      setSwipeCount(0);
      setShowDetailPrompt(false);
      setShowHardWall(false);
    }, [])
  );

  useEffect(() => {
    if (swipeCount > 0 && swipeCount >= MAX_GUEST_DEALS) {
      setShowHardWall(true);
      logEvent("hard_wall_shown", { swipe_count: swipeCount });
    }
  }, [swipeCount]);

  const handleSwipe = useCallback(
    (action: "left" | "right" | "super") => {
      setCurrentIndex((i) => i + 1);
      setSwipeCount((c) => c + 1);
      logEvent("guest_swipe", { index: currentIndex, direction: action });
    },
    [currentIndex]
  );

  const goToSignup = (source: string) => {
    setShowDetailPrompt(false);
    setShowHardWall(false);
    logEvent("signup_viewed", { source });
    navigation.navigate("Login", { mode: "signup" });
  };

  const goToSignin = () => {
    setShowDetailPrompt(false);
    setShowHardWall(false);
    navigation.navigate("Login", { mode: "signin" });
  };

  const visibleCards = useMemo(
    () => deals.slice(currentIndex, currentIndex + 3).reverse(),
    [deals, currentIndex]
  );

  const isDeckDone = currentIndex >= deals.length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Logo */}
      <View style={{ alignItems: "center", paddingTop: 28 }}>
        <Image
          source={
            scheme === "dark"
              ? require("../../assets/TraceLogoLight.png")
              : require("../../assets/TraceLogoDark.png")
          }
          style={{ width: 140, height: 44, resizeMode: "contain" }}
        />
      </View>

      {/* Headline */}
      <Text
        style={{
          paddingHorizontal: 32,
          paddingTop: 24,
          fontSize: 34,
          fontWeight: "900",
          color: theme.foreground,
          textAlign: "center",
          lineHeight: 40,
        }}
      >
        Let the best flights{"\n"}find you.
      </Text>

      {/* Card — centered in remaining space */}
      <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 20, paddingVertical: 16 }}>
        {!isDeckDone && (
          <Animated.View style={{ height: 340, position: "relative", transform: [{ translateX: swipeHint }] }}>
            {visibleCards.map((deal, i, arr) => (
              <SwipeCard
                key={deal.id}
                deal={deal}
                isTop={i === arr.length - 1}
                onSwipe={handleSwipe}
                onExpand={() => {
                  setShowDetailPrompt(true);
                  logEvent("guest_detail_prompt", { index: currentIndex });
                }}
                triggerSwipe={null}
                isSwipeDisabled={false}
              />
            ))}
          </Animated.View>
        )}
        <Animated.Text
          style={{
            opacity: swipeHintOpacity,
            textAlign: "center",
            fontSize: 12,
            color: theme.mutedForeground,
            marginTop: 14,
            letterSpacing: 0.5,
          }}
        >
          ← swipe to explore →
        </Animated.Text>
      </View>

      {/* Bottom CTA */}
      <View style={{ paddingHorizontal: 24, paddingBottom: 20 }}>
        <Text
          style={{
            fontSize: 15,
            fontWeight: "600",
            color: theme.foreground,
            textAlign: "center",
            marginBottom: 16,
            lineHeight: 22,
          }}
        >
          Create an account to get the latest flight deals{" "}
          <Text style={{ color: colors.brand.traceRed }}>right when they drop.</Text>
        </Text>

        <TouchableOpacity
          onPress={() => goToSignup("bottom_cta")}
          style={{
            backgroundColor: colors.brand.traceRed,
            borderRadius: 14,
            paddingVertical: 16,
            alignItems: "center",
            marginBottom: 14,
            marginHorizontal: 16,
          }}
        >
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>Get Started</Text>
        </TouchableOpacity>

        <Text
          style={{
            fontSize: 11,
            color: theme.mutedForeground,
            textAlign: "center",
            lineHeight: 16,
          }}
        >
          I have read and accepted Trace Travel's{" "}
          <Text
            style={{ color: theme.foreground, textDecorationLine: "underline" }}
            onPress={() => Linking.openURL("https://tracetravelapp.com/terms")}
          >
            Terms & Conditions
          </Text>
          {" "}and{" "}
          <Text
            style={{ color: theme.foreground, textDecorationLine: "underline" }}
            onPress={() => Linking.openURL("https://tracetravelapp.com/privacy")}
          >
            Privacy Policy
          </Text>
          .
        </Text>
      </View>

      {/* Detail prompt */}
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

      {/* Hard wall */}
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
              You've seen today's top deals
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
            <View style={{ width: "100%", gap: 8, marginBottom: 20 }}>
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
              }}
            >
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>Get Started</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={goToSignin} style={{ paddingVertical: 10, marginTop: 4 }}>
              <Text style={{ color: theme.mutedForeground, fontSize: 13 }}>
                Already have an account?{" "}
                <Text style={{ color: theme.foreground, fontWeight: "700" }}>Sign in</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
