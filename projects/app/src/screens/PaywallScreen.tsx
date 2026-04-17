import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  useColorScheme,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { X, Zap, TrendingDown, Clock, Users, Crown, Briefcase, Sparkles } from "lucide-react-native";
import type { PurchasesPackage } from "react-native-purchases";
import { colors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";
import { useIAP } from "../hooks/useIAP";
import { hasEntitlement } from "../services/iap";
import type { RootStackParamList } from "../navigation/types";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const PRIVACY_URL = "https://subscribe.tracetravel.co/privacy";
const TERMS_URL = "https://subscribe.tracetravel.co/terms";

type Tier = "premium" | "business";
type BillingPeriod = "annual" | "monthly";

/**
 * Compute the percent-off an annual plan delivers vs. paying monthly × 12.
 * Returns null if we can't compute a valid discount (e.g. missing package
 * or annual is not actually cheaper).
 */
function computeAnnualSavings(
  monthlyPkg: PurchasesPackage | null,
  annualPkg: PurchasesPackage | null,
): number | null {
  if (!monthlyPkg || !annualPkg) return null;
  const monthlyPrice = monthlyPkg.product.price;
  const annualPrice = annualPkg.product.price;
  if (!monthlyPrice || !annualPrice) return null;
  const fullYear = monthlyPrice * 12;
  if (annualPrice >= fullYear) return null;
  return Math.round(((fullYear - annualPrice) / fullYear) * 100);
}

export default function PaywallScreen() {
  const navigation = useNavigation<Nav>();
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;
  const { profile, setProfile } = useAuth();

  const {
    premiumAnnualPackage,
    premiumMonthlyPackage,
    businessAnnualPackage,
    businessMonthlyPackage,
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

  const [selected, setSelected] = useState<Tier>(hasPremium ? "business" : "premium");
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("annual");

  // Resolve the package the user is about to purchase based on tier + billing
  const selectedPkg: PurchasesPackage | null = (() => {
    if (selected === "premium") {
      return billingPeriod === "annual" ? premiumAnnualPackage : premiumMonthlyPackage;
    }
    return billingPeriod === "annual" ? businessAnnualPackage : businessMonthlyPackage;
  })();

  // Resolve the two packages that correspond to the currently-chosen billing
  // period for display in the plan cards.
  const premiumDisplayPkg =
    billingPeriod === "annual" ? premiumAnnualPackage : premiumMonthlyPackage;
  const businessDisplayPkg =
    billingPeriod === "annual" ? businessAnnualPackage : businessMonthlyPackage;

  // Compute annual savings per tier (used for the SAVE X% badge on the toggle)
  const premiumSavings = computeAnnualSavings(premiumMonthlyPackage, premiumAnnualPackage);
  const businessSavings = computeAnnualSavings(businessMonthlyPackage, businessAnnualPackage);
  // Show the bigger of the two as the headline savings on the annual toggle
  const annualSavings =
    premiumSavings != null && businessSavings != null
      ? Math.max(premiumSavings, businessSavings)
      : premiumSavings ?? businessSavings;

  const isSelectedCurrent =
    (selected === "premium" && hasPremium) ||
    (selected === "business" && hasBusiness);
  const isSelectedDowngrade = selected === "premium" && hasBusiness;
  const subscribeDisabled = isSelectedCurrent || isSelectedDowngrade;

  const handlePurchase = async () => {
    if (!selectedPkg) return;

    const info = await purchase(selectedPkg);
    if (!info) return;

    const isPremium = hasEntitlement(info, "premium");
    const isBusiness = hasEntitlement(info, "business");
    if (isPremium || isBusiness) {
      setProfile((prev) =>
        prev ? { ...prev, subscriptionStatus: isBusiness ? "business" : "premium" } : prev
      );
      navigation.goBack();
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
        prev ? { ...prev, subscriptionStatus: isBusiness ? "business" : "premium" } : prev
      );
      navigation.goBack();
    }
  };

  const hasAnyPackage =
    premiumAnnualPackage ||
    premiumMonthlyPackage ||
    businessAnnualPackage ||
    businessMonthlyPackage;

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

  if (!hasAnyPackage) {
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

  const accent = selected === "business" ? colors.brand.amber500 : colors.brand.traceRed;
  const periodSuffix = billingPeriod === "annual" ? "year" : "month";

  // Price label + per-period label for the CTA
  const priceString = selectedPkg?.product.priceString ?? "";

  // Optional supporting line under a monthly annual card: "$X.XX/month billed annually"
  const getPerMonthFromAnnual = (pkg: PurchasesPackage | null): string | null => {
    if (!pkg) return null;
    const p = pkg.product.price;
    if (!p) return null;
    const perMonth = p / 12;
    // Format with currency symbol matching the product's pricing locale
    const localized = pkg.product.priceString;
    // Derive the symbol by stripping digits/decimals from localized price string
    const symbolMatch = localized.replace(/[0-9.,\s]/g, "").trim();
    const symbol = symbolMatch || "$";
    return `${symbol}${perMonth.toFixed(2)}/mo`;
  };

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

      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        {/* Compact header */}
        <View style={{ paddingHorizontal: 24, paddingTop: 32, paddingBottom: 20 }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "700",
              color: accent,
              marginBottom: 6,
            }}
          >
            {selected === "business" ? "TRACE BUSINESS" : "TRACE PREMIUM"}
          </Text>
          <Text
            style={{
              fontSize: 26,
              fontWeight: "900",
              color: theme.foreground,
              lineHeight: 32,
            }}
          >
            {selected === "business"
              ? "Fly business. Pay economy."
              : "Unlock the full Trace experience"}
          </Text>
        </View>

        {/* Billing period toggle */}
        <View style={{ paddingHorizontal: 24, marginBottom: 16 }}>
          <View
            style={{
              flexDirection: "row",
              backgroundColor: theme.muted,
              borderRadius: 14,
              padding: 4,
            }}
          >
            <TouchableOpacity
              onPress={() => setBillingPeriod("monthly")}
              activeOpacity={0.85}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 10,
                alignItems: "center",
                backgroundColor: billingPeriod === "monthly" ? theme.card : "transparent",
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "700",
                  color:
                    billingPeriod === "monthly" ? theme.foreground : theme.mutedForeground,
                }}
              >
                Monthly
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setBillingPeriod("annual")}
              activeOpacity={0.85}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 10,
                alignItems: "center",
                backgroundColor: billingPeriod === "annual" ? theme.card : "transparent",
                flexDirection: "row",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "700",
                  color: billingPeriod === "annual" ? theme.foreground : theme.mutedForeground,
                }}
              >
                Annual
              </Text>
              {annualSavings != null && (
                <View
                  style={{
                    backgroundColor: colors.brand.traceGreen,
                    borderRadius: 6,
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                  }}
                >
                  <Text style={{ fontSize: 9, fontWeight: "800", color: "#fff" }}>
                    SAVE {annualSavings}%
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Plan cards */}
        <View style={{ paddingHorizontal: 24, gap: 12, marginBottom: 24 }}>
          {/* Premium */}
          {premiumDisplayPkg && (
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
                    {billingPeriod === "annual" && premiumSavings != null && !hasPremium && (
                      <View
                        style={{
                          backgroundColor: colors.brand.traceGreen,
                          borderRadius: 6,
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                        }}
                      >
                        <Text style={{ fontSize: 9, fontWeight: "800", color: "#fff" }}>
                          {premiumSavings}% OFF
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ fontSize: 13, color: theme.mutedForeground, marginTop: 2 }}>
                    Unlimited swipes & saves
                  </Text>
                  {billingPeriod === "annual" && (
                    <Text style={{ fontSize: 11, color: theme.mutedForeground, marginTop: 4 }}>
                      {getPerMonthFromAnnual(premiumDisplayPkg)} billed annually
                    </Text>
                  )}
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ fontSize: 20, fontWeight: "900", color: theme.foreground }}>
                    {premiumDisplayPkg.product.priceString}
                  </Text>
                  <Text style={{ fontSize: 11, color: theme.mutedForeground }}>
                    /{billingPeriod === "annual" ? "year" : "month"}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          )}

          {/* Business */}
          {businessDisplayPkg && (
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
                    {billingPeriod === "annual" && businessSavings != null && !hasBusiness && (
                      <View
                        style={{
                          backgroundColor: colors.brand.traceGreen,
                          borderRadius: 6,
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                        }}
                      >
                        <Text style={{ fontSize: 9, fontWeight: "800", color: "#fff" }}>
                          {businessSavings}% OFF
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ fontSize: 13, color: theme.mutedForeground, marginTop: 2 }}>
                    Business class deals + everything in Premium
                  </Text>
                  {billingPeriod === "annual" && (
                    <Text style={{ fontSize: 11, color: theme.mutedForeground, marginTop: 4 }}>
                      {getPerMonthFromAnnual(businessDisplayPkg)} billed annually
                    </Text>
                  )}
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ fontSize: 20, fontWeight: "900", color: theme.foreground }}>
                    {businessDisplayPkg.product.priceString}
                  </Text>
                  <Text style={{ fontSize: 11, color: theme.mutedForeground }}>
                    /{billingPeriod === "annual" ? "year" : "month"}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Features */}
        <View style={{ paddingHorizontal: 24, marginBottom: 24 }}>
          <Text
            style={{
              fontSize: 13,
              fontWeight: "700",
              color: theme.mutedForeground,
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 8,
            }}
          >
            What's included
          </Text>
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
          ).map((f, i) => (
            <View
              key={i}
              style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 10 }}
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
          ))}
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
          let ctaLabel: string;
          if (isSelectedCurrent) {
            ctaLabel = "This is your current plan";
          } else if (isSelectedDowngrade) {
            ctaLabel = "You already have Business";
          } else if (hasPremium && selected === "business") {
            ctaLabel = `Upgrade to Business — ${priceString}/${periodSuffix}`;
          } else if (trialEligible) {
            ctaLabel = "Start 3-day free trial";
          } else {
            ctaLabel = `Subscribe for ${priceString}/${periodSuffix}`;
          }

          const isDisabled = purchasing || !selectedPkg || subscribeDisabled;

          return (
            <>
              <TouchableOpacity
                onPress={handlePurchase}
                disabled={isDisabled}
                activeOpacity={0.85}
                style={{ borderRadius: 16, overflow: "hidden", opacity: isDisabled ? 0.5 : 1 }}
              >
                <LinearGradient
                  colors={
                    selected === "business"
                      ? [colors.brand.amber400, colors.brand.orange500]
                      : [colors.brand.traceRed, colors.brand.tracePink]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ paddingVertical: 16, alignItems: "center", justifyContent: "center" }}
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
                  Then {priceString}/{periodSuffix}. Cancel anytime.
                </Text>
              )}
            </>
          );
        })()}
      </View>
    </SafeAreaView>
  );
}
