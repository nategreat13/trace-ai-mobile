import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  useColorScheme,
  Modal,
  ScrollView,
} from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Crown, X, Heart, Undo2 } from "lucide-react-native";
import { colors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";
import { useDealFetch } from "../hooks/useDealFetch";
import { useProfile } from "../hooks/useProfile";
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
import ExternalLinkDisclosure from "../components/ExternalLinkDisclosure";
import type { RootStackParamList } from "../navigation/types";
import type { Deal } from "@trace/shared";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function SwipeDeckScreen() {
  const navigation = useNavigation<Nav>();
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;
  const { user, profile, isPremium } = useAuth();
  const { updateProfile } = useProfile();
  const { deals, premiumDeals, loading, showingAllDeals } = useDealFetch(
    profile ? { ...profile, id: profile.id! } : null
  );

  const [deckMode, setDeckMode] = useState<"economy" | "business">("economy");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [swipesLeft, setSwipesLeft] = useState(MAX_DAILY_SWIPES);
  const [allSwipes, setAllSwipes] = useState<any[]>([]);
  const [triggerSwipe, setTriggerSwipe] = useState<"left" | "right" | "super" | null>(null);
  const [expandedDeal, setExpandedDeal] = useState<Deal | null>(null);
  const [showUpgradePopup, setShowUpgradePopup] = useState(false);
  const [showDisclosure, setShowDisclosure] = useState(false);

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

  // Auto-switch to business for business members
  useEffect(() => {
    if (profile?.subscriptionStatus === "business" && premiumDeals.length > 0) {
      setDeckMode("business");
    }
  }, [profile?.subscriptionStatus, premiumDeals.length]);

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
    setCurrentIndex((prev) => prev - 1);
    setLastSwipedDeal(null);
    // Remove last swipe from local tracking
    setAllSwipes((prev) => prev.slice(1));
  }, [lastSwipedDeal, currentIndex]);

  const handleSwipe = useCallback(
    async (action: "left" | "right" | "super") => {
      if (!profile || !user || currentIndex >= activeDeals.length) return;
      setTriggerSwipe(null);

      if (!isPremium && swipesLeft <= 0) {
        setShowUpgradePopup(true);
        return;
      }

      if (!isPremium && action === "super") {
        const savedCount = allSwipes.filter((s) => s.action === "super").length;
        if (savedCount >= MAX_SAVES) {
          setShowUpgradePopup(true);
          return;
        }
      }

      const deal = activeDeals[currentIndex];
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);

      // Track for undo
      setLastSwipedDeal({ deal, action });

      // Show swipe tutorial toast for first swipe of each type this session
      if (!shownTutorialTypes.has(action)) {
        setTutorialAction(action);
        setShownTutorialTypes((prev) => new Set([...prev, action]));
        setTimeout(() => setTutorialAction(null), 3000);
      }

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
      setShowUpgradePopup(true);
      return;
    }
    setTriggerSwipe(action);
    setTimeout(() => setTriggerSwipe(null), 400);
  };

  if (loading) {
    const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: theme.background, justifyContent: "center", alignItems: "center" }}
        edges={["top", "left", "right"]}
      >
        <ActivityIndicator size="large" color={colors.brand.traceRed} />
        <Text style={{ marginTop: 12, color: theme.mutedForeground, fontSize: 14 }}>
          Finding the best deals for {today}
        </Text>
      </SafeAreaView>
    );
  }

  const remaining = activeDeals.length - currentIndex;
  const isOutOfDeals = remaining <= 0;
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
          <TouchableOpacity onPress={() => setShowUpgradePopup(true)}>
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
      {isOutOfDeals ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 24 }}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>🎉</Text>
          <Text style={{ fontSize: 24, fontWeight: "800", color: theme.foreground, marginBottom: 8 }}>
            You've Seen Them All!
          </Text>
          <Text style={{ color: theme.mutedForeground, fontSize: 14, textAlign: "center", marginBottom: 32 }}>
            Check your saved deals or come back later
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate("MainTabs", { screen: "Dashboard" })}
            style={{
              backgroundColor: theme.foreground,
              borderRadius: 999,
              paddingHorizontal: 24,
              paddingVertical: 14,
            }}
          >
            <Text style={{ color: theme.background, fontSize: 14, fontWeight: "600" }}>
              View Dashboard
            </Text>
          </TouchableOpacity>
        </View>
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
                onPress={() => setShowUpgradePopup(true)}
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
              paddingTop: 20,
              paddingBottom: 8,
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

      {/* Upgrade popup modal */}
      <Modal visible={showUpgradePopup} transparent animationType="fade">
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setShowUpgradePopup(false)}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.6)",
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 16,
          }}
        >
          <View
            style={{
              backgroundColor: theme.card,
              borderRadius: 24,
              padding: 28,
              width: "100%",
              maxWidth: 380,
              borderWidth: 1,
              borderColor: theme.border,
            }}
          >
            <View style={{ alignItems: "center", gap: 16 }}>
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: colors.brand.amber500,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Crown color="#fff" size={32} />
              </View>
              <Text style={{ fontSize: 24, fontWeight: "900", color: theme.foreground }}>
                Unlock Unlimited Swipes
              </Text>
              <Text style={{ color: theme.mutedForeground, fontSize: 14, textAlign: "center" }}>
                Free users get {MAX_DAILY_SWIPES} swipes per day. Upgrade to Premium and never miss
                a deal.
              </Text>
              {["Unlimited daily swipes", "Unlimited saved deals", "Full Explore access", "Priority deal alerts"].map(
                (f, i) => (
                  <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 10, width: "100%" }}>
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        backgroundColor: colors.brand.amber500,
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>✓</Text>
                    </View>
                    <Text style={{ color: theme.foreground, fontSize: 14 }}>{f}</Text>
                  </View>
                )
              )}
              <TouchableOpacity
                onPress={() => {
                  setShowUpgradePopup(false);
                  setShowDisclosure(true);
                }}
                style={{
                  width: "100%",
                  paddingVertical: 14,
                  borderRadius: 16,
                  backgroundColor: colors.brand.amber500,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>
                  View Plans
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowUpgradePopup(false)}>
                <Text style={{ color: theme.mutedForeground, fontSize: 14 }}>Maybe later</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      <ExternalLinkDisclosure
        visible={showDisclosure}
        onClose={() => setShowDisclosure(false)}
        plan="premium"
      />
    </SafeAreaView>
  );
}
