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
import * as Haptics from "expo-haptics";
import { X, Mail } from "lucide-react-native";
import type { PurchasesPackage } from "react-native-purchases";
import { colors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";
import { useIAP } from "../hooks/useIAP";
import { hasEntitlement } from "../services/iap";
import { logout } from "../services/auth";
import {
  formatTrialLength,
  formatTrialDuration,
  trialsEnabledByRemote,
} from "../lib/trial";
import { logEvent } from "../lib/analytics";
import { giftOfferEligible } from "../lib/giftOffer";
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
  const personalizedSub = route.params?.personalizedSub ?? null;
  const lockedStat = route.params?.lockedStat ?? null;
  // The post-onboarding paywall is the one view the user didn't ask for. It
  // gets a de-emphasized (never hidden) close affordance — see the close
  // button below.
  const isForcedView = entryPoint === "post_onboarding";
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
    isTrialEligibleFor,
    loading,
    purchasing,
    error,
    purchase,
    restore,
  } = useIAP();

  const currentTier = profile?.subscriptionStatus;
  const hasPremium = currentTier === "premium" || currentTier === "business";
  const hasBusiness = currentTier === "business";

  // Default to ANNUAL (Sept 2026).
  //
  // This was monthly, because the annual *sticker price* was the leading
  // suspect for abandoned purchase sheets. That diagnosis was right and the
  // fix was wrong: the plan wasn't the problem, showing a year-sized number
  // was. The annual card below now leads with its per-month equivalent and
  // states the billed-annually total underneath, which removes the shock
  // without giving up the twelve months of revenue.
  //
  // It matters more than a default usually would: at current retention a
  // monthly subscriber churns inside a couple of cycles, so an annual
  // conversion is worth several times a monthly one.
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("annual");

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
  // Eligibility is checked for THIS product, not globally. App Store intro
  // offers are scoped to a subscription group, so a user who already used the
  // Premium trial stays eligible for Business — and the previous global flag
  // would have let the Premium paywall promise a trial that Apple then charges
  // for. `introPrice` alone doesn't catch it: the product carries the offer
  // regardless of whether this particular user can still claim it.
  //
  // NOTE: this block (and the useRef/useEffect below) MUST stay above the
  // `if (loading)` / `if (!hasAnyPackage)` early returns further down —
  // hooks cannot run conditionally or React will throw on the loading→ready
  // transition.
  const introPrice = selectedPkg?.product.introPrice ?? null;
  const hasFreeTrial =
    trialsEnabledByRemote(offerings?.current) &&
    isTrialEligibleFor(selectedPkg?.product.identifier) &&
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
    // The moment before the App Store sheet. A medium tap here, then the
    // sheet — makes the CTA feel like it did something before the OS takes
    // over, which otherwise has a dead half-second.
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    // entry_point is stamped on both of these (as it already was on
    // paywall_viewed and trial_offer_shown) so the funnel can be read per
    // surface. Without it, every CTA tap and purchase we have ever recorded is
    // unattributable — we could see which paywalls got *shown* but never which
    // ones actually earned money, which is exactly the question that decides
    // where the paywall should fire.
    logEvent("paywall_cta_tapped", {
      tier: isBusinessPaywall ? "business" : "premium",
      billing: billingPeriod,
      product_id: selectedPkg.product.identifier,
      is_trial: hasFreeTrial,
      trial_length: hasFreeTrial ? trialLengthLabel : null,
      entry_point: entryPoint,
    });
    logEvent("purchase_initiated", {
      tier: isBusinessPaywall ? "business" : "premium",
      billing: billingPeriod,
      product_id: selectedPkg.product.identifier,
      is_trial: hasFreeTrial,
      trial_length: hasFreeTrial ? trialLengthLabel : null,
      entry_point: entryPoint,
    });

    const purchasedTier = isBusinessPaywall ? "business" : "premium";
    const info = await purchase(selectedPkg, {
      tier: purchasedTier,
      billing: billingPeriod,
      entryPoint,
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
      case "swipe_header_crown":
        return {
          eyebrow: "TRACE PREMIUM",
          headline: "Never miss\na deal drop",
          sub: null,
        };
      case "explore_upgrade":
      case "deal_alert_match":
      case "swipe_upsell_premium":
        return {
          eyebrow: "DEAL ALERTS",
          headline: "Get notified the\nmoment deals drop",
          sub: null,
        };
      // Arrived by tapping a locked pin on the Explore map — they're
      // looking at a specific place they want, so name that intent
      // rather than pitching alerts generically.
      case "explore_map_locked_pin":
        return {
          eyebrow: "LOCKED DESTINATION",
          headline: "Unlock every\ndeal on the map",
          sub: null,
        };
      // Arrived by tapping Book Now on a deal — the single highest
      // purchase-intent moment in the app. Name the exact fear (missing
      // this fare) instead of the generic alerts pitch.
      case "book_now_intent":
        return {
          eyebrow: "DON'T MISS IT",
          headline: "Get alerted if this\nprice comes back",
          sub: null,
        };
      // Hit the daily swipe cap — name the real, specific thing that just
      // happened rather than a generic pitch. The limit screen already told
      // them the number; no need to repeat it here.
      case "daily_swipe_cap":
        return {
          eyebrow: "TODAY'S LIMIT",
          headline: "Keep swiping.\nNo daily limit.",
          sub: null,
        };
      // From the in-deck assistant card — they were about to name a place.
      case "assistant_card":
        return {
          eyebrow: "TELL US WHERE",
          headline: "Name it. We'll\nwatch it for you.",
          sub: null,
        };
      // Tapped the blurred packing/climate rows on a deal.
      case "weather_pack_locked":
        return {
          eyebrow: "TRIP PREP",
          headline: "Know what to pack\nbefore you go",
          sub: null,
        };
      // Came from a Strong Match on a deal they were already reading. The
      // pitch is more of the same, not the feature list.
      case "ai_fit_strong_match":
        return {
          eyebrow: "STRONG MATCH",
          headline: "See every deal\nbuilt for you",
          sub: null,
        };
      // Reached for filters on the Explore list. They're trying to narrow to
      // what they actually want, so name that rather than the feature.
      case "explore_filters_locked":
        return {
          eyebrow: "FILTERS",
          headline: "Search for exactly\nwhat you want",
          sub: null,
        };
      // Reached for search or sort on their own saved list. They already have
      // a collection worth organising, so pitch control of it, not discovery.
      case "saved_search_locked":
      case "saved_sort_locked":
        return {
          eyebrow: "YOUR SAVED TRIPS",
          headline: "Find any trip\nyou've saved",
          sub: null,
        };
      // Tapped the locked Destination tab on a deal — they want the guide for
      // that specific place, so lead with the guide rather than alerts.
      case "deal_destination_locked":
        return {
          eyebrow: "DESTINATION GUIDES",
          headline: "Know where to stay\nbefore you book",
          sub: null,
        };
      // Opened a deal from the gated feed and reached for Book / Save, or
      // tapped a locked row. They have a specific fare in mind now, so name
      // that rather than the feature list.
      case "gated_deal_book":
        return {
          eyebrow: "READY TO BOOK?",
          headline: "Unlock this fare\nand every one after it",
          sub: null,
        };
      case "gated_deal_save":
        return {
          eyebrow: "SAVE IT FOR LATER",
          headline: "Keep this deal.\nGet told when it drops.",
          sub: null,
        };
      case "gated_deal_locked":
        return {
          eyebrow: "LOCKED DESTINATION",
          headline: "See the price on\nevery route we track",
          sub: null,
        };
      // Forced view after onboarding. They haven't used the app yet, so
      // there's no earned context to lean on — lead with the promise.
      case "post_onboarding":
        return {
          eyebrow: "START FREE",
          headline: "Cheap flights find\nyou from now on",
          sub: null,
        };
      default:
        return {
          eyebrow: "TRACE PREMIUM",
          headline: "Unlock the full\nTrace experience",
          sub: null,
        };
    }
  })() as { eyebrow: string; headline: string; sub: string | null };
  // Computed, per-user sub line (e.g. "You've saved 3 trips under $500...")
  // takes priority over the entry point's static sub when present — every
  // static case above sets sub: null today, so this is the only source of
  // hero sub-copy in practice.
  if (personalizedSub) heroContent.sub = personalizedSub;

  // Price label + per-period label for the CTA
  const priceString = selectedPkg?.product.priceString ?? "";

  // Optional supporting line under a monthly annual card: "$X.XX/month billed annually"
  const getPerMonthFromAnnual = (pkg: PurchasesPackage | null): string | null => {
    if (!pkg) return null;
    const p = pkg.product.price;
    if (!p) return null;
    // Floor rather than round: 47.99/12 is 3.9992, which rounds to "$4.00"
    // and gives up the sub-$4 read over a tenth of a cent. The exact annual
    // total is printed directly beneath this on the same card, so nothing is
    // being hidden — only the per-month convenience figure is truncated.
    const perMonth = Math.floor((p / 12) * 100) / 100;
    // Format with currency symbol matching the product's pricing locale
    const localized = pkg.product.priceString;
    // Derive the symbol by stripping digits/decimals from localized price string
    const symbolMatch = localized.replace(/[0-9.,\s]/g, "").trim();
    const symbol = symbolMatch || "$";
    return `${symbol}${perMonth.toFixed(2)}/mo`;
  };

  /**
   * Leaving the paywall is the win-back moment, not the end of the funnel.
   *
   * The first dismissal routes to the gift offer instead of straight back —
   * these are people who have already said no, so anything recovered there is
   * incremental. It fires once per user (`giftOfferShown`); a discount that
   * reappears on every dismissal isn't a gift, it's just the price.
   */
  // When the paywall is the root of the stack there is nothing behind it —
  // this user is behind the subscription gate (see RootNavigator). The close
  // affordance is hidden in that state because it would be a dead control,
  // and Restore / Sign out take its place so a returning subscriber can
  // always recover and nobody is trapped in the app with no way out.
  const canDismiss = navigation.canGoBack();

  const handleDismiss = () => {
    logEvent("paywall_dismissed", { entry_point: entryPoint });
    const eligibleForGift =
      !isBusinessPaywall &&
      !hasPremium &&
      !subscribeDisabled &&
      giftOfferEligible(profile);
    if (eligibleForGift) {
      navigation.replace("GiftOffer", { fromEntryPoint: entryPoint });
      return;
    }
    navigation.goBack();
  };

  const annualPkg = isBusinessPaywall
    ? businessAnnualPackage
    : premiumAnnualPackage;
  const monthlyPkg = isBusinessPaywall
    ? businessMonthlyPackage
    : premiumMonthlyPackage;
  const annualPerMonth = getPerMonthFromAnnual(annualPkg);

  const ctaLabel = subscribeDisabled
    ? "You're subscribed"
    : hasFreeTrial
      ? `Try Free for ${trialDurationLabel}`
      : "Continue";

  /**
   * The value line, in the user's own numbers where we have them.
   *
   * This replaced a four-row feature list ("Every destination on the map,
   * unlocked", and so on). Generic feature lists are the weakest thing that
   * can occupy the most valuable space on a paywall — every one of those rows
   * could belong to any travel app. "Unlock all 104 deals from SLC" is the
   * same promise in the user's own terms, in one line instead of four, and it
   * frees the space the offer actually needs.
   */
  const valueLine =
    lockedStat ??
    personalizedSub ??
    (profile?.homeAirport
      ? `Every deal from ${profile.homeAirport}, the moment prices drop.`
      : "Every deal from your airport, the moment prices drop.");

  /**
   * One screen, no scroll, in the order a decision actually gets made:
   * what you get -> what it costs -> how the trial runs -> go.
   *
   * The previous version had nine stacked blocks (eyebrow, headline, four
   * feature rows, two plan cards, a price row, a timeline, CTA, footnote,
   * legal) and pushed the timeline below the fold. A paywall that scrolls
   * asks the user to work for the offer.
   *
   * Annual is the hero and monthly is a text link rather than an equal card.
   * Two matched cards frame the choice as 50/50; at current retention a
   * monthly subscriber churns inside a couple of cycles, so an annual
   * conversion is worth several times a monthly one and the layout should
   * say so.
   */
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <TouchableOpacity
          onPress={handleDismiss}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={{
            marginTop: 4,
            marginLeft: 16,
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: isForcedView ? "transparent" : theme.muted,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <X color={isForcedView ? theme.mutedForeground : theme.foreground} size={22} />
        </TouchableOpacity>

        <View style={{ flex: 1, paddingHorizontal: 24, justifyContent: "center", gap: 20 }}>
          {/* 1 — what you get, in their numbers */}
          <View style={{ gap: 8 }}>
            <Text
              style={{
                color: theme.foreground,
                fontSize: 32,
                fontWeight: "800",
                letterSpacing: -0.8,
                lineHeight: 37,
              }}
            >
              {heroContent.headline}
            </Text>
            <Text style={{ color: theme.mutedForeground, fontSize: 16, lineHeight: 22 }}>
              {valueLine}
            </Text>
          </View>

          {/* 2 — the offer, as one block.
                 A previous pass had the annual card and a separate
                 "$0 today / $47.99 after" row, which printed both numbers
                 twice on one screen. The zero is the most persuasive fact
                 here, so it leads, and everything else is the sentence
                 underneath it. */}
          {!!annualPkg && (
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setBillingPeriod("annual");
              }}
              activeOpacity={0.9}
              accessibilityRole="radio"
              accessibilityState={{ selected: billingPeriod === "annual" }}
              style={{
                borderWidth: 2,
                borderColor: billingPeriod === "annual" ? accent : theme.border,
                backgroundColor: billingPeriod === "annual" ? accent + "0F" : theme.card,
                borderRadius: 18,
                paddingHorizontal: 18,
                paddingVertical: 20,
              }}
            >
              {annualSavings != null && billingPeriod === "annual" && (
                <View
                  style={{
                    position: "absolute",
                    top: -11,
                    left: 18,
                    backgroundColor: accent,
                    borderRadius: 999,
                    paddingHorizontal: 10,
                    paddingVertical: 3,
                  }}
                >
                  <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>
                    SAVE {annualSavings}%
                  </Text>
                </View>
              )}

              {hasFreeTrial ? (
                <>
                  <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10 }}>
                    <Text
                      style={{
                        color: colors.brand.traceGreen,
                        fontSize: 40,
                        fontWeight: "800",
                        letterSpacing: -1.4,
                      }}
                    >
                      $0
                    </Text>
                    <Text
                      style={{
                        color: theme.foreground,
                        fontSize: 17,
                        fontWeight: "700",
                        paddingBottom: 7,
                      }}
                    >
                      due today
                    </Text>
                  </View>
                  <Text
                    style={{
                      color: theme.mutedForeground,
                      fontSize: 14.5,
                      lineHeight: 20,
                      marginTop: 6,
                    }}
                  >
                    Then{" "}
                    <Text style={{ color: theme.foreground, fontWeight: "700" }}>
                      {annualPerMonth ?? selectedPkg?.product.priceString}
                    </Text>{" "}
                    — {priceString} billed {billingPeriod === "annual" ? "annually" : "monthly"} after your{" "}
                    {trialLengthLabel} trial. Cancel anytime.
                  </Text>
                </>
              ) : (
                <>
                  <Text
                    style={{
                      color: theme.foreground,
                      fontSize: 34,
                      fontWeight: "800",
                      letterSpacing: -1,
                    }}
                  >
                    {annualPerMonth ?? annualPkg.product.priceString}
                  </Text>
                  <Text style={{ color: theme.mutedForeground, fontSize: 14, marginTop: 4 }}>
                    {annualPkg.product.priceString} billed annually · cancel anytime
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Monthly stays available, deliberately quiet. */}
          {!!monthlyPkg && (
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setBillingPeriod("monthly");
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="radio"
              accessibilityState={{ selected: billingPeriod === "monthly" }}
              style={{ alignSelf: "center" }}
            >
              <Text
                style={{
                  color: billingPeriod === "monthly" ? theme.foreground : theme.mutedForeground,
                  fontSize: 14,
                  fontWeight: billingPeriod === "monthly" ? "800" : "600",
                  textDecorationLine: billingPeriod === "monthly" ? "none" : "underline",
                }}
              >
                {billingPeriod === "monthly"
                  ? `Monthly selected — ${monthlyPkg.product.priceString}/mo`
                  : `or pay monthly — ${monthlyPkg.product.priceString}/mo`}
              </Text>
            </TouchableOpacity>
          )}

          {/* The whole three-step timeline compressed to the one line that
              carries its weight: the reminder is what removes the fear of
              being charged unawares. */}
          {hasFreeTrial && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 9,
                alignSelf: "center",
              }}
            >
              <Mail size={15} color={theme.mutedForeground} />
              <Text style={{ color: theme.mutedForeground, fontSize: 13.5 }}>
                We'll email you before it renews
              </Text>
            </View>
          )}

          {!!error && (
            <Text
              style={{
                color: colors.brand.rose500,
                fontSize: 13,
                textAlign: "center",
              }}
            >
              {error}
            </Text>
          )}
        </View>

        {/* 4 — go */}
        <View style={{ paddingHorizontal: 24, paddingTop: 10, paddingBottom: 16, gap: 10 }}>
          <TouchableOpacity
            onPress={handlePurchase}
            disabled={purchasing || subscribeDisabled || !selectedPkg}
            activeOpacity={0.9}
            accessibilityRole="button"
            style={{ opacity: purchasing || subscribeDisabled ? 0.6 : 1 }}
          >
            <LinearGradient
              colors={[accent, colors.brand.tracePink]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                borderRadius: 14,
                paddingVertical: 18,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {purchasing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: "#fff", fontSize: 17.5, fontWeight: "800" }}>
                  {ctaLabel}
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <Text
            style={{
              textAlign: "center",
              fontSize: 12.5,
              color: theme.mutedForeground,
            }}
          >
            {hasFreeTrial
              ? "Apple will ask you to confirm. You won't be charged today."
              : `${priceString} per ${periodSuffix}. Cancel anytime.`}
          </Text>

          <View
            style={{
              flexDirection: "row",
              justifyContent: "center",
              alignItems: "center",
              gap: 18,
            }}
          >
            <TouchableOpacity onPress={handleRestore} hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}>
              <Text style={{ color: theme.mutedForeground, fontSize: 12 }}>Restore</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => Linking.openURL(TERMS_URL)} hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}>
              <Text style={{ color: theme.mutedForeground, fontSize: 12 }}>Terms</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_URL)} hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}>
              <Text style={{ color: theme.mutedForeground, fontSize: 12 }}>Privacy</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}
