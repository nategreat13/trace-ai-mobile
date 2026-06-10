import { useEffect, useRef } from "react";
import { InteractionManager } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthContext";
import { useFreeTrial } from "../context/TrialContext";
import { useProfile } from "./useProfile";
import type { RootStackParamList } from "../navigation/types";

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Auto-open the paywall once, right after onboarding completes. Targets the
 * exposure gap from the v1.3.2 cohort analysis: only 14% of completed signups
 * ever saw the paywall, so trial offer reach was ~14% by default. Forcing one
 * paywall view at the end of onboarding takes that to ~100% without any
 * user-flow change.
 *
 * Gates:
 *   - profile.postOnboardingPaywallShown is false/missing (one-shot per user)
 *   - user is not already premium
 *   - the free-trial signal resolved to `available: true` — this doubles as
 *     the kill-switch (RevenueCat's `trials_enabled` metadata flag turns it
 *     off instantly app-wide via the same path the paywall trial CTA uses)
 *     AND ensures we only force a paywall view when there's a real trial
 *     offer to show. No trial = no involuntary paywall.
 *
 * Once the gates are met we navigate to Paywall, then flip the flag
 * optimistically so a remount/re-render can't re-trigger it before the
 * Firestore write lands.
 *
 * Navigation is deferred via InteractionManager.runAfterInteractions plus a
 * short timeout. Without this, the Paywall (a `presentation: "modal"` sheet
 * on iOS) was pushed before MainTabs / SwipeDeck had finished their first
 * layout pass, and the underlying view's gesture/touch responder ended up
 * stuck after the user dismissed the sheet — the symptom was "cards visible
 * but taps and swipes do nothing." The delay lets the layout settle so the
 * native-stack modal pushes onto a fully-formed view hierarchy.
 */
export function usePostOnboardingPaywall(enabled: boolean): void {
  const navigation = useNavigation<Nav>();
  const { profile, isPremium } = useAuth();
  const { available: trialAvailable } = useFreeTrial();
  const { updateProfile } = useProfile();
  // Local guard so even within a single mount we only fire once. Without it,
  // the Firestore write is async and the effect could re-enter on the next
  // render before profile.postOnboardingPaywallShown has flipped.
  const firedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    if (firedRef.current) return;
    if (!profile) return;
    if (profile.postOnboardingPaywallShown) return;
    if (isPremium) return;
    if (!trialAvailable) return;

    firedRef.current = true;

    // Schedule navigation FIRST and intentionally do NOT return a cleanup
    // that cancels it. The updateProfile write below flips
    // profile.postOnboardingPaywallShown via the AuthContext subscription
    // — that re-renders TabNavigator and re-runs this effect within
    // ~100-300ms, well before our 350ms delay elapses. If the cleanup
    // cancelled the scheduled navigation (as it did in the prior version),
    // the paywall never opens at all. Firing it from a fire-and-forget
    // setTimeout means the re-render can't cancel us; `firedRef.current`
    // prevents a second schedule.
    InteractionManager.runAfterInteractions(() => {
      // Extra 350ms cushion past the interaction-manager flush. Empirically
      // this is what's needed for the native-stack screen swap (Onboarding
      // → MainTabs) and Onboarding's PersonalityReveal RN <Modal> to fully
      // tear down before the Paywall modal pushes. Without it, the touch
      // responder on SwipeDeck stays stuck after dismiss.
      setTimeout(() => {
        navigation.navigate("Paywall", { entryPoint: "post_onboarding" });
      }, 350);
    });

    updateProfile({ postOnboardingPaywallShown: true }).catch(() => {});
  }, [
    enabled,
    profile?.id,
    profile?.postOnboardingPaywallShown,
    isPremium,
    trialAvailable,
  ]);
}
