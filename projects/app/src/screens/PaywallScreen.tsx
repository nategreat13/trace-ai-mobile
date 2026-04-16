import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  useColorScheme,
  Linking,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { X, Zap, TrendingDown, Clock, Users, Crown, Briefcase, Sparkles } from "lucide-react-native";
import { colors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";
import { useIAP } from "../hooks/useIAP";
import { hasEntitlement } from "../services/iap";
import type { RootStackParamList } from "../navigation/types";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const PRIVACY_URL = "https://subscribe.tracetravel.co/privacy";
const TERMS_URL = "https://subscribe.tracetravel.co/terms";

const MANAGE_URL =
  Platform.OS === "ios"
    ? "https://apps.apple.com/account/subscriptions"
    : "https://play.google.com/store/account/subscriptions";

export default function PaywallScreen() {
  const navigation = useNavigation<Nav>();
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;
  const { profile, setProfile } = useAuth();

  const {
    premiumPackage,
    businessPackage,
    trialEligible,
    loading,
    purchasing,
    error,
    purchase,
    restore,
  } = useIAP();

  const currentTier = profile?.subscriptionStatus; // "free" | "trial" | "premium" | "business"
  const hasPremium = currentTier === "premium";
  const hasBusiness = currentTier === "business";

  // If the user already has Premium, default the selection to Business (the upgrade path).
  // If they have Business, there's nothing to upgrade to — the subscribe button is disabled below.
  const [selected, setSelected] = useState<"premium" | "business">(
    hasPremium ? "business" : "premium"
  );

  // Disable the subscribe button if the user already owns the selected tier
  // (or already has a higher tier than what they're selecting).
  const isSelectedCurrent =
    (selected === "premium" && hasPremium) ||
    (selected === "business" && hasBusiness);
  const isSelectedDowngrade = selected === "premium" && hasBusiness;
  const subscribeDisabled = isSelectedCurrent || isSelectedDowngrade;

  const handlePurchase = async () => {
    const pkg = selected === "business" ? businessPackage : premiumPackage;
    if (!pkg) return;

    const info = await purchase(pkg);
    if (!info) return;

    // Optimistically update local state — the webhook will persist to Firestore
    const isPremium = hasEntitlement(info, "premium");
    const isBusiness = hasEntitlement(info, "business");
    if (isPremium || isBusiness) {
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              subscriptionStatus: isBusiness ? "business" : "premium",
            }
          : prev
      );
      // Dismiss the paywall modal first so the welcome screen isn't stacked on top of it
      navigation.goBack();
      // Then present the welcome screen on top of MainTabs
      setTimeout(() => {
        navigation.navigate(isBusiness ? "BusinessWelcome" : "PremiumWelcome");
      }, 100);
    }
  };

  const handleRestore = async () => {
    const info = await restore();
    if (!info) return;

    const isPremium = hasEntitlement(info, "premium");
    const isBusiness = hasEntitlement(info, "business");
    if (isPremium || isBusiness) {
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              subscriptionStatus: isBusiness ? "business" : "premium",
            }
          : prev
      );
      navigation.goBack();
    }
  };

  const selectedPkg = selected === "business" ? businessPackage : premiumPackage;
  const priceLabel = selectedPkg?.product.priceString ?? "";

  if (loading) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: theme.background,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" color={colors.brand.traceRed} />
      </SafeAreaView>
    );
  }

  // Empty state — offerings failed to load (usually means App Store Connect
  // products aren't available yet)
  if (!premiumPackage && !businessPackage) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{
            position: "absolute",
            top: 56,
            right: 16,
            zIndex: 10,
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: theme.muted,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <X color={theme.foreground} size={20} />
        </TouchableOpacity>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 32 }}>
          <Text style={{ fontSize: 44, marginBottom: 16 }}>🛠️</Text>
          <Text style={{ fontSize: 20, fontWeight: "800", color: theme.foreground, textAlign: "center", marginBottom: 10 }}>
            Subscriptions unavailable
          </Text>
          <Text style={{ color: theme.mutedForeground, fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 24 }}>
            We couldn't load subscription plans right now. Please try again in a little while.
          </Text>
          <TouchableOpacity
            onPress={handleRestore}
            style={{
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: 12,
              paddingVertical: 12,
              paddingHorizontal: 24,
            }}
          >
            <Text style={{ color: theme.foreground, fontSize: 14, fontWeight: "700" }}>Restore Purchases</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Close button */}
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={{
          position: "absolute",
          top: 56,
          right: 16,
          zIndex: 10,
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: theme.muted,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <X color={theme.foreground} size={20} />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Hero */}
        <View style={{ paddingHorizontal: 24, paddingTop: 32, paddingBottom: 24 }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "700",
              color: selected === "business" ? colors.brand.amber500 : colors.brand.traceRed,
              marginBottom: 8,
            }}
          >
            {selected === "business" ? "TRACE BUSINESS" : "TRACE PREMIUM"}
          </Text>
          <Text
            style={{
              fontSize: 32,
              fontWeight: "900",
              color: theme.foreground,
              lineHeight: 38,
              marginBottom: 12,
            }}
          >
            {selected === "business"
              ? "Fly business.\nPay economy."
              : "Unlock the full\nTrace experience"}
          </Text>
          <Text style={{ fontSize: 15, color: theme.mutedForeground, lineHeight: 22 }}>
            {selected === "business"
              ? "Unlock exclusive business class deals that regular travelers never see."
              : "Get unlimited access to every flight deal, personalized to you."}
          </Text>
        </View>

        {/* Features */}
        <View style={{ paddingHorizontal: 24, marginBottom: 24 }}>
          {(selected === "business"
            ? [
                { icon: Crown, title: "Business class deals", desc: "Lie-flat seats at economy prices" },
                { icon: Clock, title: "48-hour early access", desc: "Before regular users see them" },
                { icon: Briefcase, title: "Curated by experts", desc: "Handpicked premium cabin deals" },
                { icon: Sparkles, title: "Everything in Premium", desc: "Unlimited swipes, saves & alerts" },
              ]
            : [
                { icon: Zap, title: "Unlimited swipes", desc: "No daily cap on deals" },
                { icon: TrendingDown, title: "Unlimited saves", desc: "Save as many deals as you want" },
                { icon: Clock, title: "Full Explore access", desc: "Browse and filter all deals" },
                { icon: Users, title: "Priority deal alerts", desc: "Be first to know about price drops" },
              ]
          ).map((f, i) => {
            const accent = selected === "business" ? colors.brand.amber500 : colors.brand.traceRed;
            return (
              <View
                key={i}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 14,
                  paddingVertical: 10,
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: accent + "15",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <f.icon color={accent} size={20} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: theme.foreground }}>
                    {f.title}
                  </Text>
                  <Text style={{ fontSize: 13, color: theme.mutedForeground }}>{f.desc}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Plan cards */}
        <View style={{ paddingHorizontal: 24, gap: 12, marginBottom: 24 }}>
          {/* Premium */}
          {premiumPackage && (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setSelected("premium")}
              style={{
                borderWidth: 2,
                borderColor: selected === "premium" ? colors.brand.traceRed : theme.border,
                borderRadius: 16,
                padding: 18,
                backgroundColor: theme.card,
                opacity: hasBusiness ? 0.6 : 1,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <Text style={{ fontSize: 17, fontWeight: "800", color: theme.foreground }}>
                      Premium
                    </Text>
                    {hasPremium && (
                      <View
                        style={{
                          backgroundColor: colors.brand.traceRed,
                          borderRadius: 6,
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                        }}
                      >
                        <Text style={{ fontSize: 9, fontWeight: "800", color: "#fff" }}>CURRENT PLAN</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ fontSize: 13, color: theme.mutedForeground, marginTop: 2 }}>
                    Unlimited swipes & saves
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ fontSize: 20, fontWeight: "900", color: theme.foreground }}>
                    {premiumPackage.product.priceString}
                  </Text>
                  <Text style={{ fontSize: 11, color: theme.mutedForeground }}>/year</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}

          {/* Business */}
          {businessPackage && (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setSelected("business")}
              style={{
                borderWidth: 2,
                borderColor: selected === "business" ? colors.brand.amber500 : theme.border,
                borderRadius: 16,
                padding: 18,
                backgroundColor: theme.card,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <Text style={{ fontSize: 17, fontWeight: "800", color: theme.foreground }}>
                      Business
                    </Text>
                    {hasBusiness ? (
                      <View
                        style={{
                          backgroundColor: colors.brand.amber500,
                          borderRadius: 6,
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                        }}
                      >
                        <Text style={{ fontSize: 9, fontWeight: "800", color: "#fff" }}>CURRENT PLAN</Text>
                      </View>
                    ) : (
                      <View
                        style={{
                          backgroundColor: colors.brand.amber500,
                          borderRadius: 6,
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                        }}
                      >
                        <Text style={{ fontSize: 9, fontWeight: "800", color: "#fff" }}>
                          {hasPremium ? "UPGRADE" : "BEST VALUE"}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ fontSize: 13, color: theme.mutedForeground, marginTop: 2 }}>
                    Business class deals + everything in Premium
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ fontSize: 20, fontWeight: "900", color: theme.foreground }}>
                    {businessPackage.product.priceString}
                  </Text>
                  <Text style={{ fontSize: 11, color: theme.mutedForeground }}>/year</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Error message */}
        {error && (
          <Text
            style={{
              color: "#ef4444",
              fontSize: 13,
              textAlign: "center",
              paddingHorizontal: 24,
              marginBottom: 12,
            }}
          >
            {error}
          </Text>
        )}

        {/* Restore */}
        <TouchableOpacity
          onPress={handleRestore}
          disabled={purchasing}
          style={{ alignItems: "center", marginBottom: 16 }}
        >
          <Text style={{ color: theme.mutedForeground, fontSize: 13 }}>
            Already subscribed?{" "}
            <Text style={{ color: colors.brand.traceRed, fontWeight: "700" }}>
              Restore Purchases
            </Text>
          </Text>
        </TouchableOpacity>

        {/* Legal links */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            gap: 16,
            paddingHorizontal: 24,
          }}
        >
          <TouchableOpacity onPress={() => Linking.openURL(TERMS_URL)}>
            <Text style={{ color: theme.mutedForeground, fontSize: 11 }}>Terms of Service</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_URL)}>
            <Text style={{ color: theme.mutedForeground, fontSize: 11 }}>Privacy Policy</Text>
          </TouchableOpacity>
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
          paddingBottom: 36,
        }}
      >
        {(() => {
          // Determine the CTA button label based on subscription state
          let ctaLabel: string;
          if (isSelectedCurrent) {
            ctaLabel = "This is your current plan";
          } else if (isSelectedDowngrade) {
            ctaLabel = "You already have Business";
          } else if (hasPremium && selected === "business") {
            ctaLabel = `Upgrade to Business — ${priceLabel}/year`;
          } else if (trialEligible) {
            ctaLabel = "Start 3-day free trial";
          } else {
            ctaLabel = `Subscribe for ${priceLabel}/year`;
          }

          const isDisabled = purchasing || !selectedPkg || subscribeDisabled;

          return (
            <>
              <TouchableOpacity
                onPress={handlePurchase}
                disabled={isDisabled}
                activeOpacity={0.85}
                style={{
                  borderRadius: 16,
                  overflow: "hidden",
                  opacity: isDisabled ? 0.5 : 1,
                }}
              >
                <LinearGradient
                  colors={
                    selected === "business"
                      ? [colors.brand.amber400, colors.brand.orange500]
                      : [colors.brand.traceRed, colors.brand.tracePink]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{
                    paddingVertical: 16,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {purchasing ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
                      {ctaLabel}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
              {trialEligible && !subscribeDisabled && !hasPremium && (
                <Text
                  style={{
                    textAlign: "center",
                    fontSize: 11,
                    color: theme.mutedForeground,
                    marginTop: 6,
                  }}
                >
                  Then {priceLabel}/year. Cancel anytime.
                </Text>
              )}
            </>
          );
        })()}
      </View>
    </SafeAreaView>
  );
}
