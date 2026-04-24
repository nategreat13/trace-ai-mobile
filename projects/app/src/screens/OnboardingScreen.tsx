import React, { useState, useEffect } from "react";
import { View, Text, Alert, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { colors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";
import {
  createUserProfile,
  updateUserProfile,
  getUserProfile,
} from "../services/firestore";
import { DEAL_TYPES, TIMEFRAMES, DEST_OPTIONS } from "../lib/constants";
import OnboardingStep from "../components/onboarding/OnboardingStep";
import { logEvent } from "../lib/analytics";
import AirportInput from "../components/onboarding/AirportInput";
import OptionGrid from "../components/onboarding/OptionGrid";
import PersonalityReveal from "../components/PersonalityReveal";
import type { RootStackParamList } from "../navigation/types";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function OnboardingScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute();
  const isEditing = route.name === "EditPreferences";
  const { user, profile, setProfile } = useAuth();
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;

  const [step, setStep] = useState(0);
  const [showPersonality, setShowPersonality] = useState(false);
  const [generatedPersonality, setGeneratedPersonality] = useState("");
  const [existingProfileId, setExistingProfileId] = useState<string | null>(
    null,
  );

  const [data, setData] = useState({
    homeAirport: "",
    destinationPreference: "both" as "domestic" | "international" | "both",
    dealTypes: [] as string[],
    travelTimeframe: [] as string[],
  });

  useEffect(() => {
    logEvent("onboarding_started", { is_editing: isEditing });
    if (profile) {
      setExistingProfileId(profile.id);
      setData((d) => ({
        ...d,
        homeAirport: profile.homeAirport || "LAX",
        destinationPreference: profile.destinationPreference || "both",
        dealTypes: profile.dealTypes || [],
        travelTimeframe: profile.travelTimeframe || [],
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFinish = async () => {
    // Generate a simple personality locally (no LLM call for now)
    const types = data.dealTypes;
    let title = "The Explorer";
    let emoji = "🌍";
    let description = "Ready for any adventure";

    if (types.includes("luxury")) {
      title = "Luxury Seeker";
      emoji = "✨";
      description = "First class taste, deal hunter instincts";
    } else if (types.includes("adventure")) {
      title = "Thrill Chaser";
      emoji = "🏔️";
      description = "Off the beaten path is your happy place";
    } else if (types.includes("budget")) {
      title = "Budget Genius";
      emoji = "💰";
      description = "Maximum value, minimum spend";
    } else if (types.includes("relaxation")) {
      title = "Beach Connoisseur";
      emoji = "🏖️";
      description = "Sun, sand, and savings";
    } else if (types.includes("cultural")) {
      title = "Culture Collector";
      emoji = "🏛️";
      description = "Every city tells a story";
    } else if (types.includes("family")) {
      title = "Family Navigator";
      emoji = "👨‍👩‍👧‍👦";
      description = "Making memories that last";
    } else if (types.includes("surprise")) {
      title = "Spontaneous Explorer";
      emoji = "🎲";
      description = "Let the deals decide your destiny";
    }

    const personality = JSON.stringify({ title, description, emoji });
    setGeneratedPersonality(personality);
    setShowPersonality(true);
  };

  const handleContinue = async () => {
    if (!user) return;

    try {
      if (profile?.id) {
        // Existing profile — update preferences
        const updates: Record<string, any> = {
          homeAirport: data.homeAirport,
          destinationPreference: data.destinationPreference,
          dealTypes: data.dealTypes,
          travelTimeframe: data.travelTimeframe,
          travelPersonality: generatedPersonality,
          onboardingComplete: true,
          howToSwipeShown: true,
        };
        await updateUserProfile(profile.id, updates);
        setProfile((prev) => (prev ? { ...prev, ...updates } : prev));
      } else {
        // Brand new user — create profile
        await createUserProfile({
          userId: user.uid,
          email: user.email || "",
          displayName: "Travel Explorer",
          homeAirport: data.homeAirport,
          destinationPreference: data.destinationPreference,
          dealTypes: data.dealTypes,
          travelTimeframe: data.travelTimeframe,
          travelPersonality: generatedPersonality,
          onboardingComplete: true,
          subscriptionStatus: "free",
          trialEndDate: null,
          swipeCount: 0,
          streakDays: 1,
          dealHunterLevel: 1,
          badges: [],
          dailySwipesToday: 0,
          dailySwipeDate: new Date().toISOString().split("T")[0],
          howToSwipeShown: false,
          exploreTutorialShown: false,
          dashboardTutorialShown: false,
          aiLearningShown: false,
          profilePictureUrl: null,
        });
        const newProfile = await getUserProfile(user.uid);
        if (newProfile) setProfile(newProfile);
      }

      logEvent("onboarding_completed", {
        home_airport: data.homeAirport,
        destination_preference: data.destinationPreference,
        deal_types_count: data.dealTypes.length,
        travel_timeframe_count: data.travelTimeframe.length,
        is_editing: isEditing,
      });

      if (isEditing) {
        navigation.goBack();
      }
    } catch (error) {
      console.error("Failed to save profile:", error);
      Alert.alert("Error", "Failed to save your profile. Please try again.");
    } finally {
      setShowPersonality(false);
    }
  };

  const steps = [
    {
      title: "Where do you fly from?",
      subtitle: "Your home airport",
      canProceed: !!data.homeAirport,
      content: (
        <AirportInput
          value={data.homeAirport}
          onChange={(val) => setData({ ...data, homeAirport: val })}
        />
      ),
    },
    {
      title: "How far do you want to go?",
      subtitle: "Domestic, international, or surprise us",
      canProceed: !!data.destinationPreference,
      content: (
        <OptionGrid
          options={[...DEST_OPTIONS]}
          selected={data.destinationPreference}
          onSelect={(val) =>
            setData({
              ...data,
              destinationPreference: val as
                | "domestic"
                | "international"
                | "both",
            })
          }
        />
      ),
    },
    {
      title: "What's your travel style?",
      subtitle: "Pick all that excite you",
      canProceed: data.dealTypes.length > 0,
      content: (
        <OptionGrid
          options={[...DEAL_TYPES]}
          selected={data.dealTypes}
          onSelect={(val) => setData({ ...data, dealTypes: val as string[] })}
          multi
        />
      ),
    },
    {
      title: "When do you want to travel?",
      subtitle: "Pick all that work for you",
      canProceed: data.travelTimeframe.length > 0,
      content: (
        <OptionGrid
          options={[...TIMEFRAMES]}
          selected={data.travelTimeframe}
          onSelect={(val) =>
            setData({ ...data, travelTimeframe: val as string[] })
          }
          multi
        />
      ),
    },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flex: 1, justifyContent: "center" }}>
        {step === 0 && !existingProfileId && (
          <View style={{ alignItems: "center", marginBottom: 24 }}>
            <Text style={{ fontSize: 40, marginBottom: 8 }}>✈️</Text>
            <Text
              style={{
                fontSize: 24,
                fontWeight: "800",
                color: theme.foreground,
                marginBottom: 4,
              }}
            >
              Trace AI
            </Text>
            <Text style={{ fontSize: 12, color: theme.mutedForeground }}>
              Let's personalize your deal experience
            </Text>
          </View>
        )}

        <OnboardingStep
          step={step}
          totalSteps={steps.length}
          title={steps[step].title}
          subtitle={steps[step].subtitle}
          canProceed={steps[step].canProceed}
          onNext={() => {
            if (step < steps.length - 1) setStep(step + 1);
            else handleFinish();
          }}
          onBack={() => setStep(step - 1)}
        >
          {steps[step].content}
        </OnboardingStep>
      </View>

      <PersonalityReveal
        visible={showPersonality}
        personality={generatedPersonality}
        onContinue={handleContinue}
      />
    </SafeAreaView>
  );
}
