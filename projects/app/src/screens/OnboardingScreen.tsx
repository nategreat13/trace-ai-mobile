import React, { useState, useEffect, useRef } from "react";
import { View, Text, TextInput, Alert, useColorScheme } from "react-native";
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
import { updateUserProfile as updateAuthProfile } from "../services/auth";
import { DEAL_TYPES, TIMEFRAMES, DEST_OPTIONS } from "../lib/constants";
import OnboardingStep from "../components/onboarding/OnboardingStep";
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

  const lastNameRef = useRef<TextInput>(null);
  const [step, setStep] = useState(0);
  const [showPersonality, setShowPersonality] = useState(false);
  const [generatedPersonality, setGeneratedPersonality] = useState("");
  const [existingProfileId, setExistingProfileId] = useState<string | null>(
    null,
  );

  const [data, setData] = useState({
    firstName: "",
    lastName: "",
    homeAirport: "",
    destinationPreference: "both" as "domestic" | "international" | "both",
    dealTypes: [] as string[],
    travelTimeframe: [] as string[],
  });

  useEffect(() => {
    if (profile) {
      setExistingProfileId(profile.id);
      setData((d) => ({
        ...d,
        homeAirport: profile.homeAirport || "LAX",
        destinationPreference: profile.destinationPreference || "both",
        dealTypes: profile.dealTypes || [],
        travelTimeframe: profile.travelTimeframe || [],
      }));
      setStep(1); // Skip name step for existing profiles
    }
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

  const capitalizeName = (name: string) =>
    name.trim().replace(/\b\w/g, (c) => c.toUpperCase());

  const handleContinue = async () => {
    if (!user) return;

    try {
      const firstName = data.firstName.trim()
        ? capitalizeName(data.firstName)
        : "";
      const lastName = data.lastName.trim()
        ? capitalizeName(data.lastName)
        : "";
      const fullName = [firstName, lastName].filter(Boolean).join(" ");

      if (profile?.id) {
        // Existing profile — update preferences
        const updates = {
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
        if (fullName) {
          await updateAuthProfile({ displayName: fullName });
        }

        await createUserProfile({
          userId: user.uid,
          email: user.email || "",
          displayName: fullName || "Travel Explorer",
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
      title: "What's your name?",
      subtitle: "We'd love to know you",
      canProceed:
        data.firstName.trim().length > 0 && data.lastName.trim().length > 0,
      content: (
        <View style={{ gap: 12 }}>
          <TextInput
            placeholder="First name"
            placeholderTextColor={theme.mutedForeground}
            value={data.firstName}
            onChangeText={(v) => {
              // If the system autofills a full name (e.g. "John Smith"), split it
              const trimmed = v.trim();
              const spaceIdx = trimmed.indexOf(" ");
              if (spaceIdx > 0) {
                const first = trimmed.slice(0, spaceIdx);
                const last = trimmed.slice(spaceIdx + 1).trim();
                setData((d) => ({ ...d, firstName: first, lastName: last }));
                lastNameRef.current?.focus();
              } else {
                setData((d) => ({ ...d, firstName: v }));
              }
            }}
            onSubmitEditing={() => lastNameRef.current?.focus()}
            returnKeyType="next"
            textContentType="name"
            autoComplete="name"
            autoCapitalize="words"
            style={{
              backgroundColor: theme.muted,
              borderRadius: 12,
              padding: 14,
              fontSize: 16,
              color: theme.foreground,
              borderWidth: 2,
              borderColor: theme.border,
            }}
          />
          <TextInput
            ref={lastNameRef}
            placeholder="Last name"
            placeholderTextColor={theme.mutedForeground}
            value={data.lastName}
            onChangeText={(v) => setData((d) => ({ ...d, lastName: v }))}
            onSubmitEditing={() => {
              if (data.firstName.trim().length > 0 && data.lastName.trim().length > 0) {
                setStep(1);
              }
            }}
            returnKeyType="done"
            textContentType="familyName"
            autoComplete="name-family"
            autoCapitalize="words"
            style={{
              backgroundColor: theme.muted,
              borderRadius: 12,
              padding: 14,
              fontSize: 16,
              color: theme.foreground,
              borderWidth: 2,
              borderColor: theme.border,
            }}
          />
        </View>
      ),
    },
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
              Your next adventure starts with a swipe
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
