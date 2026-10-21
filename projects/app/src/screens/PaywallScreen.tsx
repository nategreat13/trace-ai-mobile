import React, { useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  useColorScheme,
  useWindowDimensions,
  Linking,
  Platform,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { logMetaFirstPaywallView } from "../lib/metaAppEvents";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { X, Check, MapPin, Lock } from "lucide-react-native";
import { Image } from "expo-image";
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
import { giftOfferEligible, recordPaywallDismissal } from "../lib/giftOffer";
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
  // Rounded ("100+") when the caller has one, so the paywall matches the
  // button that opened it.
  const destinationCount =
    route.params?.destinationCountLabel ?? route.params?.destinationCount ?? null;
  const lockedStat = route.params?.lockedStat ?? null;
  const tappedDeal = route.params?.deal ?? null;
  // The post-onboarding paywall is the one view the user didn't ask for. It
  // gets a de-emphasized (never hidden) close affordance — see the close
  // button below.
  const isForcedView = entryPoint === "post_onboarding";
  const isBusinessPaywall = tierParam === "business";
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;
  const { profile, setProfile } = useAuth();
  // Only users who reach the free app have a daily swipe limit to escape.
  const hasDailyLimit =
    !profile?.feedReadyPending &&
    profile?.accessGate !== "subscription_required";

  /**
   * This screen deliberately does not scroll — the whole offer is meant to be
   * takeable in one look, and a paywall that scrolls asks the user to work
   * for it. The cost of that choice is that overflow clips the CTA rather
   * than hiding copy, so the layout has to fit the shortest device we ship to.
   *
   * Budgeted against an iPhone SE (667pt tall, ~647 usable): the full layout
   * needs ~724pt with five benefit rows and ~668 with three. So short screens
   * get the three strongest rows and tighter type; everything from an iPhone
   * 13 up gets all five.
   */
  const { height: screenH } = useWindowDimensions();
  // A tapped-deal hero adds ~150pt, so the rest of the screen runs compact
  // whenever one is shown — otherwise the bottom of the offer and the close
  // button clip.
  const compact = screenH < 740 || !!route.params?.deal;

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
  // Default MONTHLY (Oct 2026). Third position this has held, so the history
  // is worth keeping straight:
  //   monthly → annual: the annual *sticker* was killing purchase sheets, and
  //     per-month framing fixed the presentation without losing the 12 months.
  //   annual → monthly: that framing change did NOT move trial starts
  //     ($79.99→$47.99 moved 3.2%→3.1%, i.e. nothing). Both were annual, so
  //     neither test ever touched the thing that might actually be the
  //     barrier — committing to a YEAR. 82% of people who reach this screen
  //     never tap the button; the bet is that a year-long commitment sitting
  //     under a free-trial button is why.
  // Annual stays one tap away and is genuinely cheaper per month, so the
  // people who already know they want it lose nothing.
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("monthly");

  // Monthly is the default, but if the store didn't return a monthly product
  // the screen would have no plan and a dead button while annual was still
  // buyable. Fall back to annual in that case.
  const monthlyAvailable = isBusinessPaywall ? businessMonthlyPackage : premiumMonthlyPackage;
  const annualAvailable = isBusinessPaywall ? businessAnnualPackage : premiumAnnualPackage;
  useEffect(() => {
    if (billingPeriod === "monthly" && !monthlyAvailable && annualAvailable) {
      setBillingPeriod("annual");
    }
  }, [billingPeriod, monthlyAvailable, annualAvailable]);

  useEffect(() => {
    // Same reason as the feed page's Meta event: count new-flow users only,
    // or every existing install fires "initiated checkout" once on update.
    if (profile?.feedReadyPending) logMetaFirstPaywallView(entryPoint ?? "unknown");
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

  const handleDismiss = async () => {
    // Counted before the check: the gift lands on the first close and every
    // second one after it, so the running total is what decides this, not the
    // profile's show budget.
    const dismissals = await recordPaywallDismissal();
    logEvent("paywall_dismissed", {
      entry_point: entryPoint,
      dismissal_count: dismissals,
    });
    const eligibleForGift =
      !isBusinessPaywall &&
      !hasPremium &&
      !subscribeDisabled &&
      giftOfferEligible(profile, { onDismiss: true, dismissalCount: dismissals });
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

  /**
   * "That one trip pays for N months of Trace" — the money math, done for
   * them, from the tapped deal's real fare against its usual fare. Only when
   * the numbers are sane and the claim is worth making (2+ months).
   */
  const tripPaysFor = (() => {
    const monthly = premiumMonthlyPackage?.product.price ?? 0;
    const was = tappedDeal?.originalPrice ?? 0;
    const now = tappedDeal?.price ?? 0;
    if (!tappedDeal || monthly <= 0 || now <= 0 || was <= now) return null;
    const saved = was - now;
    if (saved / was > 0.95) return null;
    const months = Math.floor(saved / monthly);
    if (months < 2) return null;
    const span =
      months >= 24
        ? `${Math.floor(months / 12)} years`
        : months >= 12
          ? "a year"
          : `${months} months`;
    return { saved: Math.round(saved), span };
  })();

  const ctaLabel = subscribeDisabled
    ? "You're subscribed"
    : hasFreeTrial
      ? tappedDeal
        ? `Unlock it free for ${trialDurationLabel}`
        : `Try Free for ${trialDurationLabel}`
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
    (tripPaysFor
      ? `This trip alone saves $${tripPaysFor.saved} — that's ${tripPaysFor.span} of Trace.`
      : null) ??
    lockedStat ??
    personalizedSub ??
    (profile?.homeAirport
      ? `Every deal from ${profile.homeAirport}, the moment prices drop.`
      : "Every deal from your airport, the moment prices drop.");

  /**
   * Three benefits, each naming something they have just watched get locked.
   *
   * An earlier pass deleted a four-row feature list, correctly: rows like
   * "Every destination on the map, unlocked" could belong to any travel app,
   * and they crowded out the offer. But deleting them left the opposite
   * problem — someone who has seen five deals and a column of padlocks does
   * not know what the padlocks are hiding, and Premium is nineteen different
   * gates, not one.
   *
   * The difference is specificity. "All 115 destinations from SLC" is their
   * number and their airport; it is an answer to a question they are actually
   * holding, which a generic feature name never is. Three rows, not four, so
   * the screen still fits without scrolling.
   */
  const benefits: string[] = isBusinessPaywall
    ? [
        "Business-class fares at economy prices",
        "Price alerts on the routes you save",
        "Every destination unlocked",
        "Unlimited swiping",
        "Travel guides for every city",
      ]
    : [
        // Ordered by what people pay for (Oct 2026, Trevor): every great
        // deal first — the daily limit is the free tier's real ceiling —
        // then instant alerts, then search/explore. Guides are a nice extra,
        // not a reason to subscribe, so they're last and drop off on short
        // screens (compact shows three).
        // "not just 5 a day" only for the pre-Sept free users who have that
        // limit; new users (no freemium) never saw one.
        destinationCount
          ? `All ${destinationCount} deals${hasDailyLimit ? ", not just 5 a day" : ` from ${profile?.homeAirport ?? "your airport"}`}`
          : hasDailyLimit
            ? "Every great deal, not just 5 a day"
            : "Every great deal from your airport",
        // NOT "alerts the moment any of them drops" — to someone who has
        // never used the product that promises a hundred notifications a
        // day. Alerts are opt-in per trip; the promise is control.
        "Instant alerts when your saved trips drop",
        "Search and explore every destination",
        "Travel guides for every city",
      ];

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

        <View
          style={{
            flex: 1,
            paddingHorizontal: 24,
            justifyContent: "center",
            gap: compact ? 12 : 16,
          }}
        >
          {/* 0 — the deal they tapped (Oct 2026). Photo, place, real
                 discount; the price is the one thing withheld, because it's
                 the thing the trial unlocks. */}
          {!!tappedDeal && !isBusinessPaywall && (
            <View
              style={{
                height: screenH < 740 ? 96 : 120,
                borderRadius: 18,
                overflow: "hidden",
                backgroundColor: theme.muted,
              }}
            >
              {!!tappedDeal.imageUrl && (
                <Image
                  source={{ uri: tappedDeal.imageUrl }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                />
              )}
              <LinearGradient
                colors={["rgba(0,0,0,0.05)", "rgba(0,0,0,0.75)"]}
                style={StyleSheet.absoluteFill}
              />
              <View
                style={{
                  position: "absolute",
                  left: 16,
                  right: 16,
                  bottom: 14,
                  flexDirection: "row",
                  alignItems: "flex-end",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <MapPin size={14} color="#fff" />
                    <Text
                      numberOfLines={1}
                      style={{ color: "#fff", fontSize: 22, fontWeight: "800", flexShrink: 1 }}
                    >
                      {tappedDeal.destination}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Lock size={14} color="rgba(255,255,255,0.9)" strokeWidth={2.5} />
                    <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 18, fontWeight: "800", letterSpacing: 2 }}>
                      $•••
                    </Text>
                  </View>
                </View>
                {!!tappedDeal.discountPct && tappedDeal.discountPct > 0 && (
                  <View
                    style={{
                      backgroundColor: colors.brand.traceGreen,
                      borderRadius: 999,
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                    }}
                  >
                    <Text style={{ color: "#fff", fontSize: 13, fontWeight: "800" }}>
                      {Math.round(tappedDeal.discountPct)}% off
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* 1 — what you get, in their numbers */}
          <View style={{ gap: 8 }}>
            <Text
              style={{
                color: theme.foreground,
                fontSize: compact ? 27 : 32,
                fontWeight: "800",
                letterSpacing: -0.8,
                lineHeight: compact ? 32 : 37,
              }}
            >
              {tappedDeal && !isBusinessPaywall
                ? `See the price.\nUnlock every deal.`
                : heroContent.headline}
            </Text>
            <Text style={{ color: theme.mutedForeground, fontSize: 16, lineHeight: 22 }}>
              {valueLine}
            </Text>
          </View>

          {/* 2 — what the padlocks were hiding.
                 Five rows, each deliberately short enough to hold one line:
                 this screen does not scroll, so every row has to earn its
                 height and none of them may wrap. */}
          <View style={{ gap: compact ? 7 : 9 }}>
            {(tappedDeal ? benefits.slice(0, 2) : compact ? benefits.slice(0, 3) : benefits).map((b) => (
              <View
                key={b}
                style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}
              >
                <Check
                  size={16}
                  color={accent}
                  strokeWidth={3}
                  style={{ marginTop: 2 }}
                />
                <Text
                  style={{
                    color: theme.foreground,
                    fontSize: compact ? 13.5 : 14.5,
                    lineHeight: compact ? 18 : 19,
                    flex: 1,
                    fontWeight: "500",
                  }}
                >
                  {b}
                </Text>
              </View>
            ))}
          </View>

          {/* 2 — the offer, as one block. The hero is the PRIMARY plan
                 (monthly); annual sits underneath as the value option.
                 A previous pass had the plan card and a separate
                 "$0 today / $X after" row, which printed both numbers twice
                 on one screen. The zero is the most persuasive fact here, so
                 it leads, and everything else is the sentence underneath. */}
          {/* 2 — the offer, as one block, for the ONE plan shown (Oct 2026:
                 one plan up front). Monthly by default; the yearly option is
                 a quiet text link under it that swaps what this card says.
                 Two plan cards made the first screen a comparison instead of
                 a decision. */}
          {!!selectedPkg && (
            <View
              style={{
                borderWidth: 2,
                borderColor: accent,
                backgroundColor: accent + "0F",
                borderRadius: 18,
                paddingHorizontal: 18,
                paddingVertical: compact ? 14 : 18,
              }}
            >
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
                      {priceString}/{periodSuffix}
                    </Text>{" "}
                    after your {trialLengthLabel} trial. Cancel before then and
                    pay nothing.
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
                    {priceString}
                    <Text style={{ fontSize: 20, fontWeight: "700" }}>
                      /{billingPeriod === "annual" ? "yr" : "mo"}
                    </Text>
                  </Text>
                  <Text style={{ color: theme.mutedForeground, fontSize: 14, marginTop: 4 }}>
                    Billed {billingPeriod === "annual" ? "yearly" : "monthly"} · cancel anytime
                  </Text>
                </>
              )}
            </View>
          )}

          {!!annualPkg && !!monthlyPkg && (
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setBillingPeriod(billingPeriod === "annual" ? "monthly" : "annual");
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ alignSelf: "center", paddingVertical: 2 }}
            >
              <Text style={{ color: theme.mutedForeground, fontSize: 13.5, fontWeight: "600" }}>
                {billingPeriod === "annual"
                  ? "Switch back to monthly"
                  : // Billed amount first: the stores want the price actually
                    // charged to be the prominent one, not the per-month figure.
                    `Or pay yearly — ${annualPkg.product.priceString}/yr${
                      annualPerMonth || annualSavings != null
                        ? ` (${[
                            annualPerMonth,
                            annualSavings != null ? `save ${annualSavings}%` : null,
                          ]
                            .filter(Boolean)
                            .join(", ")})`
                        : ""
                    }`}
              </Text>
            </TouchableOpacity>
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
              ? `$0 today. ${Platform.OS === "android" ? "Google Play" : "Apple"} will ask you to confirm.`
              : `${priceString} per ${periodSuffix}. Cancel anytime.`}
          </Text>

          {/* Social proof at the decision point. It lived only on an
              onboarding screen before, which is the one place it could not
              influence a purchase. The figure is Trace's web member base —
              the same product, a different front door — so the wording says
              "travelers", never "app users". Dropped under a deal hero,
              which needs the room. */}
          {!tappedDeal && (
            <Text
              style={{
                textAlign: "center",
                fontSize: 12.5,
                color: theme.mutedForeground,
                fontWeight: "600",
              }}
            >
              Join 30,000+ travelers using Trace
            </Text>
          )}

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
