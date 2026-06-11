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
import { X, Zap, TrendingDown, Clock, Users, Crown, Briefcase, Sparkles } from "lucide-react-native";
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
  const route = useRoute<RouteProp<RootStackParamList, "Paywall">>();
  const entryPoint = route.params?.entryPoint ?? "unknown";
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

  const currentTier = profile?.subscriptionStatus; // "free" | "trial" | "premium" | "business"
  const hasPremium = currentTier === "premium";
  const hasBusiness = currentTier === "business";

  const [selected, setSelected] = useState<Tier>(hasPremium ? "business" : "premium");
  // Default to MONTHLY (v1.3.3 cohort): the trial defaulted to annual, so
  // Apple's sheet showed "$X/year" to users who'd just signed up — every
  // purchase attempt was canceled there. A monthly trial shows a far smaller
  // commitment ($X/month) and is the standard trial-conversion default.
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("monthly");

  useEffect(() => {
    logEvent("paywall_viewed", {
      current_tier: currentTier ?? "free",
      entry_point: entryPoint,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Log `trial_offer_shown` once per paywall session, the first time a free
  // trial actually becomes offerable to this user. Trial eligibility resolves
  // asynchronously (offerings load + RevenueCat eligibility check), so this
  // can't be folded into the on-mount `paywall_viewed` event — it would
  // always read false there. This is the real top-of-funnel signal for the
  // trial flow ("of users shown a trial, how many started one?").
  const trialOfferLoggedRef = useRef(false);
  useEffect(() => {
    if (hasFreeTrial && !trialOfferLoggedRef.current) {
      trialOfferLoggedRef.current = true;
      logEvent("trial_offer_shown", {
        tier: selected,
        billing: billingPeriod,
        trial_length: trialLengthLabel,
        entry_point: entryPoint,
      });
    }
  }, [hasFreeTrial, selected, billingPeriod, trialLengthLabel, entryPoint]);

  const handlePurchase = async () => {
    if (!selectedPkg) return;

    logEvent("paywall_cta_tapped", {
      tier: selected,
      billing: billingPeriod,
      product_id: selectedPkg.product.identifier,
      is_trial: hasFreeTrial,
      trial_length: hasFreeTrial ? trialLengthLabel : null,
    });
    logEvent("purchase_initiated", {
      tier: selected,
      billing: billingPeriod,
      product_id: selectedPkg.product.identifier,
      is_trial: hasFreeTrial,
      trial_length: hasFreeTrial ? trialLengthLabel : null,
    });

    const info = await purchase(selectedPkg, {
      tier: selected,
      billing: billingPeriod,
    });
    if (!info) return;

    // Derive the welcome screen from the tier the user just bought, NOT from
    // their current entitlements. In sandbox (and occasionally production),
    // a user can hold a higher-tier entitlement from a prior subscription
    // that hasn't expired yet when they purchase a different tier, which
    // would otherwise send them to the wrong welcome screen.
    const purchasedTier: "premium" | "business" = selected;

    // Still use RC's CustomerInfo to decide whether to update the local
    // subscription status optimistically. If neither entitlement is active
    // (e.g. downgrade queued for end of period), prefer the higher of
    // current vs purchased tier so the UI doesn't regress.
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

    // Always navigate — purchase succeeded as far as Apple is concerned
    navigation.goBack();
    setTimeout(() => {
      navigation.navigate(
        purchasedTier === "business" ? "BusinessWelcome" : "PremiumWelcome"
      );
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

  const hasAnyPackage =
    premiumAnnualPackage ||
    premiumMonthlyPackage ||
    businessAnnualPackage ||
    businessMonthlyPackage;

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

        {/* Free-trial callout — prominent, above the fold */}
        {hasFreeTrial && (
          <View style={{ paddingHorizontal: 24, marginBottom: 16 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                backgroundColor:
                  scheme === "dark"
                    ? "rgba(244,63,94,0.14)"
                    : "rgba(244,63,94,0.08)",
                borderColor:
                  scheme === "dark"
                    ? "rgba(244,63,94,0.40)"
                    : "rgba(244,63,94,0.25)",
                borderWidth: 1,
                borderRadius: 16,
                padding: 16,
              }}
            >
              <Text style={{ fontSize: 24 }}>✨</Text>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "800",
                    color: theme.foreground,
                  }}
                >
                  Start your {trialLengthLabel} free trial
                </Text>
                <View style={{ marginTop: 4, gap: 1 }}>
                  {[
                    `Free for ${trialDurationLabel}`,
                    priceString ? `Then just ${priceString}/${periodSuffix}` : null,
                    "Cancel anytime, no charge",
                  ]
                    .filter((line): line is string => Boolean(line))
                    .map((line) => (
                      <Text
                        key={line}
                        style={{ fontSize: 12, color: theme.mutedForeground }}
                      >
                        {`•  ${line}`}
                      </Text>
                    ))}
                </View>
              </View>
            </View>
          </View>
        )}

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
                    {businessDisplayPkg?.product.priceString ?? ""}
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
