import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
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
  saveDeal,
  createSwipeAction,
} from "../services/firestore";
import { fetchDeals } from "../services/dealsApi";
import { auth } from "../services/firebase";
import { logMetaFirstSave } from "../lib/metaAppEvents";
import { funnelDeals } from "../lib/funnelDeals";
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
import BuildingFeed from "../components/onboarding/BuildingFeed";
import FirstSwipeDeck from "../components/onboarding/FirstSwipeDeck";
import PersonalityReveal from "../components/PersonalityReveal";
import type { Deal } from "@trace/shared";
import type { RootStackParamList } from "../navigation/types";

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Cards in the first swipe session, before "Your feed is ready". */
const FIRST_SESSION_SIZE = 8;

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

  // The first swipe session. Saves are held here and written once the
  // profile exists (handleContinue), so a user who backs out mid-deck leaves
  // nothing half-saved behind.
  const [firstSaves, setFirstSaves] = useState<Deal[]>([]);
  const [deckDone, setDeckDone] = useState(false);
  const dealFetchRef = useRef<string | null>(null);

  const startDealFetch = useCallback((airport: string, force = false) => {
    if (!airport || (!force && dealFetchRef.current === airport)) return;
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
   * Persist the first swipe session as real saves and swipe history, so the
   * deals someone picked in their first minute are waiting in Saved and the
   * deck doesn't show them again. Best-effort per deal: one failed write
   * shouldn't cost the others, and none of it may block finishing.
   */
  const saveFirstSessionDeals = async (userId: string) => {
    const realById = new Map(deals.map((d) => [d.id, d]));
    await Promise.all(
      firstSaves.map(async (shown) => {
        const deal = realById.get(shown.id) ?? shown;
        try {
          await saveDeal({
            userId,
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
          await createSwipeAction({
            userId,
            dealId: deal.id,
            action: "right",
            dealType: deal.deal_type,
            destination: deal.destination,
            continent: deal.continent || null,
            price: deal.price,
            domesticOrInternational: deal.domestic_or_international || null,
          });
        } catch (err) {
          console.warn("[onboarding] saving first-session deal failed:", err);
        }
      }),
    );
  };

  const handleContinue = async (personalityOverride?: string) => {
    if (!user) return;
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    const personality =
      personalityOverride ||
      generatedPersonality ||
      computePersonality(data.dealTypes);

    // Onboarding no longer asks for a name, so for a new user these are empty
    // and displayName falls back to the placeholder. EditPreferences still
    // carries the existing name through.
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

        // Saves first. The profile doc's creation is what routes to the
        // feed page (AuthContext picks it up the moment it's written), and
        // that page loads saves on mount — written after, they arrived too
        // late and the page fell back to "no saves". Saved deals only need
        // the uid, which the anonymous session already has.
        await saveFirstSessionDeals(user.uid);

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
          // New users aren't asked any more — their swipes say more than a
          // radio button did. "both" keeps every deck and feed unfiltered;
          // Edit preferences still sets it.
          destinationPreference: data.destinationPreference || "both",
          dealTypes: data.dealTypes,
          travelTimeframe: data.travelTimeframe,
          travelBarriers: data.travelBarriers.length
            ? data.travelBarriers
            : undefined,
          travelPersonality: personality,
          onboardingComplete: true,
          // No more hard gate (Oct 2026): new users land on "Your feed is
          // ready" once, then the free tier. See RootNavigator.
          feedReadyPending: true,
          subscriptionStatus: "free",
          trialEndDate: null,
          inTrial: false,
          swipeCount: 0,
          streakDays: 1,
          dealHunterLevel: 1,
          badges: [],
          dailySwipesToday: 0,
          dailySwipeWindowStart: new Date().toISOString(),
          // They learned to swipe in the first session; the deck's "How it
          // works" sheet would teach them what they just did eight times.
          howToSwipeShown: true,
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
        first_session_saves: firstSaves.length,
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
    /** Only in EditPreferences — new users aren't asked (their swipes are). */
    editOnly?: boolean;
    /** Keep the CTA disabled this long after the beat appears. */
    holdMs?: number;
    /**
     * Runs when the CTA is pressed; advancing waits on it and is cancelled
     * if it resolves false.
     */
    submit?: () => Promise<boolean>;
  };

  /**
   * The name screen is GONE (Oct 2026), not moved.
   *
   * It cost a fifth to a quarter of everyone who reached it, wherever it sat.
   * At the front it was a small ask before anything else; moved to the end in
   * 1.10.0 it read as the first page of a sign-up form with the account step
   * immediately after — two asks in a row — and 25% of people who reached it
   * never got to the account step. 1.10.0's onboarding completion fell 47% →
   * 37% on that change alone.
   *
   * `firstName` / `lastName` stay on `data` because EditPreferences still
   * prefills them and the save path still writes them; for a new user they
   * are simply empty, `displayName` falls back to "Travel Explorer", and the
   * feed page greets them without a name (FeedReveal already handles that).
   * Profile → Edit is where a name gets set now, if ever.
   */
  // The first session's cards, at funnel prices (Trevor, Oct 21): the same
  // showcase set the old demo deck used — real destinations from their
  // airport, priced by lib/funnelDeals. Saves are written with the real fare
  // (see saveFirstSessionDeals), so the app past the paywall never shows an
  // invented price.
  const firstDeck = useMemo(() => funnelDeals(deals, {}, FIRST_SESSION_SIZE), [deals]);

  const beats: Beat[] = [
    {
      key: "airport",
      title: "Which airport do you fly out of?",
      subtitle: "Every deal starts here. A city, airport code or zip works.",
      canProceed: !!data.homeAirport,
      content: (
        <AirportInput
          value={data.homeAirport}
          onChange={(val) => setData({ ...data, homeAirport: val })}
        />
      ),
    },
    {
      // The product, straight away (Oct 2026). Every ad ends on "download it
      // free and start swiping"; the old flow put ten screens of questions
      // between the download and the first swipe, then a demo deck with
      // showcase prices. This is the real deck on real fares, and what they
      // save here is saved for real.
      key: "swipe",
      title: "Swipe right on your next trip",
      subtitle: data.homeAirport
        ? `Today's best deals from ${data.homeAirport}`
        : "Today's best deals from your airport",
      canProceed: deckDone,
      ctaLabel: "See my feed",
      newUserOnly: true,
      content: deckDone ? (
        <View style={{ alignItems: "center", paddingTop: 40, gap: 8 }}>
          <Text style={{ fontSize: 40 }}>✈️</Text>
          <Text style={{ fontSize: 18, fontWeight: "800", color: theme.foreground }}>
            {firstSaves.length > 0
              ? `${firstSaves.length} trip${firstSaves.length === 1 ? "" : "s"} saved`
              : "Your feed is learning what you like"}
          </Text>
        </View>
      ) : (
        <FirstSwipeDeck
          deals={firstDeck}
          loading={!dealsReady}
          onRetry={() => startDealFetch(data.homeAirport, true)}
          onSwipe={(deal, saved, index) => {
            logEvent("first_session_swipe", {
              saved,
              index,
              destination: deal.destination,
              shown_discount_pct: Math.round(deal.discount_pct || 0),
              shown_price: Math.round(deal.price || 0),
            });
            if (saved) logMetaFirstSave(deal);
          }}
          onDone={(saved) => {
            setFirstSaves(saved);
            setDeckDone(true);
            logEvent("first_session_done", {
              saved_count: saved.length,
              deck_size: firstDeck.length,
            });
            setStep((n) => n + 1);
          }}
        />
      ),
    },
    {
      key: "destination",
      title: "How far do you want to go?",
      subtitle: "Domestic, international, or both",
      canProceed: !!data.destinationPreference,
      editOnly: true,
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
      editOnly: true,
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
      editOnly: true,
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
      // Optional now. It powers the personal line on the feed page ("You
      // said flights cost too much — these average 61% off"), which is worth
      // one tap, but not worth losing anyone over.
      key: "barrier",
      title: "One quick question",
      subtitle: "What's stopping you from going? Pick any that ring true.",
      canProceed: true,
      ctaLabel: data.travelBarriers.length > 0 ? "Continue" : "Skip",
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
      key: "building",
      canProceed: true,
      newUserOnly: true,
      fullBleed: true,
      content: <BuildingFeed ready={dealsReady} onDone={() => goNext()} />,
    },
  ];

  // EditPreferences reuses this screen to change travel prefs — it should be
  // the questions and nothing else. No name step, no interstitials, no
  // reveal: someone tweaking their timeframe doesn't need to be re-sold.
  const activeBeats = isEditing
    ? beats.filter((b) => !b.newUserOnly)
    : beats.filter((b) => !b.editOnly);

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
          scrollable={beat.key !== "airport" && beat.key !== "swipe"}
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
