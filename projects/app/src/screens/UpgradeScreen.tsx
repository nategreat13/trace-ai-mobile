import React, { useState, useEffect } from "react";
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
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { Check, ArrowRight, Zap, TrendingDown, Clock, Users } from "lucide-react-native";
import { colors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";
import ExternalLinkDisclosure from "../components/ExternalLinkDisclosure";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const EXAMPLE_DEALS = [
  { from: "LAX", to: "London", price: 1849, normal: 4200, pct: 56, airline: "British Airways", emoji: "🇬🇧" },
  { from: "JFK", to: "Tokyo", price: 2390, normal: 5800, pct: 59, airline: "Japan Airlines", emoji: "🇯🇵" },
  { from: "SFO", to: "Paris", price: 1999, normal: 4900, pct: 59, airline: "Air France", emoji: "🇫🇷" },
  { from: "MIA", to: "Dubai", price: 1599, normal: 3800, pct: 58, airline: "Emirates", emoji: "🇦🇪" },
];

const TESTIMONIALS = [
  { name: "Marcus T.", text: "Found business class to Tokyo for $680. My colleague paid $4,200.", rating: 5 },
  { name: "Sarah P.", text: "The 48h early access alone is worth it. Game-changer.", rating: 5 },
  { name: "Elena M.", text: "Saved $3,500 on my family's Europe trip. Business class!", rating: 5 },
];

const TRUST_BADGES = [
  { emoji: "🏆", label: "Best Deal Finder" },
  { emoji: "👥", label: "10K+ Users" },
  { emoji: "💰", label: "$15M Saved" },
];

const perks = [
  { icon: TrendingDown, title: "Luxury Deals", desc: "Business class at economy prices" },
  { icon: Clock, title: "Early Access", desc: "48 hours before regular users" },
  { icon: Zap, title: "No Limits", desc: "Swipe as much as you want" },
  { icon: Users, title: "VIP Support", desc: "Priority response from our team" },
];

export default function UpgradeScreen() {
  const navigation = useNavigation<Nav>();
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;
  const { user, profile } = useAuth();
  const [dealIdx, setDealIdx] = useState(0);
  const [testimonialIdx, setTestimonialIdx] = useState(0);
  const [showDisclosure, setShowDisclosure] = useState(false);

  // Shimmer animation
  const shimmerTranslate = useSharedValue(-SCREEN_WIDTH);

  // Trust badge pulse
  const trustScale = useSharedValue(1);

  useEffect(() => {
    // Deal carousel
    const dealTimer = setInterval(() => setDealIdx((i) => (i + 1) % EXAMPLE_DEALS.length), 2500);
    // Testimonial carousel
    const testTimer = setInterval(() => setTestimonialIdx((i) => (i + 1) % TESTIMONIALS.length), 4000);

    // Shimmer
    shimmerTranslate.value = withRepeat(
      withTiming(SCREEN_WIDTH * 2, { duration: 2000, easing: Easing.linear }),
      -1,
      false
    );

    // Trust badge pulse
    trustScale.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) })
      ),
      -1
    );

    return () => {
      clearInterval(dealTimer);
      clearInterval(testTimer);
    };
  }, []);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerTranslate.value }],
  }));

  const trustPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: trustScale.value }],
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

  const deal = EXAMPLE_DEALS[dealIdx];
  const testimonial = TESTIMONIALS[testimonialIdx];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Hero */}
        <View style={{ paddingHorizontal: 24, paddingTop: 32, paddingBottom: 40 }}>
          {isTrialActive && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                backgroundColor: colors.brand.amber100,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
                alignSelf: "flex-start",
                marginBottom: 16,
              }}
            >
              <Zap color={colors.brand.amber600} size={12} />
              <Text style={{ fontSize: 12, fontWeight: "700", color: colors.brand.amber600 }}>
                {getDaysLeft()} days left in trial
              </Text>
            </View>
          )}

          <Text style={{ fontSize: 36, fontWeight: "900", color: theme.foreground, lineHeight: 42, marginBottom: 12 }}>
            Fly Business.{"\n"}Pay Economy.
          </Text>
          <Text style={{ fontSize: 16, color: theme.mutedForeground, marginBottom: 24, maxWidth: 320 }}>
            Unlock exclusive business class deals that regular travelers will never see.
          </Text>

          {/* Pricing card with gradient */}
          <LinearGradient
            colors={[colors.brand.amber400, colors.brand.orange500]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ borderRadius: 20, padding: 24 }}
          >
            <Text style={{ fontSize: 12, fontWeight: "700", color: "rgba(255,255,255,0.9)", textTransform: "uppercase", letterSpacing: 2, marginBottom: 8 }}>
              Business Class
            </Text>
            <Text style={{ fontSize: 28, fontWeight: "900", color: "#fff", marginBottom: 8 }}>
              Unlock All Features
            </Text>
            <Text style={{ fontSize: 14, color: "rgba(255,255,255,0.9)", marginBottom: 16 }}>
              See plans on our website
            </Text>
            <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.2)", marginBottom: 16 }} />
            <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.9)" }}>
              ✓ Full access · ✓ Cancel anytime
            </Text>
          </LinearGradient>
        </View>

        {/* Live deals carousel */}
        <View style={{ paddingHorizontal: 24, marginBottom: 32 }}>
          <View style={{ backgroundColor: theme.card, borderRadius: 20, borderWidth: 1, borderColor: theme.border, overflow: "hidden" }}>
            <View style={{ backgroundColor: scheme === "dark" ? "#1c1917" : colors.brand.amber50, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: colors.brand.amber600, textTransform: "uppercase", letterSpacing: 1 }}>
                ✨ Live Deals This Week
              </Text>
            </View>
            <Animated.View
              key={`deal-${dealIdx}`}
              entering={FadeIn.duration(400)}
              exiting={FadeOut.duration(200)}
              style={{ padding: 16, flexDirection: "row", alignItems: "center", gap: 16 }}
            >
              <Text style={{ fontSize: 28 }}>{deal.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "700", fontSize: 14, color: theme.foreground }}>{deal.from} → {deal.to}</Text>
                <Text style={{ fontSize: 12, color: theme.mutedForeground }}>{deal.airline}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ fontWeight: "900", fontSize: 18, color: colors.brand.amber600 }}>${deal.price}</Text>
                <Text style={{ fontSize: 12, color: theme.mutedForeground, textDecorationLine: "line-through" }}>${deal.normal}</Text>
              </View>
            </Animated.View>
            <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, paddingBottom: 12 }}>
              {EXAMPLE_DEALS.map((_, i) => (
                <Animated.View
                  key={i}
                  style={{
                    width: i === dealIdx ? 24 : 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: colors.brand.amber500,
                    opacity: i === dealIdx ? 1 : 0.3,
                  }}
                />
              ))}
            </View>
          </View>
        </View>

        {/* Trust Badges */}
        <View style={{ paddingHorizontal: 24, marginBottom: 32 }}>
          <View style={{ flexDirection: "row", gap: 12 }}>
            {TRUST_BADGES.map((badge, i) => (
              <Animated.View
                key={i}
                style={[
                  {
                    flex: 1,
                    backgroundColor: theme.card,
                    borderRadius: 16,
                    padding: 16,
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: theme.border,
                  },
                  trustPulseStyle,
                ]}
              >
                <Text style={{ fontSize: 28, marginBottom: 8 }}>{badge.emoji}</Text>
                <Text style={{ fontSize: 11, fontWeight: "700", color: theme.foreground, textAlign: "center" }}>
                  {badge.label}
                </Text>
              </Animated.View>
            ))}
          </View>
        </View>

        {/* Features */}
        <View style={{ paddingHorizontal: 24, marginBottom: 32 }}>
          <Text style={{ fontSize: 24, fontWeight: "900", color: theme.foreground, marginBottom: 16 }}>What's Included</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {perks.map((perk, i) => (
              <View
                key={i}
                style={{
                  width: "47%",
                  backgroundColor: theme.card,
                  borderRadius: 16,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: theme.border,
                }}
              >
                <perk.icon color={colors.brand.amber600} size={20} style={{ marginBottom: 12 }} />
                <Text style={{ fontSize: 14, fontWeight: "700", color: theme.foreground, marginBottom: 4 }}>{perk.title}</Text>
                <Text style={{ fontSize: 12, color: theme.mutedForeground }}>{perk.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Social proof */}
        <View style={{ paddingHorizontal: 24, marginBottom: 32 }}>
          <View style={{ backgroundColor: theme.card, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: theme.border, flexDirection: "row", justifyContent: "space-around" }}>
            <View style={{ alignItems: "center" }}>
              <Text style={{ fontSize: 24, fontWeight: "900", color: colors.brand.amber600 }}>500+</Text>
              <Text style={{ fontSize: 12, color: theme.mutedForeground, marginTop: 4 }}>Exclusive Deals</Text>
            </View>
            <View style={{ alignItems: "center" }}>
              <Text style={{ fontSize: 24, fontWeight: "900", color: colors.brand.amber600 }}>48h</Text>
              <Text style={{ fontSize: 12, color: theme.mutedForeground, marginTop: 4 }}>Early Access</Text>
            </View>
            <View style={{ alignItems: "center" }}>
              <Text style={{ fontSize: 24, fontWeight: "900", color: colors.brand.amber600 }}>4.9★</Text>
              <Text style={{ fontSize: 12, color: theme.mutedForeground, marginTop: 4 }}>Avg Rating</Text>
            </View>
          </View>
        </View>

        {/* Testimonials carousel */}
        <View style={{ paddingHorizontal: 24 }}>
          <Text style={{ fontSize: 24, fontWeight: "900", color: theme.foreground, marginBottom: 16 }}>Loved by Members</Text>
          <Animated.View
            key={`testimonial-${testimonialIdx}`}
            entering={FadeIn.duration(400)}
            exiting={FadeOut.duration(200)}
            style={{
              backgroundColor: scheme === "dark" ? "#1c1917" : colors.brand.amber50,
              borderRadius: 16,
              padding: 20,
              borderWidth: 1,
              borderColor: scheme === "dark" ? "#44403c" : colors.brand.amber200,
              marginBottom: 12,
            }}
          >
            <Text style={{ fontSize: 16, marginBottom: 8 }}>{"⭐".repeat(testimonial.rating)}</Text>
            <Text style={{ fontSize: 14, color: theme.foreground, fontStyle: "italic", lineHeight: 20, marginBottom: 12 }}>
              "{testimonial.text}"
            </Text>
            <Text style={{ fontSize: 12, fontWeight: "700", color: theme.foreground }}>{testimonial.name}</Text>
          </Animated.View>
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, marginBottom: 12 }}>
            {TESTIMONIALS.map((_, i) => (
              <View
                key={i}
                style={{
                  width: i === testimonialIdx ? 24 : 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: colors.brand.amber500,
                  opacity: i === testimonialIdx ? 1 : 0.3,
                }}
              />
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Fixed CTA */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: theme.background,
          borderTopWidth: 1,
          borderTopColor: theme.border,
          paddingHorizontal: 16,
          paddingVertical: 12,
          paddingBottom: 32,
        }}
      >
        {isBusiness ? (
          <TouchableOpacity
            disabled
            style={{
              paddingVertical: 16,
              borderRadius: 16,
              backgroundColor: theme.muted,
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <Check color={theme.mutedForeground} size={20} />
            <Text style={{ color: theme.mutedForeground, fontWeight: "700", fontSize: 16 }}>
              You're Business Class ✓
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => setShowDisclosure(true)}
            activeOpacity={0.85}
            style={{ borderRadius: 16, overflow: "hidden" }}
          >
            <LinearGradient
              colors={[colors.brand.amber400, colors.brand.orange500]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                paddingVertical: 16,
                alignItems: "center",
                flexDirection: "row",
                justifyContent: "center",
                gap: 8,
                overflow: "hidden",
              }}
            >
              {/* Shimmer overlay */}
              <Animated.View
                style={[
                  {
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    width: 80,
                    opacity: 0.3,
                  },
                  shimmerStyle,
                ]}
              >
                <LinearGradient
                  colors={["transparent", "rgba(255,255,255,0.6)", "transparent"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ flex: 1 }}
                />
              </Animated.View>
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>View Plans</Text>
              <ArrowRight color="#fff" size={20} />
            </LinearGradient>
          </TouchableOpacity>
        )}
        <Text style={{ textAlign: "center", fontSize: 10, color: theme.mutedForeground, marginTop: 8 }}>
          View pricing on our website
        </Text>
      </View>

      <ExternalLinkDisclosure
        visible={showDisclosure}
        onClose={() => setShowDisclosure(false)}
        plan="business"
        email={user?.email || undefined}
      />
    </SafeAreaView>
  );
}
