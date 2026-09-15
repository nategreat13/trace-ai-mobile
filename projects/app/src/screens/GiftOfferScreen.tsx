import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
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
import Animated, {
  FadeIn,
  FadeInDown,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { X, Gift } from "lucide-react-native";
import type { PurchasesPackage } from "react-native-purchases";
import { colors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";
import { useProfile } from "../hooks/useProfile";
import { useIAP } from "../hooks/useIAP";
import { hasEntitlement } from "../services/iap";
import { formatTrialDuration, trialsEnabledByRemote } from "../lib/trial";
import { logEvent } from "../lib/analytics";
import Confetti from "../components/Confetti";
import type { RootStackParamList } from "../navigation/types";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const PRIVACY_URL = "https://subscribe.tracetravel.co/privacy";
const TERMS_URL = "https://subscribe.tracetravel.co/terms";

/**
 * Product-id fragments that mark a discounted win-back SKU in the current
 * RevenueCat offering. Matching is substring-based so Android's base-plan
 * suffix (`…_gift:premium-annual-gift`) still resolves.
 */
const DISCOUNT_MARKERS = ["gift", "winback", "discount"];

/**
 * The win-back offer, shown once when someone dismisses the paywall.
 *
 * Structure is deliberately two-beat — a wrapped gift, then the reveal —
 * because the discount lands harder as a payoff than as a number on arrival.
 *
 * **On honesty about the discount:** this screen shows a percentage ONLY when
 * RevenueCat actually carries a discounted annual SKU. With no such SKU
 * configured it degrades to the standard annual package and presents the free
 * trial as the gift, with no percentage anywhere. A fabricated "83% off"
 * against a price we never charged is exactly the kind of claim that costs an
 * App Store listing, and it is not worth a few points of conversion.
 */
export default function GiftOfferScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, "GiftOffer">>();
  const fromEntryPoint = route.params?.fromEntryPoint ?? "unknown";

  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;
  const { profile, setProfile } = useAuth();
  const { updateProfile } = useProfile();
  const {
    offerings,
    premiumAnnualPackage,
    premiumMonthlyPackage,
    isTrialEligibleFor,
    loading,
    purchasing,
    error,
    purchase,
  } = useIAP();

  const [opened, setOpened] = useState(false);

  // Idle wobble on the unopened box — small, slow, and stopped the moment it
  // is opened, so it reads as "tap me" rather than as decoration.
  const tilt = useSharedValue(0);
  React.useEffect(() => {
    if (opened) return;
    tilt.value = withRepeat(
      withSequence(
        withTiming(-0.045, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.045, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      true,
    );
  }, [opened]);
  const boxStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${tilt.value}rad` }],
  }));

  /**
   * Resolve the offer. Prefer a real discounted annual SKU; fall back to the
   * standard annual package so the screen still functions before Nate has
   * configured one in RevenueCat.
   */
  const { offerPkg, standardPkg, percentOff } = useMemo(() => {
    const all = offerings?.current?.availablePackages ?? [];
    const discounted =
      all.find((p) => {
        const id = p.product.identifier.toLowerCase();
        return (
          id.includes("annual") && DISCOUNT_MARKERS.some((m) => id.includes(m))
        );
      }) ?? null;

    const standard = premiumAnnualPackage;

    // The headline percentage is computed against TWELVE MONTHS OF MONTHLY —
    // the same basis `computeAnnualSavings` uses on the paywall.
    //
    // This matters more than it looks. Measured against the standard annual
    // instead, this offer reads as "25% OFF" arriving directly after a
    // paywall that just said "SAVE 60%", so the gift would look like a
    // downgrade. Same basis on both screens keeps the ladder monotonic
    // (60% → 70%), and the struck-through annual price below still gives the
    // concrete before/after.
    // Still gated on a real discounted SKU existing: without one this is
    // simply the standard annual offer, and dressing it up as a gift with a
    // percentage it shares with the paywall would be a gift in name only.
    const monthly = premiumMonthlyPackage?.product.price ?? 0;
    let pct: number | null = null;
    if (discounted && monthly > 0) {
      const fullYear = monthly * 12;
      const to = discounted.product.price;
      if (to > 0 && to < fullYear) {
        pct = Math.round(((fullYear - to) / fullYear) * 100);
      }
    }
    return {
      offerPkg: discounted ?? standard,
      standardPkg: discounted ? standard : null,
      percentOff: pct,
    };
  }, [offerings, premiumAnnualPackage, premiumMonthlyPackage]);

  const introPrice = offerPkg?.product.introPrice ?? null;
  const hasFreeTrial =
    trialsEnabledByRemote(offerings?.current) &&
    isTrialEligibleFor(offerPkg?.product.identifier) &&
    !!introPrice &&
    introPrice.price === 0;
  const trialDurationLabel = introPrice ? formatTrialDuration(introPrice) : "";

  const markShown = () => {
    // Optimistic so a remount can't re-offer the gift before the write lands.
    setProfile((prev) => (prev ? { ...prev, giftOfferShown: true } : prev));
    updateProfile({ giftOfferShown: true }).catch(() => {});
  };

  const handleOpen = () => {
    // Two-stage: a heavy thud on the tap itself, then the success burst ~150ms
    // later as the confetti erupts. One notification haptic alone read as a
    // tick; this reads as the box actually opening.
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    setTimeout(() => {
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => {});
    }, 150);
    setOpened(true);
    markShown();
    logEvent("gift_offer_opened", {
      from_entry_point: fromEntryPoint,
      percent_off: percentOff,
      has_discount_sku: !!standardPkg,
    });
  };

  const handleClose = () => {
    markShown();
    logEvent("gift_offer_dismissed", {
      from_entry_point: fromEntryPoint,
      opened,
    });
    navigation.goBack();
  };

  const handleClaim = async () => {
    if (!offerPkg) return;
    logEvent("gift_offer_cta_tapped", {
      from_entry_point: fromEntryPoint,
      product_id: offerPkg.product.identifier,
      percent_off: percentOff,
    });
    const info = await purchase(offerPkg as PurchasesPackage, {
      tier: "premium",
      billing: "annual",
      entryPoint: "gift_offer",
    });
    if (!info) return;

    const nowBusiness = hasEntitlement(info, "business");
    setProfile((prev) =>
      prev
        ? { ...prev, subscriptionStatus: nowBusiness ? "business" : "premium" }
        : prev,
    );
    navigation.goBack();
    setTimeout(() => navigation.navigate("PremiumWelcome"), 100);
  };

  if (loading || !offerPkg) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaView
          style={{
            flex: 1,
            backgroundColor: theme.background,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ActivityIndicator size="large" color={colors.brand.traceRed} />
        </SafeAreaView>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <TouchableOpacity
          onPress={handleClose}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={{
            marginTop: 4,
            marginLeft: 16,
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: theme.muted,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <X color={theme.foreground} size={22} />
        </TouchableOpacity>

        <View style={{ flex: 1, paddingHorizontal: 28, justifyContent: "center" }}>
          {!opened ? (
            <Animated.View entering={FadeIn.duration(400)} style={{ alignItems: "center" }}>
              <Text
                style={{
                  color: theme.foreground,
                  fontSize: 32,
                  fontWeight: "800",
                  textAlign: "center",
                  letterSpacing: -0.7,
                  lineHeight: 38,
                }}
              >
                Wait — we have{"\n"}a gift for you
              </Text>
              <Text
                style={{
                  color: theme.mutedForeground,
                  fontSize: 16,
                  textAlign: "center",
                  marginTop: 12,
                  lineHeight: 23,
                }}
              >
                Open it to see your exclusive offer.
              </Text>

              {/* The box IS the button. A separate "Open now" bar underneath
                  competed with the object the copy tells you to open, and
                  people reached for the box first anyway. */}
              <Animated.View style={[{ marginVertical: 46 }, boxStyle]}>
                <TouchableOpacity
                  onPress={handleOpen}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Open your gift"
                >
                  <LinearGradient
                    colors={[colors.brand.traceRed, colors.brand.tracePink]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      width: 172,
                      height: 172,
                      borderRadius: 34,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Gift size={84} color="#ffffff" strokeWidth={1.6} />
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>

              <Text
                style={{
                  color: theme.mutedForeground,
                  fontSize: 15,
                  fontWeight: "600",
                }}
              >
                Tap to open
              </Text>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeIn.duration(420)} style={{ alignItems: "center" }}>
              <Text
                style={{
                  color: theme.foreground,
                  fontSize: 32,
                  fontWeight: "800",
                  textAlign: "center",
                  letterSpacing: -0.7,
                }}
              >
                Your special offer
              </Text>

              {/* Tapping the offer itself claims it — the card is the thing
                  they're looking at, so it should be the thing that works. */}
              <Animated.View
                entering={ZoomIn.duration(480).delay(120)}
                style={{ width: "100%", marginTop: 30 }}
              >
              <TouchableOpacity
                onPress={handleClaim}
                disabled={purchasing}
                activeOpacity={0.9}
                accessibilityRole="button"
                accessibilityLabel="Claim this offer"
                style={{
                  borderRadius: 24,
                  borderWidth: 2,
                  borderColor: colors.brand.traceRed,
                  backgroundColor: colors.brand.traceRed + "0D",
                  paddingVertical: 34,
                  paddingHorizontal: 20,
                  alignItems: "center",
                }}
              >
                {percentOff != null ? (
                  <>
                    <Text
                      style={{
                        color: colors.brand.traceRed,
                        fontSize: 54,
                        fontWeight: "800",
                        letterSpacing: -2,
                      }}
                    >
                      {percentOff}% OFF
                    </Text>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                        marginTop: 14,
                      }}
                    >
                      {!!standardPkg && (
                        <Text
                          style={{
                            color: theme.mutedForeground,
                            fontSize: 20,
                            fontWeight: "700",
                            textDecorationLine: "line-through",
                          }}
                        >
                          {standardPkg.product.priceString}
                        </Text>
                      )}
                      <Text
                        style={{
                          color: theme.foreground,
                          fontSize: 24,
                          fontWeight: "800",
                        }}
                      >
                        {offerPkg.product.priceString}/year
                      </Text>
                    </View>
                  </>
                ) : (
                  /* No discounted SKU configured — present the trial as the
                     gift rather than inventing a percentage. */
                  <>
                    <Text
                      style={{
                        color: colors.brand.traceRed,
                        fontSize: 40,
                        fontWeight: "800",
                        letterSpacing: -1.4,
                        textAlign: "center",
                      }}
                    >
                      {hasFreeTrial ? `${trialDurationLabel} free` : "A full year"}
                    </Text>
                    <Text
                      style={{
                        color: theme.foreground,
                        fontSize: 22,
                        fontWeight: "800",
                        marginTop: 12,
                      }}
                    >
                      {offerPkg.product.priceString}/year
                    </Text>
                  </>
                )}
                <Text
                  style={{
                    color: theme.mutedForeground,
                    fontSize: 14,
                    marginTop: 14,
                    textAlign: "center",
                    lineHeight: 20,
                  }}
                >
                  Every destination unlocked, alerts on every route you care
                  about.
                </Text>
              </TouchableOpacity>
              </Animated.View>

              {!!error && (
                <Text
                  style={{
                    color: colors.brand.rose500,
                    fontSize: 13,
                    textAlign: "center",
                    marginTop: 14,
                  }}
                >
                  {error}
                </Text>
              )}
            </Animated.View>
          )}
        </View>

        {/* Rendered in both states. Before opening, the button opens the box
            — the box is still the hero and still tappable, but a visible CTA
            at the bottom is where a thumb goes by habit, and a screen with
            no button at the bottom reads as a dead end to some people. */}
        <Animated.View
          entering={FadeInDown.duration(360)}
          style={{
            paddingHorizontal: 24,
            paddingTop: 12,
            paddingBottom: 16,
            borderTopWidth: 1,
            borderTopColor: theme.border,
          }}
        >
          <TouchableOpacity
            onPress={opened ? handleClaim : handleOpen}
            disabled={purchasing}
            activeOpacity={0.9}
            accessibilityRole="button"
            style={{ opacity: purchasing ? 0.6 : 1 }}
          >
            <LinearGradient
              colors={[colors.brand.traceRed, colors.brand.tracePink]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                borderRadius: 12,
                paddingVertical: 18,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {purchasing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: "#fff", fontSize: 17, fontWeight: "800" }}>
                  {!opened
                    ? "Open your gift"
                    : hasFreeTrial
                      ? `Try Free for ${trialDurationLabel}`
                      : "Claim this offer"}
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {opened && (
            <>
              <Text
                style={{
                  textAlign: "center",
                  fontSize: 12,
                  color: theme.mutedForeground,
                  marginTop: 10,
                }}
              >
                {hasFreeTrial
                  ? `${trialDurationLabel} free, then ${offerPkg.product.priceString} per year. Cancel anytime.`
                  : `${offerPkg.product.priceString} per year. Cancel anytime.`}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "center",
                  gap: 16,
                  marginTop: 12,
                }}
              >
                <TouchableOpacity onPress={() => Linking.openURL(TERMS_URL)}>
                  <Text style={{ color: theme.mutedForeground, fontSize: 12 }}>
                    Terms
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_URL)}>
                  <Text style={{ color: theme.mutedForeground, fontSize: 12 }}>
                    Privacy
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </Animated.View>

        <Confetti active={opened} originY={0.42} />
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}
