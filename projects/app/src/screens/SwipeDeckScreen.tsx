import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  useColorScheme,
  ScrollView,
  Share,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useIsFocused } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Crown, X, Heart, Undo2 } from "lucide-react-native";
import { colors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";
import { useFreeTrial } from "../context/TrialContext";
import { useDealFetch } from "../hooks/useDealFetch";
import { useSounds } from "../hooks/useSounds";
import { useProfile } from "../hooks/useProfile";
import { logEvent } from "../lib/analytics";
import {
  createSwipeAction,
  getSwipeActions,
  saveDeal,
  deleteSavedDeal,
  updateUserProfile,
} from "../services/firestore";
import {
  MAX_DAILY_SWIPES,
  UNLIMITED_SWIPES,
  ALL_BADGES,
} from "../lib/constants";
import { getItem, setItem } from "../lib/storage";
import { scheduleSwipeResetReminder, registerPushToken } from "../services/push";
import SwipeCard from "../components/swipe/SwipeCard";
import SwipeTutorial from "../components/swipe/SwipeTutorial";
import DashboardTooltip from "../components/swipe/DashboardTooltip";
import HowToSwipeModal from "../components/swipe/HowToSwipeModal";
import AILearningModal from "../components/swipe/AILearningModal";
import BadgeUnlockNotification from "../components/BadgeUnlockNotification";
import LevelUpNotification from "../components/LevelUpNotification";
import ExpandedDeal from "../components/swipe/ExpandedDeal";
import type { RootStackParamList } from "../navigation/types";
import type { Deal } from "@trace/shared";
import { prefetchDestinationInfo } from "../hooks/useDestinationInfo";
import { createShare } from "../services/shareApi";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const LOADING_IMAGES = [
  require("../../assets/1.png"),
  require("../../assets/2.png"),
  require("../../assets/4.png"),
];
let swipeDeckLoadCount = 0;

function LoadingScreen({ today, theme }: { today: string; theme: typeof colors.light | typeof colors.dark }) {
  const imageIndex = React.useRef(swipeDeckLoadCount % LOADING_IMAGES.length);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.7);

  React.useEffect(() => {
    swipeDeckLoadCount += 1;
    scale.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 750, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 750, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 750, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.5, { duration: 750, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.background, justifyContent: "center", alignItems: "center" }}
      edges={["top", "left", "right"]}
    >
      <Animated.View style={animatedStyle}>
        <Image
          source={LOADING_IMAGES[imageIndex.current]}
          style={{ width: 120, height: 120, resizeMode: "contain" }}
        />
      </Animated.View>
      <Text style={{ marginTop: 20, color: theme.mutedForeground, fontSize: 14 }}>
        Finding the best deals for{" "}
        <Text style={{ fontWeight: "700", color: colors.brand.traceRed }}>{today}</Text>
      </Text>
    </SafeAreaView>
  );
}

function DailyLimitView({
  theme,
  scheme,
  maxSwipes,
  dealsWaiting,
  homeAirport,
  windowStart,
  onUpgrade,
  onExplore,
  onRemindMe,
}: {
  theme: typeof colors.light | typeof colors.dark;
  scheme: "light" | "dark" | null | undefined;
  maxSwipes: number;
  dealsWaiting: number;
  homeAirport?: string | null;
  windowStart?: string | null;
  onUpgrade: () => void;
  onExplore: () => void;
  onRemindMe: () => Promise<boolean>;
}) {
  const { available: trialAvailable, label: trialLabel, labelLong: trialLabelLong } = useFreeTrial();
  // Return-hook state: tapping "remind me" requests notification permission
  // and schedules a local reset reminder.
  const [remindState, setRemindState] = React.useState<
    "idle" | "working" | "done" | "denied"
  >("idle");
  const handleRemind = async () => {
    if (remindState === "working" || remindState === "done") return;
    setRemindState("working");
    const ok = await onRemindMe();
    setRemindState(ok ? "done" : "denied");
  };
  const fromAirport = homeAirport ? ` from ${homeAirport}` : "";
  const getSecondsLeft = React.useCallback(() => {
    const resetAt = windowStart
      ? new Date(windowStart).getTime() + 24 * 60 * 60 * 1000
      : Date.now() + 24 * 60 * 60 * 1000;
    return Math.max(0, Math.floor((resetAt - Date.now()) / 1000));
  }, [windowStart]);

  const [timeLeft, setTimeLeft] = React.useState(getSecondsLeft);

  React.useEffect(() => {
    const timer = setInterval(() => setTimeLeft(getSecondsLeft()), 1000);
    return () => clearInterval(timer);
  }, [getSecondsLeft]);

  const hours = Math.floor(timeLeft / 3600);
  const minutes = Math.floor((timeLeft % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  const resetsInLabel = `${pad(hours)}h ${pad(minutes)}m`;

  const bg = scheme === "dark" ? "rgba(10,10,18," : "rgba(255,255,255,";

  // Trial-first layout: when the user is intro-eligible, lead with the
  // trial CTA and demote "come back tomorrow" to small print. The
  // v1.3.2 cohort showed 15/29 users hitting the cap and only 2 of
  // them reaching the paywall — the old "Resets in HH:MM:SS" pill read
  // as the headline answer, so users just left.
  return (
    <Animated.View
      entering={FadeIn.duration(500)}
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 10, borderRadius: 20, overflow: "hidden" }}
    >
      {/* Gradient fade — card peeks through a sliver at the top, then solid */}
      <LinearGradient
        colors={[
          `${bg}0.0)`,
          `${bg}0.92)`,
          `${bg}1.0)`,
        ]}
        locations={[0, 0.22, 0.40]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />

      {/* Content anchored to the bottom */}
      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingBottom: 20 }}>
        <View style={{ alignItems: "center", marginBottom: 18 }}>
          <Text style={{ fontSize: 32, marginBottom: 8 }}>
            {trialAvailable ? "🔥" : "🌙"}
          </Text>
          <Text style={{ fontSize: 22, fontWeight: "900", color: theme.foreground, textAlign: "center", marginBottom: 6 }}>
            {trialAvailable
              ? "You're on a roll"
              : "That's all for today"}
          </Text>
          <Text style={{ fontSize: 13, color: theme.mutedForeground, textAlign: "center", lineHeight: 18 }}>
            {trialAvailable
              ? dealsWaiting > 0
                ? `${dealsWaiting} more deals${fromAirport} waiting. Keep going free for ${trialLabelLong} — cancel anytime.`
                : `Unlock unlimited swipes free for ${trialLabelLong}. Cancel anytime.`
              : dealsWaiting > 0
                ? `${dealsWaiting} more deals${fromAirport} waiting — come back tomorrow or upgrade for unlimited.`
                : `Free members get ${maxSwipes} swipes per day. Upgrade for unlimited.`}
          </Text>
        </View>

        {/* Primary CTA — trial when available, generic upgrade otherwise */}
        <TouchableOpacity
          onPress={onUpgrade}
          activeOpacity={0.85}
          style={{ borderRadius: 14, overflow: "hidden", marginBottom: 10 }}
        >
          <LinearGradient
            colors={[colors.brand.traceRed, colors.brand.tracePink]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ paddingVertical: 16, alignItems: "center" }}
          >
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "800" }}>
              {trialAvailable ? `Try free for ${trialLabelLong} →` : "Unlock Unlimited Swipes"}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Return hook — for users who won't start a trial, give them a
            concrete reason (and reminder) to come back tomorrow. Requests
            push permission and schedules a local reset reminder; also grows
            our push channel so server re-engagement can reach them. */}
        <TouchableOpacity
          onPress={handleRemind}
          disabled={remindState === "working" || remindState === "done"}
          activeOpacity={0.85}
          style={{
            backgroundColor:
              remindState === "done"
                ? scheme === "dark"
                  ? "rgba(34,197,94,0.15)"
                  : "rgba(34,197,94,0.10)"
                : scheme === "dark"
                ? "rgba(255,255,255,0.08)"
                : "rgba(0,0,0,0.05)",
            borderRadius: 14,
            paddingVertical: 13,
            alignItems: "center",
            borderWidth: 1,
            borderColor:
              remindState === "done" ? "rgba(34,197,94,0.45)" : theme.border,
            marginBottom: 10,
          }}
        >
          <Text style={{ color: theme.foreground, fontSize: 14, fontWeight: "700" }}>
            {remindState === "done"
              ? "✓ We'll remind you when they reset"
              : remindState === "working"
              ? "Setting reminder…"
              : remindState === "denied"
              ? "Enable notifications to get reminded"
              : "🔔 Remind me when my swipes reset"}
          </Text>
        </TouchableOpacity>

        {/* Tertiary */}
        <TouchableOpacity onPress={onExplore} style={{ paddingVertical: 8, alignItems: "center", marginBottom: 4 }}>
          <Text style={{ color: theme.mutedForeground, fontSize: 13, fontWeight: "600" }}>Browse Explore instead</Text>
        </TouchableOpacity>

        {/* Reset time — small print; the reminder above fires at this moment. */}
        <Text style={{ fontSize: 11, color: theme.mutedForeground, textAlign: "center" }}>
          Your free swipes reset in {resetsInLabel}
        </Text>
      </View>
    </Animated.View>
  );
}

export default function SwipeDeckScreen() {
  const navigation = useNavigation<Nav>();
  const isFocused = useIsFocused();
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;
  const { user, profile, isPremium } = useAuth();
  const { available: trialAvailable, label: trialLabel, labelLong: trialLabelLong } = useFreeTrial();
  const { updateProfile } = useProfile();
  const { play } = useSounds();
  const { deals, premiumDeals, loading, showingAllDeals, reload } = useDealFetch(
    profile ? { ...profile, id: profile.id! } : null
  );

  const [deckMode, setDeckMode] = useState<"economy" | "business">("economy");
  const [destFilter, setDestFilter] = useState<"both" | "domestic" | "international">("both");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [deckPhase, setDeckPhase] = useState<"swiping" | "expanding" | "exhausted" | "daily_limit">("swiping");
  const [swipesLeft, setSwipesLeft] = useState(MAX_DAILY_SWIPES);
  const [allSwipes, setAllSwipes] = useState<any[]>([]);
  const [triggerSwipe, setTriggerSwipe] = useState<"left" | "right" | null>(null);
  const [undoneDealId, setUndoneDealId] = useState<string | null>(null);
  const [expandedDeal, setExpandedDeal] = useState<Deal | null>(null);

  // Undo state — also tracks the Firestore doc ID of a saved deal so undo can delete it
  const [lastSwipedDeal, setLastSwipedDeal] = useState<{ deal: Deal; action: string } | null>(null);
  const lastSavedDealDocId = useRef<string | null>(null);

  // Tutorial/modal state
  const [showHowToSwipe, setShowHowToSwipe] = useState(false);
  const howToSwipeDismissed = useRef(false);
  const [showAILearning, setShowAILearning] = useState(false);
  const [tutorialAction, setTutorialAction] = useState<"left" | "right" | null>(null);
  const [shownTutorialTypes, setShownTutorialTypes] = useState<Set<string>>(new Set());

  // Badge/Level notification state
  const [unlockedBadge, setUnlockedBadge] = useState<{ name: string; emoji: string; description: string } | null>(null);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [newLevel, setNewLevel] = useState(1);
  // Snapshot of swipeCount at the moment of leveling up. The
  // LevelUpNotification component reads it to render the "X more
  // swipes to unlock" hint and the progress bar toward the next
  // level; right after a level-up swipeCount % 25 === 0 so progress
  // is 0% (fresh start toward the next level).
  const [newSwipeCount, setNewSwipeCount] = useState(0);

  // Track total swipes this session for AI learning modal
  const sessionSwipeCount = useRef(0);

  // Dashboard tooltip — shown once after user's first-ever save
  const [showDashboardTooltip, setShowDashboardTooltip] = useState(false);
  const [showTrialBanner, setShowTrialBanner] = useState(false);
  const sessionSaveCount = useRef(0);

  // Fire `deck_rendered` exactly once per mount, the first time we have
  // at least one card actually visible. Closes the v1.3.2 blind spot on
  // why 38% of users finished onboarding but never swiped — paired with
  // deals_load_failed, the funnel can tell us whether the deck appeared
  // at all for those users.
  const deckRenderedFiredRef = useRef(false);

  const activeDeals = useMemo(
    () => (deckMode === "business" ? premiumDeals : deals),
    [deckMode, premiumDeals, deals]
  );

  // Classify a deal as domestic or international using the same logic as useDealFetch.
  const getDealDestType = useCallback((deal: Deal): "domestic" | "international" => {
    if (deal.domestic_or_international) {
      return deal.domestic_or_international.toLowerCase().includes("international")
        ? "international" : "domestic";
    }
    if (deal.continent) {
      const c = deal.continent.toLowerCase();
      return c.includes("north america") ? "domestic" : "international";
    }
    return "domestic"; // default unknown deals to domestic
  }, []);

  // Deals visible after applying the dest filter. No reload needed — we just
  // slice the already-loaded deck. Only applied when profile chose "both".
  const visibleDeals = useMemo(() => {
    if (destFilter === "both") return activeDeals;
    return activeDeals.filter((d) => getDealDestType(d) === destFilter);
  }, [activeDeals, destFilter, getDealDestType]);

  // Reset deck position whenever the filter changes so the user starts fresh.
  useEffect(() => {
    setCurrentIndex(0);
    setLastSwipedDeal(null);
    lastSavedDealDocId.current = null;
  }, [destFilter]);

  // Pre-fetch destination info for current + next 2 deals as soon as they're
  // visible, so the Destination tab loads instantly when the user opens it.
  useEffect(() => {
    prefetchDestinationInfo(visibleDeals[currentIndex] ?? null);
    prefetchDestinationInfo(visibleDeals[currentIndex + 1] ?? null);
    prefetchDestinationInfo(visibleDeals[currentIndex + 2] ?? null);
  }, [currentIndex, visibleDeals]);

  // Fire deck_rendered once when at least one card actually shows.
  useEffect(() => {
    if (deckRenderedFiredRef.current) return;
    if (loading) return;
    if (visibleDeals.length === 0) return;
    deckRenderedFiredRef.current = true;
    logEvent("deck_rendered", {
      deals_count: visibleDeals.length,
      deck_mode: deckMode,
      dest_filter: destFilter,
      home_airport: profile?.homeAirport ?? null,
    });
  }, [loading, visibleDeals.length, deckMode, destFilter, profile?.homeAirport]);

  async function doShare(deal: Deal, name: string) {
    try {
      const shareId = await createShare(deal, user!.uid, name);
      // Do NOT pass `url` — it's already embedded in `message`. On iOS the
      // share sheet appends `url` to the message automatically, which would
      // print the App Store link twice.
      await Share.share({
        title: `${deal.destination} deal on Trace`,
        message: `I found a deal to ${deal.destination} for $${deal.price}. Open it in Trace 👉 https://subscribe.tracetravel.co/share/${shareId}`,
      });
    } catch {}
  }

  // Resolve the sender name for deal sharing. Prefer Firebase Auth
  // displayName (set by Google/Apple sign-in), fall back to Firestore profile
  // name, but filter out "Travel Explorer" (the onboarding placeholder).
  const resolvedUserName = (() => {
    const raw = user?.displayName || profile?.displayName;
    return raw && raw !== "Travel Explorer" ? raw : null;
  })();

  // Initialize swipes left and fetch swipe history
  useEffect(() => {
    if (!profile || !user) return;
    const init = async () => {
      const today = new Date().toISOString().split("T")[0];
      const now = Date.now();
      const windowStart = profile.dailySwipeWindowStart
        ? new Date(profile.dailySwipeWindowStart).getTime()
        : 0;
      const windowExpired = now - windowStart >= 24 * 60 * 60 * 1000;
      let dailySwipes = profile.dailySwipesToday || 0;
      if (windowExpired) {
        dailySwipes = 0;
        await updateProfile({
          dailySwipesToday: 0,
          dailySwipeWindowStart: new Date(now).toISOString(),
        });
      }
      setSwipesLeft(isPremium ? UNLIMITED_SWIPES : MAX_DAILY_SWIPES - dailySwipes);

      const swipeHistory = await getSwipeActions(user.uid);
      setAllSwipes(swipeHistory);

      // Restore deck position (business members use a separate key)
      const posKey = profile.subscriptionStatus === "business"
        ? `business_deck_position_${today}_${profile.homeAirport}`
        : `deck_position_${today}_${profile.homeAirport}`;
      const stored = await getItem<number>(posKey);
      if (stored && stored > 0) setCurrentIndex(stored);
    };
    init();
  }, [profile?.id, user?.uid]);

  // Show HowToSwipe modal on mount if not shown before.
  // Gated on `isFocused` so it doesn't try to render while a modal
  // navigation screen (e.g. the post-onboarding Paywall) is on top —
  // RN's <Modal> renders to a native overlay that can stack badly with
  // the native-stack modal presentation, ending up "shown but invisible"
  // and silently eating taps after the modal above is dismissed.
  useEffect(() => {
    if (!isFocused) return;
    if (profile && !profile.howToSwipeShown && !loading && !howToSwipeDismissed.current) {
      setShowHowToSwipe(true);
    }
  }, [profile?.howToSwipeShown, loading, isFocused]);

  // Auto-switch to business for business members — and reset to economy
  // when they're no longer on the Business tier
  useEffect(() => {
    if (profile?.subscriptionStatus === "business" && premiumDeals.length > 0) {
      setDeckMode("business");
    } else if (profile?.subscriptionStatus !== "business" && deckMode === "business") {
      setDeckMode("economy");
    }
  }, [profile?.subscriptionStatus, premiumDeals.length]);

  // When the deck runs out during normal swiping: reload to expand the pool.
  // Exception: if the filter is the reason the visible deck is empty (not a
  // real out-of-deals), don't reload — the full deck still has cards.
  useEffect(() => {
    const isOutOfDeals = visibleDeals.length - currentIndex <= 0;
    const isFilterEmpty = destFilter !== "both" && visibleDeals.length === 0 && activeDeals.length > 0;
    if (!isOutOfDeals || isFilterEmpty || loading || deckPhase !== "swiping") return;
    setDeckPhase("expanding");
    setCurrentIndex(0);
    reload();
  }, [visibleDeals.length, activeDeals.length, currentIndex, loading, deckPhase, destFilter]);

  // Transition to daily limit screen when a free user hits 0 swipes.
  // Fires daily_limit_hit here (vs. inside handleSwipe) because the
  // overlay catches further swipe attempts, so the in-handleSwipe path
  // never executed in practice — the v1.3.2 cohort had 0 emits for 15
  // users who hit the cap. On the first cap-hit each day we also auto-
  // open the paywall (trial-first cohort fix), gated by a per-USER-
  // per-day key so the same physical device hitting the cap on a
  // different account still gets the prompt — and so remounting the
  // deck (tab switch) on the same user doesn't re-pop.
  useEffect(() => {
    if (isPremium || swipesLeft > 0 || deckPhase !== "swiping") return;
    if (!user?.uid) return; // can't scope the per-user key yet
    setDeckPhase("daily_limit");
    logEvent("daily_limit_hit", { swipes_left: 0 });

    (async () => {
      const today = new Date().toISOString().split("T")[0];
      const autoOpenKey = `dailyLimitPaywallAutoOpened.${user.uid}.${today}`;
      const alreadyOpened = await getItem<string>(autoOpenKey);
      if (alreadyOpened) return;
      await setItem(autoOpenKey, new Date().toISOString());
      navigation.navigate("Paywall", { entryPoint: "swipe_daily_limit_auto" });
    })();
  }, [swipesLeft, isPremium, deckPhase, navigation, user?.uid]);

  // When isPremium becomes true, unlock swipes and exit the daily limit screen
  useEffect(() => {
    if (isPremium) {
      setSwipesLeft(UNLIMITED_SWIPES);
      setDeckPhase((prev) => (prev === "daily_limit" ? "swiping" : prev));
    }
  }, [isPremium]);

  // When the expansion reload finishes: decide if we have new deals or are truly done
  useEffect(() => {
    if (deckPhase !== "expanding" || loading) return;
    setDeckPhase(activeDeals.length > 0 ? "swiping" : "exhausted");
  }, [loading, deckPhase, activeDeals.length]);

  const handleDismissHowToSwipe = useCallback(async () => {
    howToSwipeDismissed.current = true;
    setShowHowToSwipe(false);
    await updateProfile({ howToSwipeShown: true });
  }, [updateProfile]);

  const handleDismissAILearning = useCallback(async () => {
    setShowAILearning(false);
    await updateProfile({ aiLearningShown: true });
  }, [updateProfile]);

  const handleUndo = useCallback(() => {
    if (!lastSwipedDeal || currentIndex <= 0) return;
    const restoredId = lastSwipedDeal.deal.id;
    // If the last swipe was a right-swipe (save), also remove the saved deal from Firestore
    if (lastSwipedDeal.action === "right" && lastSavedDealDocId.current) {
      deleteSavedDeal(lastSavedDealDocId.current).catch(() => {});
      lastSavedDealDocId.current = null;
    }
    setCurrentIndex((prev) => prev - 1);
    setLastSwipedDeal(null);
    setAllSwipes((prev) => prev.slice(1));
    setUndoneDealId(restoredId);
    setTimeout(() => setUndoneDealId(null), 500);
    play("undo");
  }, [lastSwipedDeal, currentIndex]);

  const handleSwipe = useCallback(
    async (action: "left" | "right" | "super") => {
      if (!profile || currentIndex >= visibleDeals.length) return;
      setTriggerSwipe(null);

      if (!isPremium && swipesLeft <= 0) {
        // daily_limit_hit fires from the transition effect below — the
        // overlay rendered by deckPhase="daily_limit" blocks new swipe
        // attempts, so emitting here is redundant *and* never fires in
        // the practical case where the cap is hit by a real swipe.
        setDeckPhase("daily_limit");
        return;
      }

      const deal = visibleDeals[currentIndex];
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);

      // Normalize: old "super" action (from ExpandedDeal onSave path) counts as "right"
      const normalizedAction = action === "super" ? "right" : action;

      logEvent("swipe", {
        action: normalizedAction,
        deal_type: deal.deal_type ?? null,
        destination: deal.destination,
        price: deal.price,
      });
      if (normalizedAction === "right") {
        logEvent("deal_saved", {
          deal_type: deal.deal_type ?? null,
          destination: deal.destination,
          price: deal.price,
        });
      }

      // Track for undo
      setLastSwipedDeal({ deal, action: normalizedAction });

      // Sound feedback
      if (normalizedAction === "right") play("save");
      else if (normalizedAction === "left") play("pass");

      // Show swipe tutorial toast for first swipe of each type this session
      if (normalizedAction !== "right" || !shownTutorialTypes.has("right")) {
        const toastAction = normalizedAction as "left" | "right";
        if (!shownTutorialTypes.has(toastAction)) {
          setTutorialAction(toastAction);
          setShownTutorialTypes((prev) => new Set([...prev, toastAction]));
          setTimeout(() => setTutorialAction(null), 3000);
        }
      }

      if (!user) return;

      // Track session swipe count for AI learning modal. Fire on the 4th
      // swipe (not the 5th) so it doesn't collide with the daily-limit
      // paywall, which auto-opens the instant the 5th swipe exhausts the cap.
      sessionSwipeCount.current += 1;
      if (sessionSwipeCount.current === 4 && !profile.aiLearningShown) {
        setShowAILearning(true);
      }

      // Save position (only when unfiltered — filtered positions are transient)
      if (destFilter === "both") {
        const today = new Date().toISOString().split("T")[0];
        const posKey =
          deckMode === "business"
            ? `business_deck_position_${today}_${profile.homeAirport}`
            : `deck_position_${today}_${profile.homeAirport}`;
        await setItem(posKey, newIndex);
      }

      // Save full deal on right swipe
      if (normalizedAction === "right") {
        const docId = await saveDeal({
          userId: user.uid,
          originalDealId: deal.id,
          destination: deal.destination,
          destinationCode: deal.destination_code,
          origin: deal.origin,
          price: deal.price,
          originalPrice: deal.original_price,
          discountPct: deal.discount_pct,
          travelWindow: deal.travel_window,
          dealType: deal.deal_type,
          imageUrl: deal.image_url,
          aiInsight: deal.ai_insight,
          vibeDescription: deal.vibe_description,
          weatherPreview: deal.weather_preview,
          continent: deal.continent,
          urgency: deal.urgency,
          priceTrend: deal.price_trend,
          url: deal.url,
          airlines: deal.airlines,
          duration: deal.duration,
          layoverInfo: deal.layover_info,
          isBusinessClass: deal.is_business_class || false,
        });
        lastSavedDealDocId.current = docId;
      }

      // Record swipe
      await createSwipeAction({
        userId: user.uid,
        dealId: deal.id,
        action: normalizedAction,
        dealType: deal.deal_type ?? null,
        destination: deal.destination,
        continent: deal.continent ?? null,
        price: deal.price,
        domesticOrInternational: deal.domestic_or_international ?? null,
      });

      // Update profile stats
      const newSwipeCount = (profile.swipeCount || 0) + 1;
      const newDailySwipes = (profile.dailySwipesToday || 0) + 1;
      const updates: Record<string, any> = {
        swipeCount: newSwipeCount,
        dailySwipesToday: newDailySwipes,
      };
      // Stamp window start on the first swipe of a new window (so the 24h clock starts now)
      if (newDailySwipes === 1) {
        updates.dailySwipeWindowStart = new Date().toISOString();
      }

      // First-save stamp — gates the push soft prompt (see
      // useTriggerSoftPromptAfterFirstSave). Only stamp once; subsequent
      // saves leave the original timestamp alone.
      if (normalizedAction === "right" && !profile.firstSaveAt) {
        updates.firstSaveAt = new Date();
        setShowDashboardTooltip(true);
        setTimeout(() => setShowDashboardTooltip(false), 4000);
      }

      if (normalizedAction === "right" && !isPremium) {
        sessionSaveCount.current += 1;
        if (sessionSaveCount.current === 5) {
          setShowTrialBanner(true);
          setTimeout(() => setShowTrialBanner(false), 5000);
        }
      }

      // Level up every 25 swipes
      const didLevelUp = newSwipeCount % 25 === 0;
      if (didLevelUp) {
        const lvl = (profile.dealHunterLevel || 1) + 1;
        updates.dealHunterLevel = lvl;
        setNewLevel(lvl);
        // Snapshot the count at level-up time so the modal renders
        // a stable progress bar even if more swipes happen in the
        // background before the user dismisses it.
        setNewSwipeCount(newSwipeCount);
      }

      await updateProfile(updates);
      setSwipesLeft(isPremium ? UNLIMITED_SWIPES : MAX_DAILY_SWIPES - newDailySwipes);

      // Track swipe locally
      const newSwipeRecord = {
        dealId: deal.id,
        action: normalizedAction,
        dealType: deal.deal_type,
        destination: deal.destination,
        continent: deal.continent,
        price: deal.price,
        domesticOrInternational: deal.domestic_or_international,
      };
      setAllSwipes((prev) => [newSwipeRecord, ...prev]);

      // Check badges
      const newSwipes = [newSwipeRecord, ...allSwipes];
      const updatedProfile = { ...profile, ...updates };
      let newBadges = [...(profile.badges || [])];
      for (const badge of ALL_BADGES) {
        if (newBadges.includes(badge.id)) continue;
        const wasEarned = badge.requirement(profile, allSwipes);
        const isNowEarned = badge.requirement(updatedProfile, newSwipes);
        if (!wasEarned && isNowEarned) {
          newBadges = [...newBadges, badge.id];
          await updateProfile({ badges: newBadges });
          // Show badge notification
          setUnlockedBadge({ name: badge.name, emoji: badge.emoji, description: badge.desc });
          play("badge");
          break;
        }
      }

      // Show level up notification after badge (slight delay)
      if (didLevelUp) {
        setTimeout(() => setShowLevelUp(true), unlockedBadge ? 3600 : 300);
      }
    },
    [currentIndex, visibleDeals, activeDeals, profile, user, swipesLeft, allSwipes, isPremium, deckMode, destFilter, shownTutorialTypes]
  );

  const handleButtonSwipe = (action: "left" | "right") => {
    if (!isPremium && swipesLeft <= 0) {
      setDeckPhase("daily_limit");
      return;
    }
    setTriggerSwipe(action);
    setTimeout(() => setTriggerSwipe(null), 400);
  };

  const handleCenterButton = () => {
    if (!isPremium && swipesLeft <= 0) {
      setDeckPhase("daily_limit");
      return;
    }
    const deal = visibleDeals[currentIndex];
    if (deal) setExpandedDeal(deal);
  };

  if (loading && deckPhase === "swiping") {
    const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    return <LoadingScreen today={today} theme={theme} />;
  }

  const isBusinessMember = profile?.subscriptionStatus === "business";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={["top", "left", "right"]}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
        }}
      >
        {/* Left: logo + airport pill OR dom/intl toggle */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Image source={require("../../assets/Bluelogo.png")} style={{ width: 26, height: 26, resizeMode: "contain" }} />
          {profile?.destinationPreference === "both" ? (
            // Compact toggle inline in header
            <View
              style={{
                flexDirection: "row",
                backgroundColor: theme.muted,
                borderRadius: 999,
                padding: 2,
              }}
            >
              {(["both", "domestic", "international"] as const).map((opt) => {
                const labels = { both: "Both", domestic: "🇺🇸", international: "🌍" };
                const isActive = destFilter === opt;
                return (
                  <TouchableOpacity
                    key={opt}
                    onPress={() => setDestFilter(opt)}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 999,
                      backgroundColor: isActive ? theme.card : "transparent",
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: "700", color: isActive ? theme.foreground : theme.mutedForeground }}>
                      {labels[opt]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            profile?.homeAirport && (
              <View
                style={{
                  backgroundColor: theme.muted,
                  borderRadius: 999,
                  paddingHorizontal: 12,
                  paddingVertical: 4,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "600", color: theme.mutedForeground }}>
                  From {profile.homeAirport}
                </Text>
              </View>
            )
          )}
        </View>
        {!isPremium && (
          <TouchableOpacity
            onPress={() => navigation.navigate("Paywall", { entryPoint: "swipe_header_crown" })}
            style={{ flexDirection: "row", alignItems: "center" }}
          >
            {swipesLeft <= 8 ? (
              <View style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                backgroundColor: colors.brand.amber50,
                borderRadius: 999,
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderWidth: 1,
                borderColor: colors.brand.amber200,
              }}>
                <Text style={{ fontSize: 12 }}>⚡</Text>
                <Text style={{ fontSize: 12, fontWeight: "700", color: colors.brand.amber600 }}>
                  {swipesLeft} left
                </Text>
              </View>
            ) : (
              <Crown color={colors.brand.amber500} size={24} />
            )}
          </TouchableOpacity>
        )}
      </View>


      {/* Search destination chip */}
      <TouchableOpacity
        onPress={() => navigation.navigate("MainTabs", { screen: "Explore" })}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          alignSelf: "center",
          marginTop: 8,
          backgroundColor: theme.muted,
          borderRadius: 999,
          paddingHorizontal: 14,
          paddingVertical: 7,
          borderWidth: 1,
          borderColor: theme.border,
        }}
      >
        <Text style={{ fontSize: 13 }}>🔍</Text>
        <Text style={{ fontSize: 13, fontWeight: "600", color: theme.mutedForeground }}>
          Search a destination
        </Text>
      </TouchableOpacity>

      {/* Business toggle */}
      {isBusinessMember && premiumDeals.length > 0 && (
        <View
          style={{
            flexDirection: "row",
            backgroundColor: theme.muted,
            borderRadius: 999,
            padding: 4,
            marginHorizontal: 16,
            marginTop: 8,
            alignSelf: "flex-start",
          }}
        >
          <TouchableOpacity
            onPress={() => setDeckMode("economy")}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: deckMode === "economy" ? theme.card : "transparent",
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: deckMode === "economy" ? theme.foreground : theme.mutedForeground,
              }}
            >
              ✈️ Economy
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setDeckMode("business")}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: deckMode === "business" ? colors.brand.amber500 : "transparent",
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: deckMode === "business" ? "#fff" : theme.mutedForeground,
              }}
            >
              👑 Business
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Main content */}
      {deckPhase === "exhausted" ? (
        <Animated.View
          entering={FadeIn.duration(400)}
          style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 32 }}
        >
          <Text style={{ fontSize: 52, marginBottom: 20 }}>✈️</Text>
          <Text style={{ fontSize: 22, fontWeight: "900", color: theme.foreground, marginBottom: 10, textAlign: "center" }}>
            You've seen every deal!
          </Text>
          <Text style={{ color: theme.mutedForeground, fontSize: 14, textAlign: "center", marginBottom: 36, lineHeight: 20 }}>
            Check your saved deals on the dashboard or start fresh to review again.
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate("MainTabs", { screen: "Dashboard" })}
            style={{
              width: "100%",
              backgroundColor: colors.brand.traceRed,
              borderRadius: 14,
              paddingVertical: 15,
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>
              View Dashboard
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={async () => {
              const today = new Date().toISOString().split("T")[0];
              await setItem(`deck_position_${today}_${profile?.homeAirport}`, 0);
              setCurrentIndex(0);
              setDeckPhase("swiping");
            }}
            style={{
              width: "100%",
              backgroundColor: theme.card,
              borderRadius: 14,
              paddingVertical: 15,
              alignItems: "center",
              borderWidth: 1,
              borderColor: theme.border,
            }}
          >
            <Text style={{ color: theme.foreground, fontSize: 15, fontWeight: "700" }}>
              See Deals Again
            </Text>
          </TouchableOpacity>
        </Animated.View>
      ) : deckPhase === "expanding" ? (
        <Animated.View
          entering={FadeIn.duration(300)}
          style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 24 }}
        >
          <Animated.Image
            source={require("../../assets/Bluelogo.png")}
            style={{ width: 60, height: 60, resizeMode: "contain", marginBottom: 20 }}
          />
          <Text style={{ fontSize: 17, fontWeight: "700", color: theme.foreground, marginBottom: 8 }}>
            Finding more deals…
          </Text>
          <Text style={{ color: theme.mutedForeground, fontSize: 13, textAlign: "center" }}>
            Expanding beyond your usual preferences
          </Text>
        </Animated.View>
      ) : (
        <View style={{ flex: 1, paddingHorizontal: 12, paddingTop: 8, position: "relative" }}>
          {/* Card stack */}
          <View style={{ flex: 1, position: "relative" }}>
            {/* Daily limit overlay — sits on top of the last deal card */}
            {deckPhase === "daily_limit" && (
              <DailyLimitView
                theme={theme}
                scheme={scheme}
                maxSwipes={MAX_DAILY_SWIPES}
                dealsWaiting={Math.max(0, visibleDeals.length - currentIndex)}
                homeAirport={profile?.homeAirport}
                windowStart={profile?.dailySwipeWindowStart}
                onUpgrade={() => navigation.navigate("Paywall", { entryPoint: "swipe_daily_limit" })}
                onExplore={() => navigation.navigate("MainTabs", { screen: "Explore" })}
                onRemindMe={async () => {
                  logEvent("daily_limit_remind_tapped", {});
                  const status = await scheduleSwipeResetReminder({
                    homeAirport: profile?.homeAirport,
                    dealsWaiting: Math.max(0, visibleDeals.length - currentIndex),
                  });
                  if (status === "granted") {
                    updateProfile({
                      notificationsEnabled: true,
                      notificationPermissionAsked: true,
                    }).catch(() => {});
                    if (profile?.id) registerPushToken(profile.id).catch(() => {});
                  }
                  return status === "granted";
                }}
              />
            )}
            {deckMode === "business" && (
              <View
                style={{
                  position: "absolute",
                  top: 12,
                  right: 12,
                  zIndex: 20,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  backgroundColor: colors.brand.amber500,
                  borderRadius: 999,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "700", color: "#fff" }}>
                  👑 Business Class
                </Text>
              </View>
            )}
            {/* Empty-filter state: the full deck has deals but none match the filter */}
            {visibleDeals.length === 0 && activeDeals.length > 0 && deckPhase === "swiping" ? (
              <Animated.View
                entering={FadeIn.duration(300)}
                style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 32 }}
              >
                <Text style={{ fontSize: 40, marginBottom: 16 }}>
                  {destFilter === "domestic" ? "🇺🇸" : "🌍"}
                </Text>
                <Text style={{ fontSize: 18, fontWeight: "800", color: theme.foreground, textAlign: "center", marginBottom: 8 }}>
                  No {destFilter === "domestic" ? "domestic" : "international"} deals right now
                </Text>
                <Text style={{ fontSize: 14, color: theme.mutedForeground, textAlign: "center", marginBottom: 24, lineHeight: 20 }}>
                  Switch to "Both" to see all available deals.
                </Text>
                <TouchableOpacity
                  onPress={() => setDestFilter("both")}
                  style={{ backgroundColor: colors.brand.traceRed, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 28 }}
                >
                  <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>Show All Deals</Text>
                </TouchableOpacity>
              </Animated.View>
            ) : (
              <>
                {/* Subtle amber strip that peeks below the card when ≤3 free swipes left.
                    Rendered before the cards so it paints behind them; only the bottom
                    ~12px are visible since the real card covers the rest. */}
                {!isPremium && swipesLeft <= 3 && swipesLeft > 0 && (
                  <Animated.View
                    entering={FadeIn.duration(600)}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 8,
                      right: 8,
                      bottom: -12,
                      borderRadius: 20,
                      backgroundColor: colors.brand.amber50,
                      borderWidth: 1,
                      borderColor: colors.brand.amber200,
                    }}
                  />
                )}
              {visibleDeals
                .slice(currentIndex, currentIndex + 3)
                .reverse()
                .map((deal, i, arr) => (
                  <SwipeCard
                    key={deal.id}
                    deal={deal}
                    isTop={i === arr.length - 1}
                    onSwipe={handleSwipe}
                    onExpand={() => { if (!isPremium && swipesLeft <= 0) { setDeckPhase("daily_limit"); return; } setExpandedDeal(deal); }}
                    triggerSwipe={i === arr.length - 1 ? triggerSwipe : null}
                    isSwipeDisabled={!isPremium && swipesLeft <= 0}
                    isUndone={deal.id === undoneDealId}
                    showPickedForYou={currentIndex === 0 && i === arr.length - 1}
                  />
                ))}
              </>
            )}

            {/* Trial banner — appears after 5th save for free users */}
            {showTrialBanner && (
              <Animated.View
                entering={FadeInDown.duration(300)}
                exiting={FadeOut.duration(300)}
                style={{
                  position: "absolute",
                  bottom: 16,
                  left: 16,
                  right: 16,
                  zIndex: 20,
                }}
              >
                <TouchableOpacity
                  onPress={() => {
                    setShowTrialBanner(false);
                    navigation.navigate("Paywall", { entryPoint: "fifth_save" });
                  }}
                  activeOpacity={0.9}
                  style={{
                    backgroundColor: colors.brand.traceRed,
                    borderRadius: 16,
                    paddingVertical: 14,
                    paddingHorizontal: 18,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.25,
                    shadowRadius: 10,
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#fff", flex: 1 }}>
                    ✨ Want alerts if this price drops? Start your free 7-day trial
                  </Text>
                  <Text style={{ fontSize: 18, color: "#fff", marginLeft: 8 }}>→</Text>
                </TouchableOpacity>
              </Animated.View>
            )}
          </View>

          {/* Undo button — just below the card */}
          <View style={{ height: 32, justifyContent: "center", alignItems: "flex-end", paddingHorizontal: 8, marginTop: 6 }}>
            {lastSwipedDeal && (
              <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)}>
                <TouchableOpacity
                  onPress={handleUndo}
                  style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 4 }}
                >
                  <Undo2 color={theme.mutedForeground} size={16} />
                  <Text style={{ fontSize: 14, fontWeight: "600", color: theme.mutedForeground }}>
                    Undo
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            )}
          </View>


          {/* Action buttons */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "center",
              alignItems: "center",
              gap: 24,
              paddingTop: 4,
              paddingBottom: 20,
            }}
          >
            <TouchableOpacity
              onPress={() => handleButtonSwipe("left")}
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: theme.card,
                borderWidth: 2,
                borderColor: theme.border,
                justifyContent: "center",
                alignItems: "center",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 8,
                elevation: 8,
              }}
            >
              <X color="#ef4444" size={32} strokeWidth={3} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleCenterButton}
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: theme.card,
                borderWidth: 2,
                borderColor: theme.border,
                justifyContent: "center",
                alignItems: "center",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 8,
                elevation: 8,
              }}
            >
              <Image source={require("../../assets/Bluelogo.png")} style={{ width: 40, height: 40, resizeMode: "contain" }} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleButtonSwipe("right")}
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: theme.card,
                borderWidth: 2,
                borderColor: theme.border,
                justifyContent: "center",
                alignItems: "center",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 8,
                elevation: 8,
              }}
            >
              <Heart
                color={colors.brand.traceGreen}
                fill={colors.brand.traceGreen}
                size={32}
              />
            </TouchableOpacity>
          </View>

        </View>
      )}

      {/* Swipe Tutorial toast */}
      {tutorialAction && <SwipeTutorial action={tutorialAction} />}

      {/* Badge Unlock Notification */}
      <BadgeUnlockNotification
        badge={unlockedBadge}
        onDismiss={() => setUnlockedBadge(null)}
      />

      {/* Level Up Notification.
          The component renders a progress bar + "X more swipes to
          unlock" text driven by `swipeCount`, so this prop matters
          to the UI — Trevor's earlier removal silenced the TS error
          but broke the displayed progress (NaN%, "NaN more swipes").
          Now snapshotted at level-up time via `newSwipeCount` state. */}
      <LevelUpNotification
        level={newLevel}
        swipeCount={newSwipeCount}
        visible={showLevelUp}
        onDismiss={() => setShowLevelUp(false)}
      />

      {/* HowToSwipe Modal */}
      <HowToSwipeModal visible={showHowToSwipe} onClose={handleDismissHowToSwipe} />

      {/* AI Learning Modal */}
      <AILearningModal visible={showAILearning} onClose={handleDismissAILearning} />

      {/* Expanded Deal */}
      {expandedDeal && (
        <ExpandedDeal
          deal={expandedDeal}
          visible={!!expandedDeal}
          userProfile={profile}
          onClose={() => setExpandedDeal(null)}
          onSave={() => {
            handleSwipe("right");
            setExpandedDeal(null);
          }}
          onBook={() => {
            if (expandedDeal.url) {
              const { Linking } = require("react-native");
              Linking.openURL(expandedDeal.url);
            }
          }}
          userName={resolvedUserName}
          onShare={(name) => {
            doShare(expandedDeal, name);
            // Persist the name so they're never asked again
            if (profile?.id) updateUserProfile(profile.id, { displayName: name }).catch(() => {});
          }}
        />
      )}

      {/* First-save tooltip pointing at the Dashboard tab */}
      <DashboardTooltip
        visible={showDashboardTooltip}
        tabCount={isBusinessMember ? 4 : 5}
        dashboardTabIndex={2}
      />

    </SafeAreaView>
  );
}
