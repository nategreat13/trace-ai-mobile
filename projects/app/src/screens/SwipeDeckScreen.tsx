import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  useColorScheme,
  ScrollView,
} from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Crown, X, Heart, Undo2 } from "lucide-react-native";
import { colors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";
import { useDealFetch } from "../hooks/useDealFetch";
import { useSounds } from "../hooks/useSounds";
import { useProfile } from "../hooks/useProfile";
import { logEvent } from "../lib/analytics";
import {
  createSwipeAction,
  getSwipeActions,
  saveDeal,
} from "../services/firestore";
import {
  MAX_DAILY_SWIPES,
  MAX_SAVES,
  UNLIMITED_SWIPES,
  ALL_BADGES,
} from "../lib/constants";
import { getItem, setItem } from "../lib/storage";
import SwipeCard from "../components/swipe/SwipeCard";
import SwipeTutorial from "../components/swipe/SwipeTutorial";
import HowToSwipeModal from "../components/swipe/HowToSwipeModal";
import AILearningModal from "../components/swipe/AILearningModal";
import BadgeUnlockNotification from "../components/BadgeUnlockNotification";
import LevelUpNotification from "../components/LevelUpNotification";
import ExpandedDeal from "../components/swipe/ExpandedDeal";
import type { RootStackParamList } from "../navigation/types";
import type { Deal } from "@trace/shared";

type Nav = NativeStackNavigationProp<RootStackParamList>;

function LoadingScreen({ today, theme }: { today: string; theme: typeof colors.light | typeof colors.dark }) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.7);

  React.useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.18, { duration: 700, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.6, { duration: 700, easing: Easing.inOut(Easing.ease) })
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
      <Animated.Image
        source={require("../../assets/Bluelogo.png")}
        style={[{ width: 80, height: 80, resizeMode: "contain" }, animatedStyle]}
      />
      <Text style={{ marginTop: 20, color: theme.mutedForeground, fontSize: 14 }}>
        Finding the best deals for{" "}
        <Text style={{ fontWeight: "700", color: colors.brand.traceRed }}>{today}</Text>
      </Text>
    </SafeAreaView>
  );
}

export default function SwipeDeckScreen() {
  const navigation = useNavigation<Nav>();
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;
  const { user, profile, isPremium } = useAuth();
  const { updateProfile } = useProfile();
  const { play } = useSounds();
  const { deals, premiumDeals, loading, showingAllDeals, reload } = useDealFetch(
    profile ? { ...profile, id: profile.id! } : null
  );

  const [deckMode, setDeckMode] = useState<"economy" | "business">("economy");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [deckPhase, setDeckPhase] = useState<"swiping" | "expanding" | "exhausted">("swiping");
  const [swipesLeft, setSwipesLeft] = useState(MAX_DAILY_SWIPES);
  const [allSwipes, setAllSwipes] = useState<any[]>([]);
  const [triggerSwipe, setTriggerSwipe] = useState<"left" | "right" | "super" | null>(null);
  const [undoneDealId, setUndoneDealId] = useState<string | null>(null);
  const [expandedDeal, setExpandedDeal] = useState<Deal | null>(null);

  // Undo state
  const [lastSwipedDeal, setLastSwipedDeal] = useState<{ deal: Deal; action: string } | null>(null);

  // Tutorial/modal state
  const [showHowToSwipe, setShowHowToSwipe] = useState(false);
  const [showAILearning, setShowAILearning] = useState(false);
  const [tutorialAction, setTutorialAction] = useState<"left" | "right" | "super" | null>(null);
  const [shownTutorialTypes, setShownTutorialTypes] = useState<Set<string>>(new Set());

  // Badge/Level notification state
  const [unlockedBadge, setUnlockedBadge] = useState<{ name: string; emoji: string; description: string } | null>(null);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [newLevel, setNewLevel] = useState(1);

  // Track total swipes this session for AI learning modal
  const sessionSwipeCount = useRef(0);

  const activeDeals = useMemo(
    () => (deckMode === "business" ? premiumDeals : deals),
    [deckMode, premiumDeals, deals]
  );

  // Initialize swipes left and fetch swipe history
  useEffect(() => {
    if (!profile || !user) return;
    const init = async () => {
      const today = new Date().toISOString().split("T")[0];
      let dailySwipes = profile.dailySwipesToday || 0;
      if (profile.dailySwipeDate !== today) {
        dailySwipes = 0;
        await updateProfile({
          dailySwipesToday: 0,
          dailySwipeDate: today,
        });
      }
      setSwipesLeft(isPremium ? UNLIMITED_SWIPES : MAX_DAILY_SWIPES - dailySwipes);

      const swipeHistory = await getSwipeActions(user.uid);
      setAllSwipes(swipeHistory);

      // Restore deck position
      const posKey = `deck_position_${today}_${profile.homeAirport}`;
      const stored = await getItem<number>(posKey);
      if (stored && stored > 0) setCurrentIndex(stored);
    };
    init();
  }, [profile?.id, user?.uid]);

  // Show HowToSwipe modal on mount if not shown before
  useEffect(() => {
    if (profile && !profile.howToSwipeShown && !loading) {
      setShowHowToSwipe(true);
    }
  }, [profile?.howToSwipeShown, loading]);

  // Auto-switch to business for business members — and reset to economy
  // when they're no longer on the Business tier
  useEffect(() => {
    if (profile?.subscriptionStatus === "business" && premiumDeals.length > 0) {
      setDeckMode("business");
    } else if (profile?.subscriptionStatus !== "business" && deckMode === "business") {
      setDeckMode("economy");
    }
  }, [profile?.subscriptionStatus, premiumDeals.length]);

  // When the deck runs out during normal swiping: reload to expand the pool
  useEffect(() => {
    const isOutOfDeals = activeDeals.length - currentIndex <= 0;
    if (!isOutOfDeals || loading || deckPhase !== "swiping") return;
    setDeckPhase("expanding");
    setCurrentIndex(0);
    reload();
  }, [activeDeals.length, currentIndex, loading, deckPhase]);

  // When the expansion reload finishes: decide if we have new deals or are truly done
  useEffect(() => {
    if (deckPhase !== "expanding" || loading) return;
    setDeckPhase(activeDeals.length > 0 ? "swiping" : "exhausted");
  }, [loading, deckPhase, activeDeals.length]);

  const handleDismissHowToSwipe = useCallback(async () => {
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
    setCurrentIndex((prev) => prev - 1);
    setLastSwipedDeal(null);
    setAllSwipes((prev) => prev.slice(1));
    setUndoneDealId(restoredId);
    setTimeout(() => setUndoneDealId(null), 500);
    play("undo");
  }, [lastSwipedDeal, currentIndex]);

  const handleSwipe = useCallback(
    async (action: "left" | "right" | "super") => {
      if (!profile || currentIndex >= activeDeals.length) return;
      setTriggerSwipe(null);

      if (!isPremium && swipesLeft <= 0) {
        logEvent("daily_limit_hit", { swipes_left: 0 });
        navigation.navigate("Paywall");
        return;
      }

      if (!isPremium && action === "super") {
        const savedCount = allSwipes.filter((s) => s.action === "super").length;
        if (savedCount >= MAX_SAVES) {
          logEvent("daily_limit_hit", { reason: "max_saves" });
          navigation.navigate("Paywall");
          return;
        }
      }

      const deal = activeDeals[currentIndex];
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);

      logEvent("swipe", {
        action,
        deal_type: deal.deal_type ?? null,
        destination: deal.destination,
        price: deal.price,
      });
      if (action === "super") {
        logEvent("deal_saved", {
          deal_type: deal.deal_type ?? null,
          destination: deal.destination,
          price: deal.price,
        });
      }

      // Track for undo
      setLastSwipedDeal({ deal, action });

      // Sound feedback
      if (action === "right") play("like");
      else if (action === "left") play("pass");
      else if (action === "super") play("save");

      // Show swipe tutorial toast for first swipe of each type this session
      if (!shownTutorialTypes.has(action)) {
        setTutorialAction(action);
        setShownTutorialTypes((prev) => new Set([...prev, action]));
        setTimeout(() => setTutorialAction(null), 3000);
      }

      if (!user) return;

      // Track session swipe count for AI learning modal
      sessionSwipeCount.current += 1;
      if (sessionSwipeCount.current === 4 && !profile.aiLearningShown) {
        setShowAILearning(true);
      }

      // Save position
      const today = new Date().toISOString().split("T")[0];
      const posKey =
        deckMode === "business"
          ? `business_deck_position_${today}_${profile.homeAirport}`
          : `deck_position_${today}_${profile.homeAirport}`;
      await setItem(posKey, newIndex);

      // Save full deal on super swipe
      if (action === "super") {
        await saveDeal({
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
      }

      // Record swipe
      await createSwipeAction({
        userId: user.uid,
        dealId: deal.id,
        action,
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

      // Level up every 25 swipes
      const didLevelUp = newSwipeCount % 25 === 0;
      if (didLevelUp) {
        const lvl = (profile.dealHunterLevel || 1) + 1;
        updates.dealHunterLevel = lvl;
        setNewLevel(lvl);
      }

      await updateProfile(updates);
      setSwipesLeft(isPremium ? UNLIMITED_SWIPES : MAX_DAILY_SWIPES - newDailySwipes);

      // Track swipe locally
      const newSwipeRecord = {
        dealId: deal.id,
        action,
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
    [currentIndex, activeDeals, profile, user, swipesLeft, allSwipes, isPremium, deckMode, shownTutorialTypes]
  );

  const handleButtonSwipe = (action: "left" | "right" | "super") => {
    if (!isPremium && swipesLeft <= 0) {
      navigation.navigate("Paywall");
      return;
    }
    setTriggerSwipe(action);
    setTimeout(() => setTriggerSwipe(null), 400);
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
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Image source={require("../../assets/Bluelogo.png")} style={{ width: 28, height: 28, resizeMode: "contain" }} />
          <Text style={{ fontWeight: "800", fontSize: 16, color: theme.foreground }}>
            Trace Flights
          </Text>
          {profile?.homeAirport && (
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
          )}
        </View>
        {!isPremium && (
          <TouchableOpacity onPress={() => navigation.navigate("Paywall")}>
            <Crown color={colors.brand.amber500} size={24} />
          </TouchableOpacity>
        )}
      </View>

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
            {deckMode === "business" && (
              <View
                style={{
                  position: "absolute",
                  top: 12,
                  left: 12,
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
            {activeDeals
              .slice(currentIndex, currentIndex + 3)
              .reverse()
              .map((deal, i, arr) => (
                <SwipeCard
                  key={deal.id}
                  deal={deal}
                  isTop={i === arr.length - 1}
                  onSwipe={handleSwipe}
                  onExpand={() => setExpandedDeal(deal)}
                  triggerSwipe={i === arr.length - 1 ? triggerSwipe : null}
                  isSwipeDisabled={!isPremium && swipesLeft <= 0}
                  isUndone={deal.id === undoneDealId}
                />
              ))}
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

          {/* Swipes left indicator */}
          {!isPremium && swipesLeft > 0 && swipesLeft <= 3 && (
            <Animated.View entering={FadeIn.duration(300)}>
              <TouchableOpacity
                onPress={() => navigation.navigate("Paywall")}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  alignSelf: "center",
                  gap: 6,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  backgroundColor: colors.brand.amber50,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: colors.brand.amber200,
                  marginBottom: 8,
                }}
              >
                <Text style={{ fontSize: 14 }}>⚡</Text>
                <Text style={{ fontSize: 12, fontWeight: "600", color: colors.brand.amber600 }}>
                  {swipesLeft} swipe{swipesLeft !== 1 ? "s" : ""} left today
                </Text>
              </TouchableOpacity>
            </Animated.View>
          )}

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
              onPress={() => handleButtonSwipe("super")}
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

      {/* Level Up Notification */}
      <LevelUpNotification
        level={newLevel}
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
            handleSwipe("super");
            setExpandedDeal(null);
          }}
          onBook={() => {
            if (expandedDeal.url) {
              const { Linking } = require("react-native");
              Linking.openURL(expandedDeal.url);
            }
          }}
        />
      )}

    </SafeAreaView>
  );
}
