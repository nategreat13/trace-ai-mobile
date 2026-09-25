import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Sparkles } from "lucide-react-native";
import { colors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";
import { useProfile } from "../hooks/useProfile";
import { fetchDeals } from "../services/dealsApi";
import { logout } from "../services/auth";
import { logEvent } from "../lib/analytics";
import { giftOfferEligible, giftOfferSeen } from "../lib/giftOffer";
import { Gift } from "lucide-react-native";
import FeedReveal, {
  selectRevealDeals,
} from "../components/onboarding/FeedReveal";
import { useIAP } from "../hooks/useIAP";
import { formatTrialDuration, trialsEnabledByRemote } from "../lib/trial";
import TraceLoader from "../components/TraceLoader";
import DealPeek from "../components/onboarding/DealPeek";
import { DEAL_TYPES, TIMEFRAMES, BARRIERS } from "../lib/constants";
import type { Deal } from "@trace/shared";
import type { RootStackParamList } from "../navigation/types";

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * What we say back to the barrier they named in onboarding.
 *
 * They were asked what's stopping them and then shown the answer as a chip
 * with no reply — a question left hanging. Each of these responds using data
 * already on screen, so the page argues with their actual objection rather
 * than pitching generically.
 */
function barrierAnswer(
  barrier: string,
  ctx: { avgDiscount: number; total: number; airport: string },
): string | null {
  switch (barrier) {
    case "prices_too_high":
      return ctx.avgDiscount > 0
        ? `You said flights cost too much — the ones below average ${ctx.avgDiscount}% off.`
        : null;
    case "bad_timing":
      return "You said you never know when to book. That's the job — we watch these and tell you the moment one drops.";
    case "no_time_to_search":
      return "You said you don't have time to search. You won't have to again — these update on their own.";
    case "dates_never_work":
      return "You said dates never line up. Everything below already matches the months you picked.";
    case "cant_decide":
      return ctx.total > 0
        ? `You said you can't decide where to go — here are ${ctx.total} options from ${ctx.airport}, cheapest first.`
        : null;
    default:
      return null;
  }
}

/** Look up the human label for a stored preference value. */
function labelFor(
  options: readonly { value: string; icon: string; label: string }[],
  value: string,
): { icon: string; label: string } | null {
  const hit = options.find((o) => o.value === value);
  return hit ? { icon: hit.icon, label: hit.label } : null;
}

/**
 * The home screen for users behind the subscription gate.
 *
 * This is where the funnel *rests* rather than where it ends. Someone who
 * declines the paywall and then declines the gift used to have nowhere to go;
 * now they land here — on the feed they built during onboarding, with their
 * own airport, their own destination count, and their own locked deals in
 * front of them. It is the last screen they can reach without subscribing,
 * and it keeps making the argument instead of showing them a dead end.
 *
 * It also owns the one-shot paywall push (via `postOnboardingPaywallShown`),
 * so the sequence after onboarding reads:
 *
 *     GatedHome → Paywall → (dismiss) → GiftOffer → (dismiss) → GatedHome
 *
 * Because Paywall and GiftOffer are pushed *on top of* this screen rather
 * than being roots themselves, both keep a working close affordance — which
 * is what makes the gift reachable at all.
 */
const styles = StyleSheet.create({
  freshPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
    marginBottom: 14,
  },
  freshText: { fontSize: 13, fontWeight: "700", flexShrink: 1 },
  giftPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    alignSelf: "flex-start",
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 12,
  },
  giftPillText: { fontSize: 13, fontWeight: "800" },
  answer: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
    marginBottom: 20,
  },
  savings: {
    borderWidth: 2,
    borderRadius: 18,
    padding: 18,
    marginTop: 20,
    gap: 6,
  },
  savingsBig: { fontSize: 19, fontWeight: "800", lineHeight: 26 },
  savingsSub: { fontSize: 14, fontWeight: "600" },
});

export default function GatedHomeScreen() {
  const navigation = useNavigation<Nav>();
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;
  const { profile, setProfile } = useAuth();
  const { updateProfile } = useProfile();
  const { offerings, premiumAnnualPackage, isTrialEligibleFor } = useIAP();

  // Same gate the paywall applies, so this button never promises a trial the
  // purchase sheet won't honour.
  const annualIntro = premiumAnnualPackage?.product.introPrice ?? null;
  const hasFreeTrial =
    trialsEnabledByRemote(offerings?.current) &&
    isTrialEligibleFor(premiumAnnualPackage?.product.identifier) &&
    !!annualIntro &&
    annualIntro.price === 0;
  const trialLabel = annualIntro ? formatTrialDuration(annualIntro) : "";

  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDeal, setExpandedDeal] = useState<Deal | null>(null);

  const airport = profile?.homeAirport ?? "";
  const firstName = (profile?.firstName || profile?.displayName || "").split(
    " ",
  )[0];

  useEffect(() => {
    logEvent("gated_home_viewed", { home_airport: airport || null });
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!airport) {
      setLoading(false);
      return;
    }
    fetchDeals(airport)
      .then((res) => {
        if (!cancelled) setDeals(res ?? []);
      })
      .catch(() => {
        if (!cancelled) setDeals([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [airport]);

  // One-shot paywall push, moved here from TabNavigator: gated users never
  // reach MainTabs, so the hook that used to do this can't fire for them.
  const firedRef = useRef(false);
  useEffect(() => {
    if (firedRef.current) return;
    if (!profile) return;
    if (profile.postOnboardingPaywallShown) return;
    firedRef.current = true;
    setProfile((prev) =>
      prev ? { ...prev, postOnboardingPaywallShown: true } : prev,
    );
    updateProfile({ postOnboardingPaywallShown: true }).catch(() => {});
    const t = setTimeout(
      () => navigation.navigate("Paywall", { entryPoint: "post_onboarding" }),
      450,
    );
    return () => clearTimeout(t);
  }, [profile?.id, profile?.postOnboardingPaywallShown]);

  // Return-visit re-offer. If they've seen the gift before, it's been 24h+,
  // and they're under the cap, push it again shortly after landing. Skipped
  // on the very first visit — that path goes paywall → gift on its own.
  const reofferRef = useRef(false);
  useEffect(() => {
    if (reofferRef.current || loading || !profile) return;
    if (profile.postOnboardingPaywallShown !== true) return; // first visit
    if (!giftOfferSeen(profile) || !giftOfferEligible(profile)) return;
    reofferRef.current = true;
    const t = setTimeout(
      () => navigation.navigate("GiftOffer", { fromEntryPoint: "gated_home_return" }),
      900,
    );
    return () => clearTimeout(t);
  }, [loading, profile?.id, profile?.giftOfferShowCount, profile?.giftOfferLastShownAt]);

  const showGiftPill = giftOfferSeen(profile) && giftOfferEligible(profile, { manual: true });

  // Everything the page says about "the deals below" is computed from the
  // SAME selection FeedReveal renders — see selectRevealDeals.
  const rankPrefs = useMemo(
    () => ({
      dealTypes: profile?.dealTypes,
      travelTimeframe: profile?.travelTimeframe,
      travelBarriers: profile?.travelBarriers,
    }),
    [profile?.dealTypes, profile?.travelTimeframe, profile?.travelBarriers],
  );

  const selection = useMemo(
    () =>
      selectRevealDeals(
        deals,
        profile?.destinationPreference ?? "both",
        rankPrefs,
      ),
    [deals, profile?.destinationPreference, rankPrefs],
  );

  /**
   * Total saved across the unlocked deals, versus the subscription price.
   *
   * Guarded rather than trusted: only deals whose original price is above the
   * fare and implies a sane discount are counted, so one bad `original_price`
   * from the API can't inflate the headline. If the numbers don't survive
   * that, the block simply doesn't render.
   */
  const savings = useMemo(() => {
    let total = 0;
    let counted = 0;
    for (const d of selection.unlocked) {
      const was = d.original_price || 0;
      const now = d.price || 0;
      if (was <= now || now <= 0) continue;
      const pct = ((was - now) / was) * 100;
      if (pct > 95) continue; // implausible anchor — skip it
      total += was - now;
      counted += 1;
    }
    return counted >= 3 ? { total: Math.round(total), counted } : null;
  }, [selection]);

  const avgDiscount = useMemo(() => {
    const vals = selection.unlocked
      .map((d) => d.discount_pct || 0)
      .filter((v) => v > 0 && v <= 95);
    if (!vals.length) return 0;
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  }, [selection]);

  const answer = useMemo(() => {
    for (const b of profile?.travelBarriers ?? []) {
      const line = barrierAnswer(b, {
        avgDiscount,
        total: selection.totalDestinations,
        airport,
      });
      if (line) return line;
    }
    return null;
  }, [profile?.travelBarriers, avgDiscount, selection.totalDestinations, airport]);

  // "New since you were last here", diffed against the destinations we showed
  // last time. Recorded after render so this visit becomes next visit's
  // baseline; nothing shows on a first visit, when there is no baseline.
  const [newCount, setNewCount] = useState(0);
  const seenRecordedRef = useRef(false);
  useEffect(() => {
    if (loading || seenRecordedRef.current) return;
    const current = [...new Set(deals.map((d) => d.destination).filter(Boolean))];
    if (!current.length) return;
    seenRecordedRef.current = true;
    const before = profile?.gatedHomeSeenDestinations;
    if (before?.length) {
      const prev = new Set(before);
      setNewCount(current.filter((d) => !prev.has(d)).length);
    }
    updateProfile({ gatedHomeSeenDestinations: current }).catch(() => {});
  }, [loading, deals, profile?.gatedHomeSeenDestinations]);

  const openPaywall = (entryPoint: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    navigation.navigate("Paywall", { entryPoint });
  };

  /**
   * The deal peek's one button goes to the paywall. The sheet closes first
   * so the paywall isn't pushed underneath an RN <Modal> that would sit on
   * top of it.
   */
  const upsellFromDeal = (entryPoint: string) => {
    setExpandedDeal(null);
    setTimeout(() => openPaywall(entryPoint), 120);
  };

  const prefChips = [
    ...(profile?.dealTypes ?? [])
      .map((v) => labelFor(DEAL_TYPES, v))
      .filter(Boolean),
    ...(profile?.travelTimeframe ?? [])
      .map((v) => labelFor(TIMEFRAMES, v))
      .filter(Boolean),
    ...(profile?.travelBarriers ?? [])
      .map((v) => labelFor(BARRIERS, v))
      .filter(Boolean),
  ] as { icon: string; label: string }[];

  // Sits directly under the identity line inside FeedReveal rather than at
  // the bottom of the page — it answers "do they actually know me?", which is
  // a question the user has before they scroll, not after.
  const matchingBlock = (
    <>
      {showGiftPill && (
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            navigation.navigate("GiftOffer", { fromEntryPoint: "gated_home_pill" });
          }}
          activeOpacity={0.85}
          accessibilityRole="button"
          style={[styles.giftPill, { backgroundColor: colors.brand.traceRed + "14", borderColor: colors.brand.traceRed }]}
        >
          <Gift size={15} color={colors.brand.traceRed} />
          <Text style={[styles.giftPillText, { color: colors.brand.traceRed }]}>
            You have an unclaimed offer
          </Text>
        </TouchableOpacity>
      )}
      {newCount > 0 && (
        <Animated.View
          entering={FadeIn.duration(400)}
          style={[styles.freshPill, { backgroundColor: colors.brand.traceGreen + "1A" }]}
        >
          <Sparkles size={14} color={colors.brand.traceGreen} />
          <Text style={[styles.freshText, { color: colors.brand.traceGreen }]}>
            {newCount} new {newCount === 1 ? "destination" : "destinations"} since
            you were last here
          </Text>
        </Animated.View>
      )}
      {prefChips.length > 0 ? (
      <Animated.View entering={FadeIn.duration(400).delay(160)}>
        <Text
          style={{
            color: theme.mutedForeground,
            fontSize: 12,
            fontWeight: "700",
            letterSpacing: 0.6,
            marginBottom: 10,
          }}
        >
          WHAT WE'RE MATCHING YOU ON
        </Text>
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 8,
            marginBottom: 22,
          }}
        >
          {prefChips.map((c, i) => (
            <View
              key={`${c.label}-${i}`}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                backgroundColor: theme.muted,
                borderRadius: 999,
                paddingHorizontal: 12,
                paddingVertical: 8,
              }}
            >
              <Text style={{ fontSize: 14 }}>{c.icon}</Text>
              <Text
                style={{
                  color: theme.foreground,
                  fontSize: 13,
                  fontWeight: "600",
                }}
              >
                {c.label}
              </Text>
            </View>
          ))}
        </View>
      </Animated.View>
      ) : null}
      {!!answer && (
        <Animated.Text
          entering={FadeIn.duration(400).delay(240)}
          style={[styles.answer, { color: theme.foreground }]}
        >
          {answer}
        </Animated.Text>
      )}
    </>
  );

  /**
   * The actual argument for subscribing, in their own numbers: what these
   * deals save against what the subscription costs. Renders only when both
   * halves survive their sanity checks.
   */
  const savingsBlock =
    savings && premiumAnnualPackage ? (
      <Animated.View
        entering={FadeIn.duration(420).delay(300)}
        style={[styles.savings, { borderColor: colors.brand.traceRed }]}
      >
        <Text style={[styles.savingsBig, { color: theme.foreground }]}>
          These {savings.counted} trips are{" "}
          <Text style={{ color: colors.brand.traceRed }}>
            ${savings.total.toLocaleString("en-US")}
          </Text>{" "}
          below their usual fares.
        </Text>
        <Text style={[styles.savingsSub, { color: theme.mutedForeground }]}>
          Trace is {premiumAnnualPackage.product.priceString} a year.
        </Text>
      </Animated.View>
    ) : null;

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <TraceLoader />
      </View>
    );
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.background }}
      edges={["top", "left", "right"]}
    >
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingTop: 12, paddingBottom: 4 }}>
          <FeedReveal
            deals={deals}
            homeAirport={airport}
            firstName={firstName}
            destinationPreference={profile?.destinationPreference ?? "both"}
            prefs={rankPrefs}
            headerExtra={matchingBlock}
            footerExtra={savingsBlock}
            onPressDeal={(deal) => {
              logEvent("gated_deal_opened", { destination: deal.destination });
              setExpandedDeal(deal);
            }}
            onPressLocked={() => openPaywall("gated_deal_locked")}
          />
        </View>

      </ScrollView>

      <View
        style={{
          paddingHorizontal: 24,
          paddingTop: 14,
          paddingBottom: 34,
          borderTopWidth: 1,
          borderTopColor: theme.border,
        }}
      >
        <TouchableOpacity
          onPress={() => openPaywall("gated_home_cta")}
          activeOpacity={0.9}
          accessibilityRole="button"
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
            <Text style={{ color: "#fff", fontSize: 17, fontWeight: "800" }}>
              {hasFreeTrial ? `Try Free for ${trialLabel}` : "Unlock every deal"}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Always leave a way out of the app itself. A gated user who has
            already paid on another device needs Restore, and one who simply
            wants to leave shouldn't have to delete the app to do it. */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            gap: 20,
            // marginTop is small because each link below carries its own
            // paddingVertical — 12pt text alone gave a ~15pt tall tap target,
            // well under the 44pt minimum, and taps that looked like they were
            // on "Sign out" landed just under it and did nothing.
            marginTop: 4,
          }}
        >
          <TouchableOpacity
            hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }}
            style={{ paddingVertical: 10 }}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              navigation.navigate("EditPreferences");
            }}
          >
            <Text style={{ color: theme.mutedForeground, fontSize: 12 }}>
              Edit my answers
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }}
            style={{ paddingVertical: 10 }}
            onPress={() => openPaywall("gated_home_restore")}
          >
            <Text style={{ color: theme.mutedForeground, fontSize: 12 }}>
              Restore purchase
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }}
            style={{ paddingVertical: 10 }}
            onPress={() => logout().catch(() => {})}
          >
            <Text style={{ color: theme.mutedForeground, fontSize: 12 }}>
              Sign out
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {expandedDeal && (
        <DealPeek
          deal={expandedDeal}
          homeAirport={airport}
          ctaLabel={hasFreeTrial ? `Try Free for ${trialLabel}` : "Unlock every deal"}
          onClose={() => setExpandedDeal(null)}
          onCta={() => upsellFromDeal("gated_deal_peek")}
        />
      )}
    </SafeAreaView>
  );
}
