import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  useColorScheme,
  Linking,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { X, Zap, TrendingDown, Bell, Users, Crown, Clock, Sparkles } from "lucide-react-native";
import type { PurchasesPackage } from "react-native-purchases";
import { colors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";
import { useIAP } from "../hooks/useIAP";
import { hasEntitlement } from "../services/iap";
import {
  formatTrialLength,
  formatTrialDuration,
  trialsEnabledByRemote,
} from "../lib/trial";
import { logEvent } from "../lib/analytics";
import type { RootStackParamList } from "../navigation/types";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const PRIVACY_URL = "https://subscribe.tracetravel.co/privacy";
const TERMS_URL = "https://subscribe.tracetravel.co/terms";

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
  const route = useRoute<RouteProp<RootStackParamList, "Paywall">>();
  const entryPoint = route.params?.entryPoint ?? "unknown";
  const tierParam = route.params?.tier ?? "premium";
  const isBusinessPaywall = tierParam === "business";
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;
  const { profile, setProfile } = useAuth();

  const {
    offerings,
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

  const currentTier = profile?.subscriptionStatus;
  const hasPremium = currentTier === "premium" || currentTier === "business";
  const hasBusiness = currentTier === "business";

  // Default to MONTHLY — monthly trial shows a smaller commitment ($X/month)
  // vs annual and is the standard trial-conversion default.
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("monthly");

  useEffect(() => {
    logEvent("paywall_viewed", {
      current_tier: currentTier ?? "free",
      entry_point: entryPoint,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedPkg: PurchasesPackage | null = isBusinessPaywall
    ? (billingPeriod === "annual" ? businessAnnualPackage : businessMonthlyPackage)
    : (billingPeriod === "annual" ? premiumAnnualPackage : premiumMonthlyPackage);

  const premiumDisplayPkg = isBusinessPaywall
    ? (billingPeriod === "annual" ? businessAnnualPackage : businessMonthlyPackage)
    : (billingPeriod === "annual" ? premiumAnnualPackage : premiumMonthlyPackage);

  const annualSavings = isBusinessPaywall
    ? computeAnnualSavings(businessMonthlyPackage, businessAnnualPackage)
    : computeAnnualSavings(premiumMonthlyPackage, premiumAnnualPackage);

  const subscribeDisabled = isBusinessPaywall ? hasBusiness : hasPremium;

  // Free-trial detection — data-driven from the selected package's intro
  // offer. `introPrice.price === 0` means a *free* trial (vs. a paid intro
  // price). We only surface the trial CTA when the store actually carries
  // a free offer AND RevenueCat reports the user is eligible, so we never
  // promise a trial the purchase sheet won't honor. Also excludes existing
  // premium users and current-plan/downgrade selections.
  //
  // NOTE: this block (and the useRef/useEffect below) MUST stay above the
  // `if (loading)` / `if (!hasAnyPackage)` early returns further down —
  // hooks cannot run conditionally or React will throw on the loading→ready
  // transition.
  const introPrice = selectedPkg?.product.introPrice ?? null;
  const hasFreeTrial =
    trialsEnabledByRemote(offerings?.current) &&
    trialEligible &&
    !!introPrice &&
    introPrice.price === 0 &&
    !hasPremium &&
    !subscribeDisabled;
  const trialLengthLabel = introPrice ? formatTrialLength(introPrice) : "";
  const trialDurationLabel = introPrice ? formatTrialDuration(introPrice) : "";

  const trialOfferLoggedRef = useRef(false);
  useEffect(() => {
    if (hasFreeTrial && !trialOfferLoggedRef.current) {
      trialOfferLoggedRef.current = true;
      logEvent("trial_offer_shown", {
        tier: "premium",
        billing: billingPeriod,
        trial_length: trialLengthLabel,
        entry_point: entryPoint,
      });
    }
  }, [hasFreeTrial, billingPeriod, trialLengthLabel, entryPoint]);

  const handlePurchase = async () => {
    if (!selectedPkg) return;

    logEvent("paywall_cta_tapped", {
      tier: isBusinessPaywall ? "business" : "premium",
      billing: billingPeriod,
      product_id: selectedPkg.product.identifier,
      is_trial: hasFreeTrial,
      trial_length: hasFreeTrial ? trialLengthLabel : null,
    });
    logEvent("purchase_initiated", {
      tier: isBusinessPaywall ? "business" : "premium",
      billing: billingPeriod,
      product_id: selectedPkg.product.identifier,
      is_trial: hasFreeTrial,
      trial_length: hasFreeTrial ? trialLengthLabel : null,
    });

    const purchasedTier = isBusinessPaywall ? "business" : "premium";
    const info = await purchase(selectedPkg, {
      tier: purchasedTier,
      billing: billingPeriod,
    });
    if (!info) return;

    const nowHasBusiness = hasEntitlement(info, "business");
    const nowHasPremium = hasEntitlement(info, "premium");
    const statusAfter: "premium" | "business" = nowHasBusiness
      ? "business"
      : nowHasPremium
      ? "premium"
      : purchasedTier;

    setProfile((prev) =>
      prev ? { ...prev, subscriptionStatus: statusAfter } : prev
    );

    navigation.goBack();
    setTimeout(() => {
      navigation.navigate(purchasedTier === "business" ? "BusinessWelcome" : "PremiumWelcome");
    }, 100);
  };

  const handleRestore = async () => {
    logEvent("paywall_restore_tapped", {});
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

  const hasAnyPackage = isBusinessPaywall
    ? (businessAnnualPackage || businessMonthlyPackage)
    : (premiumAnnualPackage || premiumMonthlyPackage);

  // GestureHandlerRootView wrap on every return path. The Paywall is
  // presented as `presentation: "modal"` (iOS sheet) from RootNavigator,
  // and react-native-screens hosts modal contents in a separate native
  // window — outside the App.tsx root gesture context. Without a local
  // gesture root, dismissing the sheet leaves the underlying SwipeDeck's
  // pan/tap handlers in a stuck state (cards visible, swipes and taps
  // dead). Per the react-native-gesture-handler docs, every modal screen
  // needs its own root. The 350ms post-onboarding delay alone wasn't
  // enough to dodge this — the gesture context isolation is what fixes it.
  if (loading) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
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
      </GestureHandlerRootView>
    );
  }

  if (!hasAnyPackage) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
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
      </GestureHandlerRootView>
    );
  }

  const accent = isBusinessPaywall ? colors.brand.amber500 : colors.brand.traceRed;
  const periodSuffix = billingPeriod === "annual" ? "year" : "month";

  // Entry-point-aware hero messaging
  const heroContent = (() => {
    if (isBusinessPaywall) return {
      eyebrow: "TRACE BUSINESS",
      headline: "Fly business.\nPay economy.",
      sub: null,
    };
    switch (entryPoint) {
      case "swipe_daily_limit":
        return {
          eyebrow: "YOU'VE HIT YOUR LIMIT",
          headline: "Unlimited swipes,\nevery day",
          sub: null,
        };
      case "swipe_header_crown":
        return {
          eyebrow: "TRACE PREMIUM",
          headline: "Swipe without limits",
          sub: null,
        };
      case "explore_upgrade":
      case "deal_alert_match":
        return {
          eyebrow: "DEAL ALERTS",
          headline: "Get notified the\nmoment deals drop",
          sub: null,
        };
      case "fifth_save":
        return {
          eyebrow: "NICE TASTE",
          headline: "We'll watch these\ndeals for you",
          sub: null,
        };
      default:
        return {
          eyebrow: "TRACE PREMIUM",
          headline: "Unlock the full\nTrace experience",
          sub: null,
        };
    }
  })();

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
    <GestureHandlerRootView style={{ flex: 1 }}>
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

      <ScrollView contentContainerStyle={{ paddingBottom: 140 }} scrollEnabled={false}>
        {/* Compact header */}
        <View style={{ paddingHorizontal: 24, paddingTop: 56, paddingBottom: 20 }}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: accent, marginBottom: 6 }}>
            {heroContent.eyebrow}
          </Text>
          <Text style={{ fontSize: 26, fontWeight: "900", color: theme.foreground, lineHeight: 32 }}>
            {heroContent.headline}
          </Text>
        </View>

        {/* Free-trial callout — tappable CTA */}
        {hasFreeTrial && (
          <View style={{ paddingHorizontal: 24, marginBottom: 16 }}>
            <TouchableOpacity onPress={handlePurchase} disabled={purchasing} activeOpacity={0.85} style={{ borderRadius: 16, overflow: "hidden" }}>
              <LinearGradient
                colors={isBusinessPaywall
                  ? [colors.brand.amber400, colors.brand.orange500]
                  : [colors.brand.traceRed, colors.brand.tracePink]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ paddingVertical: 14, paddingHorizontal: 20, alignItems: "center" }}
              >
                {purchasing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={{ fontSize: 20, fontWeight: "900", color: "#fff" }}>
                      ✨ Try for Free
                    </Text>
                    <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", marginTop: 4, textAlign: "center" }}>
                      7 days free — cancel anytime
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* Billing period toggle */}
        <View style={{ paddingHorizontal: 24, marginBottom: 16 }}>
          <View style={{ flexDirection: "row", backgroundColor: theme.muted, borderRadius: 14, padding: 4 }}>
            {(["monthly", "annual"] as BillingPeriod[]).map((period) => (
              <TouchableOpacity
                key={period}
                onPress={() => setBillingPeriod(period)}
                activeOpacity={0.85}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 10,
                  alignItems: "center",
                  backgroundColor: billingPeriod === period ? theme.card : "transparent",
                  flexDirection: "row",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: "700", color: billingPeriod === period ? theme.foreground : theme.mutedForeground }}>
                  {period === "monthly" ? "Monthly" : "Annual"}
                </Text>
                {period === "annual" && annualSavings != null && (
                  <View style={{ backgroundColor: colors.brand.traceGreen, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                    <Text style={{ fontSize: 9, fontWeight: "800", color: "#fff" }}>SAVE {annualSavings}%</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Premium plan card */}
        {premiumDisplayPkg && (
          <View style={{ paddingHorizontal: 24, marginBottom: 24 }}>
            <View style={{ borderWidth: 2, borderColor: accent, borderRadius: 16, padding: 18, backgroundColor: theme.card }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <Text style={{ fontSize: 17, fontWeight: "800", color: theme.foreground }}>
                      {isBusinessPaywall ? "Business" : "Premium"}
                    </Text>
                    {(isBusinessPaywall ? hasBusiness : hasPremium) && (
                      <View style={{ backgroundColor: accent, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 9, fontWeight: "800", color: "#fff" }}>CURRENT PLAN</Text>
                      </View>
                    )}
                    {billingPeriod === "annual" && annualSavings != null && !(isBusinessPaywall ? hasBusiness : hasPremium) && (
                      <View style={{ backgroundColor: colors.brand.traceGreen, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 9, fontWeight: "800", color: "#fff" }}>{annualSavings}% OFF</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ fontSize: 13, color: theme.mutedForeground, marginTop: 2 }}>
                    {isBusinessPaywall ? "Business class deals + everything in Premium" : "Unlimited swipes & saves"}
                  </Text>
                  {hasFreeTrial && (
                    <Text style={{ fontSize: 11, fontWeight: "700", color: colors.brand.traceRed, marginTop: 4 }}>
                      ✨ Includes {trialLengthLabel} free trial
                    </Text>
                  )}
                  {billingPeriod === "annual" && (
                    <Text style={{ fontSize: 11, color: theme.mutedForeground, marginTop: 4 }}>
                      {getPerMonthFromAnnual(premiumDisplayPkg)} billed annually
                    </Text>
                  )}
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: theme.mutedForeground }}>
                    {premiumDisplayPkg.product.priceString}/{billingPeriod === "annual" ? "yr" : "mo"}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Features */}
        <View style={{ paddingHorizontal: 24, marginBottom: 24 }}>
          <Text
            style={{
              fontSize: 12,
              fontWeight: "700",
              color: theme.mutedForeground,
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 12,
            }}
          >
            What's included
          </Text>
          {(() => {
            if (isBusinessPaywall) return [
              { icon: Crown, title: "Business class deals — lie-flat at economy prices" },
              { icon: Clock, title: "48-hour early access before anyone else" },
              { icon: Sparkles, title: "Everything in Premium" },
            ];
            let features = [
              { icon: Zap, title: "Unlimited swipes — no daily cap" },
              { icon: TrendingDown, title: "Unlimited saves" },
              { icon: Bell, title: "Deal alerts for any destination" },
              { icon: Users, title: "Full Explore access" },
            ];
            if (entryPoint === "explore_upgrade" || entryPoint === "deal_alert_match") {
              const alerts = features.find((f) => f.title.startsWith("Deal alerts"))!;
              features = [alerts, ...features.filter((f) => !f.title.startsWith("Deal alerts"))];
            }
            return features;
          })().map((f, i) => (
            <View
              key={i}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 }}
            >
              <f.icon color={accent} size={18} />
              <Text style={{ fontSize: 15, color: theme.foreground, flex: 1 }}>
                {f.title}
              </Text>
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
            <Text style={{ color: accent, fontWeight: "700" }}>
              Restore
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
        <Text style={{ textAlign: "center", fontSize: 12, color: theme.mutedForeground, marginBottom: 10 }}>
          ✈️ Join 30,000+ travelers finding cheap flights
        </Text>
        {(() => {
          let ctaLabel: string;
          if (subscribeDisabled) {
            ctaLabel = isBusinessPaywall ? "You're already on Business" : "You're already on Premium";
          } else if (hasFreeTrial) {
            ctaLabel = `Start ${trialLengthLabel} free trial`;
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
                  colors={isBusinessPaywall
                    ? [colors.brand.amber400, colors.brand.orange500]
                    : [colors.brand.traceRed, colors.brand.tracePink]}
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
              {hasFreeTrial && (
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
    </GestureHandlerRootView>
  );
}
