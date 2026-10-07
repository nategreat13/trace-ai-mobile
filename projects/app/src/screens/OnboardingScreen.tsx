import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  Alert,
  useColorScheme,
  Platform,
} from "react-native";
import Constants from "expo-constants";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { colors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";
import {
  createUserProfile,
  updateUserProfile,
  getUserProfile,
} from "../services/firestore";
import { fetchDeals } from "../services/dealsApi";
import { linkEmailPassword, login } from "../services/auth";
import { auth } from "../services/firebase";
import { trackSignup } from "../services/trackingApi";
import {
  DEAL_TYPES,
  TIMEFRAMES,
  DEST_OPTIONS,
  BARRIERS,
} from "../lib/constants";
import OnboardingChrome from "../components/onboarding/OnboardingChrome";
import { logEvent } from "../lib/analytics";
import AirportInput from "../components/onboarding/AirportInput";
import OptionGrid from "../components/onboarding/OptionGrid";
import OptionList from "../components/onboarding/OptionList";
import AccountBeat, {
  AccountDraft,
} from "../components/onboarding/AccountBeat";
import CadenceBeat from "../components/onboarding/CadenceBeat";
import SocialProofBeat from "../components/onboarding/SocialProofBeat";
import BuildingFeed from "../components/onboarding/BuildingFeed";
import ProductDemoBeat from "../components/onboarding/ProductDemoBeat";
import PersonalityReveal from "../components/PersonalityReveal";
import type { Deal } from "@trace/shared";
import type { RootStackParamList } from "../navigation/types";

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** "john  smith" → "John Smith" — capitalize each word, collapse spaces. */
function capitalizeName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Derive the travel-personality blob from the selected deal types.
 *
 * Pulled out of `handleFinish` and made pure so the new flow can compute it
 * and hand it straight to `handleContinue`. It used to live in component
 * state, which meant the save read a value the same tick had just set — fine
 * while a modal sat between the two, a race once the modal went away.
 */
function computePersonality(types: string[]): string {
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

  return JSON.stringify({ title, description, emoji });
}

export default function OnboardingScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute();
  const isEditing = route.name === "EditPreferences";
  const { user, profile, setProfile } = useAuth();
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;

  // EditPreferences opens on its second question ("How far do you want to
  // go?"), with Back reaching the airport. Its list has no name step: the
  // user set their name when they signed up.
  const [step, setStep] = useState(isEditing ? 1 : 0);
  const [showPersonality, setShowPersonality] = useState(false);
  const [generatedPersonality, setGeneratedPersonality] = useState("");
  const [existingProfileId, setExistingProfileId] = useState<string | null>(
    null,
  );
  const lastNameRef = useRef<TextInput>(null);
  // Guards against a double-tap on the final CTA firing handleContinue twice
  // before `profile` state updates from the first call — without this, both
  // calls see profile?.id as falsy and both create a new profile doc.
  const isSubmittingRef = useRef(false);

  // ── Live deal fetch backing the reveal ────────────────────────────────
  // Kicked off the moment they leave the airport step, so it runs behind the
  // four questions that follow and has ~30-60s of cover before BuildingFeed
  // starts waiting on it. `dealsReady` flips on success *or* failure — a
  // dead API must not strand the user on the progress screen.
  const [deals, setDeals] = useState<Deal[]>([]);
  const [dealsReady, setDealsReady] = useState(false);

  // The account step's draft. Held here rather than inside AccountBeat so the
  // beat's `canProceed` and `submit` can both see it.
  const [account, setAccount] = useState<AccountDraft>({
    email: "",
    password: "",
  });
  const [accountError, setAccountError] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [emailTaken, setEmailTaken] = useState(false);
  const dealFetchRef = useRef<string | null>(null);

  const startDealFetch = useCallback((airport: string) => {
    if (!airport || dealFetchRef.current === airport) return;
    dealFetchRef.current = airport;
    setDealsReady(false);
    fetchDeals(airport)
      .then((res) => setDeals(res ?? []))
      .catch((err) => {
        console.warn("[onboarding] deal prefetch failed:", err);
        setDeals([]);
      })
      .finally(() => setDealsReady(true));
  }, []);

  const [data, setData] = useState({
    firstName: "",
    lastName: "",
    homeAirport: "",
    // No pre-selection: each preference starts empty so the user makes a real
    // choice. The per-step `canProceed` gates already require a selection, so
    // empty defaults turn "passively accepted" into "actively chosen" — the
    // v1.3.3 cohort showed the pre-checked catch-alls ("both"/"surprise"/
    // "no_preference") were rarely removed, polluting the targeting signal.
    destinationPreference: "" as "" | "domestic" | "international" | "both",
    dealTypes: [] as string[],
    travelTimeframe: [] as string[],
    travelBarriers: [] as string[],
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
        destinationPreference: profile.destinationPreference || "",
        dealTypes: profile.dealTypes || [],
        travelTimeframe: profile.travelTimeframe || [],
        travelBarriers: profile.travelBarriers || [],
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Editing path only — keeps the original personality modal. */
  const handleFinish = () => {
    const personality = computePersonality(data.dealTypes);
    setGeneratedPersonality(personality);
    setShowPersonality(true);
  };

  /**
   * Turn the anonymous session into a real account. Returns false to keep the
   * user on this step — the beat's `submit` gate then blocks advancing, so a
   * failure never writes a profile or moves them on.
   */
  const linkAccount = async (): Promise<boolean> => {
    const email = account.email.trim();
    if (!email || account.password.length < 6) {
      setAccountError("Enter an email and a password of at least 6 characters.");
      return false;
    }
    setLinking(true);
    setAccountError(null);
    setEmailTaken(false);
    try {
      const fullName = [
        data.firstName.trim() ? capitalizeName(data.firstName) : "",
        data.lastName.trim() ? capitalizeName(data.lastName) : "",
      ]
        .filter(Boolean)
        .join(" ");
      await linkEmailPassword(email, account.password, fullName || undefined);
      logEvent("signup_completed", { method: "email", at: "onboarding_end" });

      // Meta CAPI CompleteRegistration, same as the old front-door signup
      // fired. Fire-and-forget — it must never hold up the feed.
      let country: string | null = null;
      try {
        const locale = Intl.DateTimeFormat().resolvedOptions().locale;
        if (locale && locale.includes("-")) country = locale.split("-")[1];
      } catch {
        /* best-effort */
      }
      const current = auth.currentUser;
      if (current) {
        trackSignup({ userId: current.uid, email, country });
      }
      return true;
    } catch (err: any) {
      const code = err?.code || "";
      if (code === "auth/email-already-in-use") setEmailTaken(true);
      setAccountError(
        code === "auth/email-already-in-use"
          ? "That email already has a Trace account."
          : code === "auth/invalid-email"
            ? "That doesn't look like a valid email address."
            : code === "auth/weak-password"
              ? "Pick a password with at least 6 characters."
              : err?.message || "Could not create your account. Try again.",
      );
      logEvent("signup_failed", { method: "email", code });
      return false;
    } finally {
      setLinking(false);
    }
  };

  /**
   * Recovery for an email that already has an account. Most people retyping
   * their usual email type their usual password with it, so try signing them
   * in with exactly what's in the form — on success RootNavigator routes to
   * whatever their existing profile says, which for a finished account is
   * their feed.
   *
   * The answers they just gave are lost in that case. That's the right trade:
   * the account they already have has its own preferences, and the
   * alternative is leaving them holding an email they can't use.
   */
  const signInInstead = async () => {
    setLinking(true);
    setAccountError(null);
    try {
      await login(account.email.trim(), account.password);
      logEvent("login", { method: "email", at: "onboarding_end" });
    } catch {
      setAccountError(
        "That password doesn't match the account for this email. Try again, or reset it from the sign-in screen.",
      );
    } finally {
      setLinking(false);
    }
  };

  const handleContinue = async (personalityOverride?: string) => {
    if (!user) return;
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    const personality =
      personalityOverride ||
      generatedPersonality ||
      computePersonality(data.dealTypes);

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
          travelPersonality: personality,
          onboardingComplete: true,
          howToSwipeShown: true,
        };
        if (data.travelBarriers.length)
          updates.travelBarriers = data.travelBarriers;
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
          email: auth.currentUser?.email || user.email || "",
          displayName: fullName || "Travel Explorer",
          // Persist first/last name separately too. UserProfile schema
          // already supports these optional fields; the userProfile-
          // creation Cloud Function trigger reads them and forwards
          // to Meta CAPI as the "Lead" event's user_data — which lifts
          // match rate by 10-20% over email-only matching.
          firstName: data.firstName.trim()
            ? capitalizeName(data.firstName)
            : undefined,
          lastName: data.lastName.trim()
            ? capitalizeName(data.lastName)
            : undefined,
          homeAirport: data.homeAirport,
          // Non-empty by here — the destination step's `canProceed` gate
          // blocks finishing onboarding until a choice is made.
          destinationPreference:
            data.destinationPreference as "domestic" | "international" | "both",
          dealTypes: data.dealTypes,
          travelTimeframe: data.travelTimeframe,
          travelBarriers: data.travelBarriers.length
            ? data.travelBarriers
            : undefined,
          travelPersonality: personality,
          onboardingComplete: true,
          // Everyone who completes the rebuilt flow lands behind the
          // subscription gate (see RootNavigator). Stamped per-user rather
          // than inferred app-wide so the ~450 accounts that predate this
          // change keep their free access.
          accessGate: "subscription_required",
          subscriptionStatus: "free",
          trialEndDate: null,
          inTrial: false,
          swipeCount: 0,
          streakDays: 1,
          dealHunterLevel: 1,
          badges: [],
          dailySwipesToday: 0,
          dailySwipeWindowStart: new Date().toISOString(),
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
          // Marketing version (expo.version) of the bundle the user signed up
          // on — updates with OTAs, so it marks the "code version" they joined
          // with (e.g. "1.3.1" = first version with the deal-detail/click
          // events). Used as the analytics cohort key.
          firstAppVersion: (Constants.expoConfig?.version as string | undefined) ?? undefined,
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
        travel_barriers: data.travelBarriers.join(",") || null,
        is_editing: isEditing,
        // Reveal quality — if conversion diverges by this, the reveal is
        // doing the persuading and thin feeds need their own treatment.
        reveal_deal_count: deals.length,
      });

      // NOTE — push ordering is still wrong for this flow, deliberately left
      // alone here rather than changed as a side effect of the rebuild.
      //
      // The soft prompt is triggered by useTriggerSoftPrompt inside MainTabs
      // at 3 swipes OR first save, while usePostOnboardingPaywall fires on
      // TabNavigator mount. So today the order is:
      //     onboarding → paywall → (later) push ask
      // which means we sell deal alerts to someone who cannot yet receive
      // them, and the 72-hour trial window opens with no way to reach them.
      //
      // Moving the ask to just before the paywall is its own change with its
      // own reach tradeoff (see the history in useTriggerSoftPrompt — this
      // trigger has already moved twice and the last "obvious" improvement
      // halved reach). Worth doing, worth measuring separately.

      if (isEditing) {
        navigation.goBack();
      }
    } catch (error) {
      console.error("Failed to save profile:", error);
      Alert.alert("Error", "Failed to save your profile. Please try again.");
    } finally {
      setShowPersonality(false);
      isSubmittingRef.current = false;
    }
  };

  // ── Beats ─────────────────────────────────────────────────────────────
  // A "beat" is any full screen in the flow — question or not. The rebuild's
  // whole thesis is that the non-question beats (cadence, proof, build,
  // reveal) are what turn five form fields into something worth finishing,
  // so they're first-class entries here rather than special cases bolted on
  // around a question array.
  type Beat = {
    key: string;
    title?: string;
    subtitle?: string;
    canProceed: boolean;
    ctaLabel?: string;
    content: React.ReactNode;
    /** Renders its own full screen — chrome and CTA suppressed. */
    fullBleed?: boolean;
    /** Excluded from the EditPreferences flow. */
    newUserOnly?: boolean;
    /** Keep the CTA disabled this long after the beat appears. */
    holdMs?: number;
    /**
     * Runs when the CTA is pressed; advancing waits on it and is cancelled
     * if it resolves false. Used by the account beat, which has to actually
     * create the account before onboarding can be written against it.
     */
    submit?: () => Promise<boolean>;
  };

  const nameBeat: Beat = {
    key: "name",
    title: "What's your name?",
    subtitle: "So your feed feels like yours",
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
            borderRadius: 14,
            padding: 16,
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
          returnKeyType="done"
          textContentType="familyName"
          autoComplete="name-family"
          autoCapitalize="words"
          style={{
            backgroundColor: theme.muted,
            borderRadius: 14,
            padding: 16,
            fontSize: 16,
            color: theme.foreground,
            borderWidth: 2,
            borderColor: theme.border,
          }}
        />
      </View>
    ),
  };

  /**
   * The answers so far, handed to every beat that shows deals so the whole
   * funnel ranks on the same thing. Partial by design — the cadence beat runs
   * before the preference questions, and an empty prefs object simply means
   * "no signal yet" to the ranker.
   */
  const beatPrefs = useMemo(
    () => ({
      dealTypes: data.dealTypes,
      travelTimeframe: data.travelTimeframe,
      travelBarriers: data.travelBarriers,
    }),
    [data.dealTypes, data.travelTimeframe, data.travelBarriers],
  );

  const beats: Beat[] = [
    {
      key: "airport",
      title: "Where do you fly from?",
      subtitle: "Every deal we show you starts here",
      canProceed: !!data.homeAirport,
      content: (
        <AirportInput
          value={data.homeAirport}
          onChange={(val) => setData({ ...data, homeAirport: val })}
        />
      ),
    },
    {
      key: "cadence",
      title: "Deals don't wait for you",
      subtitle: "So we watch them for you instead",
      canProceed: true,
      newUserOnly: true,
      content: <CadenceBeat deals={deals} prefs={beatPrefs} />,
    },
    {
      key: "destination",
      title: "How far do you want to go?",
      subtitle: "Domestic, international, or both",
      canProceed: !!data.destinationPreference,
      content: (
        <OptionList
          options={DEST_OPTIONS}
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
      key: "style",
      title: "What kind of trip?",
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
      key: "timeframe",
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
    {
      key: "barrier",
      title: "What's stopping you from going?",
      subtitle: "Pick everything that rings true",
      canProceed: data.travelBarriers.length > 0,
      newUserOnly: true,
      content: (
        <OptionList
          options={BARRIERS}
          selected={data.travelBarriers}
          onSelect={(val) =>
            setData({ ...data, travelBarriers: val as string[] })
          }
          multi
        />
      ),
    },
    {
      key: "demo",
      title: "Swipe right on your next trip",
      subtitle: "Go on, try it.",
      canProceed: true,
      newUserOnly: true,
      content: <ProductDemoBeat deals={deals} prefs={beatPrefs} />,
    },
    {
      key: "proof",
      title: "Join 30,000+ travelers",
      subtitle: "They stopped hunting for fares. You're one step away.",
      canProceed: true,
      newUserOnly: true,
      ctaLabel: "Build my feed",
      content: (
        <SocialProofBeat
          destinationCount={
            dealsReady && deals.length
              ? new Set(deals.map((d) => d.destination).filter(Boolean)).size
              : null
          }
          homeAirport={data.homeAirport}
        />
      ),
    },
    {
      key: "building",
      canProceed: true,
      newUserOnly: true,
      fullBleed: true,
      content: (
        <BuildingFeed
          ready={dealsReady}
          // Advance rather than finish: the name and account steps follow.
          onDone={() => goNext()}
        />
      ),
    },
    // The name comes after the feed is built, next to the account ask, rather
    // than first. As the opening screen it lost 19% of everyone who tapped Get
    // Started in the first week of 1.9.0: a form field before they'd seen
    // anything. Here it's one more detail for a feed that already exists.
    nameBeat,
    {
      // The account ask, last instead of second. See AccountBeat.
      key: "account",
      title: "Save your feed",
      subtitle: "So it's here the next time you open Trace",
      canProceed:
        account.email.trim().length > 3 && account.password.length >= 6 && !linking,
      newUserOnly: true,
      ctaLabel: "Create my account",
      submit: linkAccount,
      content: (
        <AccountBeat
          value={account}
          onChange={setAccount}
          error={accountError}
          busy={linking}
          firstName={data.firstName.trim() || undefined}
          onSignInInstead={emailTaken ? signInInstead : undefined}
        />
      ),
    },
  ];

  // EditPreferences reuses this screen to change travel prefs — it should be
  // the questions and nothing else. No name step, no interstitials, no
  // reveal: someone tweaking their timeframe doesn't need to be re-sold.
  const activeBeats = (
    isEditing ? beats.filter((b) => !b.newUserOnly && b.key !== "name") : beats
  ).filter(
    // Only anonymous sessions need an account created. Someone who signed in
    // and then abandoned onboarding already has one.
    (b) => b.key !== "account" || user?.isAnonymous === true,
  );

  const safeStep = Math.min(step, activeBeats.length - 1);
  const beat = activeBeats[safeStep];
  const isLast = safeStep === activeBeats.length - 1;

  // Log every beat view so drop-off is readable per screen. The whole bet is
  // that a longer flow converts better overall; without per-beat data a drop
  // in completion is uninterpretable.
  useEffect(() => {
    if (!beat) return;
    logEvent("onboarding_step_viewed", {
      step_key: beat.key,
      step_index: safeStep,
      total_steps: activeBeats.length,
      is_editing: isEditing,
    });
  }, [beat?.key]);

  // Start the deal prefetch the moment an airport is picked — while they're
  // still looking at the picker, rather than once they've tapped Continue.
  // Those couple of seconds come straight off whatever BuildingFeed would
  // otherwise have to wait for at the end.
  useEffect(() => {
    if (isEditing) return;
    if (!data.homeAirport) return;
    startDealFetch(data.homeAirport);
  }, [data.homeAirport, isEditing, startDealFetch]);

  const goNext = async () => {
    if (beat?.submit) {
      const ok = await beat.submit();
      if (!ok) return;
    }
    if (!isLast) {
      setStep(safeStep + 1);
      return;
    }
    if (isEditing) handleFinish();
    else handleContinue(computePersonality(data.dealTypes));
  };

  const goBack = () => {
    // In editing mode the first visible beat is the entry point — back there
    // dismisses the modal rather than revealing a hidden step.
    if (safeStep === 0) {
      if (isEditing) navigation.goBack();
      return;
    }
    // Never walk backwards into the progress screen: it would restart the
    // counter and re-fire its completion, pushing the user forward again.
    const target = activeBeats[safeStep - 1];
    setStep(target?.key === "building" ? safeStep - 2 : safeStep - 1);
  };

  if (!beat) return null;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {beat.fullBleed ? (
        beat.content
      ) : (
        <OnboardingChrome
          progress={(safeStep + 1) / activeBeats.length}
          title={beat.title}
          subtitle={beat.subtitle}
          canProceed={beat.canProceed}
          holdMs={beat.holdMs ?? 0}
          holdKey={beat.key}
          ctaLabel={beat.ctaLabel ?? (isLast && isEditing ? "Save" : "Continue")}
          onNext={goNext}
          onBack={safeStep > 0 || isEditing ? goBack : undefined}
          scrollable={beat.key !== "airport"}
        >
          {beat.content}
        </OnboardingChrome>
      )}

      <PersonalityReveal
        visible={showPersonality}
        personality={generatedPersonality}
        onContinue={() => handleContinue()}
      />
    </View>
  );
}
