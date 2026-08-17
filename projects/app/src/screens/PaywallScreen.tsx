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
import { X, Bell, Users, Crown, Clock, Sparkles, Map, Search, Bookmark } from "lucide-react-native";
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
      {/* Close button.

          On the forced post-onboarding view this is deliberately de-emphasized
          — no filled chip, muted glyph — so the offer reads as the primary
          action rather than something to dismiss reflexively.

          What it deliberately is NOT: hidden, delayed, shrunk, or moved off
          the safe area. Apple rejects subscription screens without an obvious
          way out (a common 3.1.2 / HIG rejection), so the tap target stays a
          full 44pt via hitSlop and the glyph keeps real contrast. Lower
          visual weight is fine; hard to leave is not. */}
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel="Close"
        style={{
          position: "absolute",
          top: 56,
          right: 16,
          zIndex: 10,
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: isForcedView ? "transparent" : theme.muted,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <X color={isForcedView ? theme.mutedForeground : theme.foreground} size={20} />
      </TouchableOpacity>

      {/* Sizing intent: everything fits on one screen with no scrolling, so
          the CTA is always in view. The spacing below is tuned for that.

          Scrolling is nonetheless ENABLED, deliberately. It was hard-disabled
          before, and when this screen gained the locked-stat row and two more
          feature lines the last row and part of the CTA went off the bottom
          with no way to reach them — an unreachable buy button on the one
          screen that takes money. Scroll costs nothing when content fits (a
          ScrollView only scrolls on overflow) and saves small devices and
          large accessibility text sizes when it doesn't. Keep it enabled. */}
      <ScrollView
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Compact header. Top padding clears the absolutely-positioned close
            button at top:56 — don't drop it below ~52 or the eyebrow slides
            under the X. */}
        <View style={{ paddingHorizontal: 24, paddingTop: 54, paddingBottom: 14 }}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: accent, marginBottom: 6 }}>
            {heroContent.eyebrow}
          </Text>
          <Text style={{ fontSize: 26, fontWeight: "900", color: theme.foreground, lineHeight: 32 }}>
            {heroContent.headline}
          </Text>
          {!!heroContent.sub && (
            <Text style={{ fontSize: 14, color: theme.mutedForeground, marginTop: 8, lineHeight: 20 }}>
              {heroContent.sub}
            </Text>
          )}
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
                    {isBusinessPaywall ? "Business class deals + everything in Premium" : "Deal alerts, sent the moment they drop"}
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

        {/* Live "what you're missing right now" stat. Only rendered when the
            calling screen could compute one from data it already had — a
            concrete number ("5 of 340") is far harder to dismiss than a
            static bullet, and it's the user's own situation rather than a
            generic claim. */}
        {lockedStat && (
          <View style={{ paddingHorizontal: 24, marginBottom: 12 }}>
            <View
              style={{
                backgroundColor: accent + "14",
                borderColor: accent + "33",
                borderWidth: 1,
                borderRadius: 12,
                paddingVertical: 10,
                paddingHorizontal: 14,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
              }}
            >
              <Sparkles color={accent} size={16} />
              <Text style={{ fontSize: 14, fontWeight: "600", color: theme.foreground, flex: 1 }}>
                {lockedStat}
              </Text>
            </View>
          </View>
        )}

        {/* Features */}
        <View style={{ paddingHorizontal: 24, marginBottom: 16 }}>
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
            // Every line below maps to a real gate in the code. "Full Explore
            // access" used to stand in for three separate limits (map pins,
            // search/filters, save cap) and sold none of them — free users
            // couldn't tell what they were missing, so the offer read as two
            // vague bullets. Naming the actual limit next to the actual
            // unlock is the whole pitch.
            //   - map:    ExploreScreen mapDeals() unlocks 5 cheapest domestic
            //   - search: ExploreScreen listData() locks all filtered results
            //   - saves:  ExploreScreen handleSave() caps free at 3
            //   - alerts: 4-hour scheduled matching (shipped Aug 14)
            // Alerts is deliberately first. There used to be a reorder block
            // here that hoisted it for alert-driven entry points by matching
            // on `title.startsWith("Deal alerts")` — when the copy above was
            // rewritten, that string stopped matching, `.find()` returned
            // undefined, and a non-null assertion pushed `undefined` into the
            // array. Every alert-entry paywall then crashed on `f.icon`.
            // Ordering the source array correctly removes the failure mode
            // rather than re-fixing the string.
            // Named for the user's own airport where we have it — "every SLC
            // deal" is a concrete promise in a way "any route" isn't.
            //
            // ACCURACY NOTE: "in real time" overstates the mechanism. Alerts
            // run on a 4-hour scheduled match (runDealAlertMatching), so the
            // real worst case is a few hours, not real time. Trevor was told
            // this and chose the wording deliberately on 2026-08-16. Leaving
            // the note so nobody "fixes" the schedule to match the copy, and
            // so it's easy to find if App Review ever asks — subscription
            // descriptions are covered by guideline 3.1.2.
            const origin = profile?.homeAirport?.trim();
            return [
              {
                icon: Bell,
                title: origin
                  ? `Every ${origin} deal, in real time`
                  : "Every deal on your route, in real time",
              },
              { icon: Map, title: "Every destination on the map, unlocked" },
              { icon: Search, title: "Search and filter the full deal feed" },
              { icon: Bookmark, title: "Save unlimited trips" },
            ];
          })().map((f, i) => (
            <View
              key={i}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 }}
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
