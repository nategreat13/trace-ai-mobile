import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Alert,
  useColorScheme,
  Platform,
} from "react-native";
import * as Updates from "expo-updates";
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

/** "john  smith" → "John Smith" — capitalize each word, collapse spaces. */
function capitalizeName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function OnboardingScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute();
  const isEditing = route.name === "EditPreferences";
  const { user, profile, setProfile } = useAuth();
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;

  // When editing preferences, skip the name step (step 0) entirely —
  // the user already set their name during initial onboarding and
  // doesn't need to re-enter it just to update travel preferences.
  const [step, setStep] = useState(isEditing ? 1 : 0);
  const [showPersonality, setShowPersonality] = useState(false);
  const [generatedPersonality, setGeneratedPersonality] = useState("");
  const [existingProfileId, setExistingProfileId] = useState<string | null>(
    null,
  );
  const lastNameRef = useRef<TextInput>(null);

  const [data, setData] = useState({
    firstName: "",
    lastName: "",
    homeAirport: "",
    destinationPreference: "both" as "domestic" | "international" | "both",
    dealTypes: ["surprise"] as string[],
    travelTimeframe: ["no_preference"] as string[],
  });

  useEffect(() => {
    logEvent("onboarding_started", { is_editing: isEditing });
    if (profile) {
      setExistingProfileId(profile.id);
      // Pre-populate the name step from the existing displayName so an
      // editing user sees their current name (and it's preserved on save).
      const nameParts = (profile.displayName || "").trim().split(/\s+/);
      setData((d) => ({
        ...d,
        firstName: nameParts[0] || "",
        lastName: nameParts.slice(1).join(" ") || "",
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

    // The name step is required (canProceed gates it), so by the time
    // we reach here both fields are filled.
    const fullName = [
      data.firstName.trim() ? capitalizeName(data.firstName) : "",
      data.lastName.trim() ? capitalizeName(data.lastName) : "",
    ]
      .filter(Boolean)
      .join(" ");

    try {
      if (profile?.id) {
        // Existing profile — update preferences.
        // When editing, the name step is skipped so preserve the existing
        // displayName unchanged; only update it if we actually have a new value.
        const updates: Record<string, any> = {
          displayName: isEditing
            ? (profile.displayName || "Travel Explorer")
            : (fullName || profile.displayName || "Travel Explorer"),
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
        // Brand new user — create profile. Stamp first-touch cohort
        // metadata (platform, app version, country) at creation time so
        // we can later slice "Q2 2026 iOS users from US" without needing
        // to backfill anything.
        let locale: string | null = null;
        try {
          locale = Intl.DateTimeFormat().resolvedOptions().locale ?? null;
        } catch {
          locale = null;
        }
        const country =
          locale && locale.includes("-") ? locale.split("-")[1] : undefined;
        const now = new Date();

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
          firstSeenAt: now,
          firstPlatform:
            Platform.OS === "ios" || Platform.OS === "android" || Platform.OS === "web"
              ? Platform.OS
              : undefined,
          firstAppVersion: (Updates.runtimeVersion as string | undefined) ?? undefined,
          country,
          lastSeenAt: now,
          lifetimeRevenueCents: 0,
          everUsedFreeTrial: false,
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

      // Push permission handling moved to NotificationsPermissionScreen,
      // which renders automatically after onboardingComplete=true if the
      // user hasn't been asked yet (see RootNavigator gate). Doing it
      // there gives us a soft-prompt step before the OS dialog, which
      // dramatically improves accept rate.

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
              if (
                data.firstName.trim().length > 0 &&
                data.lastName.trim().length > 0
              ) {
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
      title: "What's your home airport?",
      subtitle: "Choose your home airport",
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
          numColumns={3}
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
          numColumns={3}
        />
      ),
    },
  ];

  // When editing, the name step (index 0) is hidden so we offset the
  // displayed step number and total so the progress bar stays accurate.
  const displayStep = isEditing ? step - 1 : step;
  const displayTotal = isEditing ? steps.length - 1 : steps.length;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <OnboardingStep
        step={displayStep}
        totalSteps={displayTotal}
        title={steps[step].title}
        subtitle={steps[step].subtitle}
        canProceed={steps[step].canProceed}
        onNext={() => {
          if (step < steps.length - 1) setStep(step + 1);
          else handleFinish();
        }}
        onBack={() => {
          // When editing, step 1 is the first visible step — pressing back
          // should dismiss the modal, not reveal the hidden name step.
          if (isEditing && step === 1) navigation.goBack();
          else setStep(step - 1);
        }}
      >
        {steps[step].content}
      </OnboardingStep>

      <PersonalityReveal
        visible={showPersonality}
        personality={generatedPersonality}
        onContinue={handleContinue}
      />
    </View>
  );
}
