import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  useColorScheme,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { Check, ArrowRight, Zap } from "lucide-react-native";
import { colors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";
import { useTrialEligibility } from "../hooks/useTrialEligibility";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const DEALS = [
  { from: "LAX", to: "London", dest: "London", airline: "British Airways", price: 1849, normal: 4800, pct: 61, flag: "🇬🇧", cabin: "Flat Bed · Club World" },
  { from: "JFK", to: "Tokyo", dest: "Tokyo", airline: "Japan Airlines", price: 2390, normal: 5800, pct: 59, flag: "🇯🇵", cabin: "Flat Bed · Executive" },
  { from: "SFO", to: "Paris", dest: "Paris", airline: "Air France", price: 1999, normal: 4900, pct: 59, flag: "🇫🇷", cabin: "Flat Bed · La Première" },
  { from: "MIA", to: "Dubai", dest: "Dubai", airline: "Emirates", price: 1599, normal: 3800, pct: 58, flag: "🇦🇪", cabin: "Flat Bed · Business" },
];

const EXPERIENCES = [
  { emoji: "🛋️", title: "Lie-Flat Seats", desc: "Arrive refreshed in a fully flat bed at 35,000 feet" },
  { emoji: "🥂", title: "Fine Dining", desc: "Champagne, caviar, and chef-curated menus on board" },
  { emoji: "🏛️", title: "Airport Lounges", desc: "Skip the terminal chaos. Relax in world-class lounges" },
  { emoji: "🎧", title: "Total Privacy", desc: "Your own suite. No middle seats. Ever." },
  { emoji: "🧖", title: "Wellness Kits", desc: "Luxury amenity kits from top beauty brands" },
  { emoji: "⚡", title: "Priority Everything", desc: "Fast-track security, first to board, first to land" },
];

const TESTIMONIALS = [
  { name: "Marcus T.", handle: "@marcust", text: "Slept the entire flight to Tokyo. Woke up to landing. Business class to Japan for $2,390 — I paid $5,800 last year.", stars: 5 },
  { name: "Sarah P.", handle: "@sarahflies", text: "The 48h early access alone is worth it. I snagged London business class before anyone else. Game-changer.", stars: 5 },
  { name: "Elena M.", handle: "@elenam", text: "Champagne before takeoff. Lie-flat bed. Saved $3,500. This is how everyone should fly to Europe.", stars: 5 },
  { name: "David K.", handle: "@davidk", text: "Emirates business class to Dubai — full suite, bar, shower. Paid $1,599. My colleague paid $3,800. No brainer.", stars: 5 },
];

export default function UpgradeScreen() {
  const navigation = useNavigation<Nav>();
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;
  const { profile } = useAuth();
  const trialEligible = useTrialEligibility();

  const [dealIdx, setDealIdx] = useState(0);
  const [testimonialIdx, setTestimonialIdx] = useState(0);

  const shimmerTranslate = useSharedValue(-SCREEN_WIDTH);

  useEffect(() => {
    const dealTimer = setInterval(() => setDealIdx((i) => (i + 1) % DEALS.length), 3000);
    const testTimer = setInterval(() => setTestimonialIdx((i) => (i + 1) % TESTIMONIALS.length), 4500);
    shimmerTranslate.value = withRepeat(
      withTiming(SCREEN_WIDTH * 2, { duration: 1800, easing: Easing.linear }),
      -1,
      false
    );
    return () => { clearInterval(dealTimer); clearInterval(testTimer); };
  }, []);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerTranslate.value }],
  }));

  const isBusiness = profile?.subscriptionStatus === "business";
  const isTrialActive =
    profile?.subscriptionStatus === "trial" &&
    profile?.trialEndDate &&
    new Date(profile.trialEndDate) > new Date();
  const getDaysLeft = () => {
    if (!profile?.trialEndDate) return 0;
    return Math.max(0, Math.ceil((new Date(profile.trialEndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
  };

  const deal = DEALS[dealIdx];
  const testimonial = TESTIMONIALS[testimonialIdx];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>

        {/* ── Cinematic Hero ── */}
        <LinearGradient
          colors={["#0a0a12", "#0f1929", "#0a1628"]}
          style={{ paddingTop: 40, paddingBottom: 48, paddingHorizontal: 24 }}
        >
          {isTrialActive && (
            <Animated.View entering={FadeIn.duration(600)}
              style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(245,158,11,0.15)", borderWidth: 1, borderColor: colors.brand.amber500 + "60", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, alignSelf: "flex-start", marginBottom: 20 }}
            >
              <Zap color={colors.brand.amber500} size={12} />
              <Text style={{ fontSize: 12, fontWeight: "700", color: colors.brand.amber400 }}>
                {getDaysLeft()} days left in trial
              </Text>
            </Animated.View>
          )}

          <Animated.View entering={FadeInDown.delay(100).duration(600)}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <View style={{ backgroundColor: colors.brand.amber500, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ fontSize: 10, fontWeight: "800", color: "#fff", letterSpacing: 1.5, textTransform: "uppercase" }}>Business Class</Text>
              </View>
            </View>
            <Text style={{ fontSize: 40, fontWeight: "900", color: "#fff", lineHeight: 46, marginBottom: 14 }}>
              The way flying{"\n"}was meant{"\n"}to feel.
            </Text>
            <Text style={{ fontSize: 15, color: "rgba(255,255,255,0.6)", lineHeight: 22, marginBottom: 28 }}>
              Lie-flat beds. Champagne. Exclusive deals up to 65% off — before anyone else sees them.
            </Text>
          </Animated.View>

          {/* Quick stats row */}
          <Animated.View entering={FadeInDown.delay(200).duration(600)}
            style={{ flexDirection: "row", gap: 8 }}
          >
            {[
              { value: "65%", label: "avg discount" },
              { value: "48h", label: "early access" },
              { value: "$2.4K", label: "avg saved/yr" },
            ].map((s, i) => (
              <View key={i} style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 14, padding: 14, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}>
                <Text style={{ fontSize: 20, fontWeight: "900", color: colors.brand.amber400 }}>{s.value}</Text>
                <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 3 }}>{s.label}</Text>
              </View>
            ))}
          </Animated.View>
        </LinearGradient>

        {/* ── Deal Preview Carousel ── */}
        <View style={{ paddingHorizontal: 20, paddingTop: 28, marginBottom: 28 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <Text style={{ fontSize: 18, fontWeight: "900", color: theme.foreground }}>Deals This Week</Text>
            <View style={{ backgroundColor: colors.brand.amber500 + "20", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ fontSize: 11, fontWeight: "700", color: colors.brand.amber600 }}>Business Only</Text>
            </View>
          </View>

          <Animated.View
            key={`deal-${dealIdx}`}
            entering={FadeIn.duration(350)}
          >
            <LinearGradient
              colors={["#0f1929", "#1a2a40"]}
              style={{ borderRadius: 20, overflow: "hidden", borderWidth: 1, borderColor: "rgba(245,158,11,0.25)" }}
            >
              {/* Top bar */}
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.07)" }}>
                <Text style={{ fontSize: 26 }}>{deal.flag}</Text>
                <View style={{ backgroundColor: colors.brand.amber500, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 3 }}>
                  <Text style={{ fontSize: 10, fontWeight: "800", color: "#fff", letterSpacing: 0.8 }}>👑 {deal.pct}% OFF</Text>
                </View>
              </View>

              {/* Route */}
              <View style={{ paddingHorizontal: 18, paddingTop: 16, paddingBottom: 20 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <Text style={{ fontSize: 22, fontWeight: "900", color: "#fff" }}>{deal.from}</Text>
                  <Text style={{ fontSize: 16, color: "rgba(255,255,255,0.4)" }}>→</Text>
                  <Text style={{ fontSize: 22, fontWeight: "900", color: "#fff" }}>{deal.to}</Text>
                </View>
                <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 14 }}>{deal.airline} · {deal.cabin}</Text>

                <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
                  <View>
                    <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 2 }}>Business class from</Text>
                    <Text style={{ fontSize: 36, fontWeight: "900", color: colors.brand.amber400 }}>${deal.price.toLocaleString()}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", textDecorationLine: "line-through" }}>
                      ${deal.normal.toLocaleString()}
                    </Text>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: "#4ade80", marginTop: 2 }}>
                      Save ${(deal.normal - deal.price).toLocaleString()}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Blur CTA */}
              <View style={{ backgroundColor: "rgba(255,255,255,0.05)", paddingHorizontal: 18, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", flex: 1 }}>🔒 Unlock to see booking link</Text>
                <Text style={{ fontSize: 11, fontWeight: "700", color: colors.brand.amber400 }}>Members only</Text>
              </View>
            </LinearGradient>
          </Animated.View>

          {/* Carousel dots */}
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 14 }}>
            {DEALS.map((_, i) => (
              <View key={i} style={{ width: i === dealIdx ? 20 : 6, height: 6, borderRadius: 3, backgroundColor: colors.brand.amber500, opacity: i === dealIdx ? 1 : 0.25 }} />
            ))}
          </View>
        </View>

        {/* ── The Experience ── */}
        <View style={{ paddingHorizontal: 20, marginBottom: 28 }}>
          <Text style={{ fontSize: 18, fontWeight: "900", color: theme.foreground, marginBottom: 6 }}>The Business Class Experience</Text>
          <Text style={{ fontSize: 13, color: theme.mutedForeground, marginBottom: 18 }}>Everything that makes front-of-plane worth it — now at the back-of-plane price.</Text>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {EXPERIENCES.map((exp, i) => (
              <Animated.View
                key={i}
                entering={FadeInDown.delay(i * 60).duration(400)}
                style={{
                  width: (SCREEN_WIDTH - 50) / 2,
                  backgroundColor: theme.card,
                  borderRadius: 16,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: theme.border,
                }}
              >
                <Text style={{ fontSize: 28, marginBottom: 10 }}>{exp.emoji}</Text>
                <Text style={{ fontSize: 13, fontWeight: "800", color: theme.foreground, marginBottom: 4 }}>{exp.title}</Text>
                <Text style={{ fontSize: 12, color: theme.mutedForeground, lineHeight: 17 }}>{exp.desc}</Text>
              </Animated.View>
            ))}
          </View>
        </View>

        {/* ── Savings Callout ── */}
        <View style={{ paddingHorizontal: 20, marginBottom: 28 }}>
          <LinearGradient
            colors={scheme === "dark" ? ["#1a1200", "#2a1e00"] : [colors.brand.amber50, "#fff8e0"]}
            style={{ borderRadius: 20, padding: 22, borderWidth: 1, borderColor: colors.brand.amber500 + "40" }}
          >
            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.brand.amber600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>By the numbers</Text>
            <View style={{ gap: 12 }}>
              {[
                { label: "Average business class deal price", value: "$1,800", note: "vs $4,500 retail" },
                { label: "Average member savings per trip", value: "$2,700", note: "per flight booked" },
                { label: "New business class deals / week", value: "20+", note: "across 50+ airlines" },
              ].map((row, i) => (
                <View key={i} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={{ fontSize: 12, color: scheme === "dark" ? "rgba(255,255,255,0.6)" : colors.brand.amber600 }}>{row.label}</Text>
                    <Text style={{ fontSize: 11, color: colors.brand.amber600, marginTop: 1 }}>{row.note}</Text>
                  </View>
                  <Text style={{ fontSize: 22, fontWeight: "900", color: colors.brand.amber600 }}>{row.value}</Text>
                </View>
              ))}
            </View>
          </LinearGradient>
        </View>

        {/* ── What's included ── */}
        <View style={{ paddingHorizontal: 20, marginBottom: 28 }}>
          <Text style={{ fontSize: 18, fontWeight: "900", color: theme.foreground, marginBottom: 14 }}>Everything in Business</Text>
          <View style={{ backgroundColor: theme.card, borderRadius: 20, borderWidth: 1, borderColor: theme.border, overflow: "hidden" }}>
            {[
              { emoji: "👑", title: "Exclusive business class deals", desc: "Lie-flat fares up to 65% off, unavailable anywhere else" },
              { emoji: "⚡", title: "48-hour early access", desc: "See new deals 2 days before regular and premium members" },
              { emoji: "♾️", title: "Unlimited swipes", desc: "No daily cap — explore every deal at your own pace" },
              { emoji: "🔔", title: "Instant deal alerts", desc: "Push notifications the moment a matching deal drops" },
              { emoji: "🎯", title: "AI deal matching", desc: "Smarter recommendations tuned to your travel style" },
              { emoji: "💬", title: "VIP support", desc: "Priority response, human team, no bots" },
            ].map((item, i, arr) => (
              <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: 14, padding: 16, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: theme.border }}>
                <Text style={{ fontSize: 20, marginTop: 1 }}>{item.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: theme.foreground }}>{item.title}</Text>
                  <Text style={{ fontSize: 12, color: theme.mutedForeground, marginTop: 2 }}>{item.desc}</Text>
                </View>
                <Check size={16} color={colors.brand.amber500} style={{ marginTop: 2 }} />
              </View>
            ))}
          </View>
        </View>

        {/* ── Testimonials ── */}
        <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
          <Text style={{ fontSize: 18, fontWeight: "900", color: theme.foreground, marginBottom: 14 }}>What Members Say</Text>
          <Animated.View
            key={`test-${testimonialIdx}`}
            entering={FadeIn.duration(400)}
            style={{
              backgroundColor: scheme === "dark" ? "#0f1929" : "#f0f7ff",
              borderRadius: 20,
              padding: 22,
              borderWidth: 1,
              borderColor: scheme === "dark" ? "rgba(245,158,11,0.2)" : colors.brand.amber200,
            }}
          >
            <Text style={{ fontSize: 15, marginBottom: 12 }}>{"⭐".repeat(testimonial.stars)}</Text>
            <Text style={{ fontSize: 15, color: theme.foreground, fontStyle: "italic", lineHeight: 22, marginBottom: 14 }}>
              "{testimonial.text}"
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.brand.amber500 + "30", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 14 }}>✈️</Text>
              </View>
              <View>
                <Text style={{ fontSize: 13, fontWeight: "700", color: theme.foreground }}>{testimonial.name}</Text>
                <Text style={{ fontSize: 11, color: theme.mutedForeground }}>{testimonial.handle}</Text>
              </View>
            </View>
          </Animated.View>
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 14 }}>
            {TESTIMONIALS.map((_, i) => (
              <View key={i} style={{ width: i === testimonialIdx ? 20 : 6, height: 6, borderRadius: 3, backgroundColor: colors.brand.amber500, opacity: i === testimonialIdx ? 1 : 0.25 }} />
            ))}
          </View>
        </View>

      </ScrollView>

      {/* ── Fixed CTA ── */}
      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: theme.background, borderTopWidth: 1, borderTopColor: theme.border, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32 }}>
        {isBusiness ? (
          <View style={{ backgroundColor: theme.muted, borderRadius: 16, paddingVertical: 16, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}>
            <Check color={theme.mutedForeground} size={20} />
            <Text style={{ color: theme.mutedForeground, fontWeight: "700", fontSize: 16 }}>You're Business Class ✓</Text>
          </View>
        ) : (
          <>
            <TouchableOpacity
              onPress={() =>
                navigation.navigate("Paywall", {
                  entryPoint: trialEligible ? "upgrade_screen_trial" : "upgrade_screen",
                })
              }
              activeOpacity={0.85}
              style={{ borderRadius: 16, overflow: "hidden" }}
            >
              <LinearGradient
                colors={[colors.brand.amber400, colors.brand.orange500]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ paddingVertical: 16, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8, overflow: "hidden" }}
              >
                <Animated.View style={[{ position: "absolute", top: 0, bottom: 0, width: 80, opacity: 0.3 }, shimmerStyle]}>
                  <LinearGradient colors={["transparent", "rgba(255,255,255,0.6)", "transparent"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
                </Animated.View>
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>
                  {trialEligible ? "Try Premium free for 3 days" : "Unlock Business Class"}
                </Text>
                <ArrowRight color="#fff" size={20} />
              </LinearGradient>
            </TouchableOpacity>
            <Text style={{ textAlign: "center", fontSize: 11, color: theme.mutedForeground, marginTop: 8 }}>
              {trialEligible
                ? "No payment due today · Cancel anytime"
                : "Members save an average of $2,400/year · Cancel anytime"}
            </Text>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
