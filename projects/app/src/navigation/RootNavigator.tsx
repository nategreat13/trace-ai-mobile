import React from "react";
import { View } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthContext";
import { useEnsurePushTokenRegistered } from "../hooks/useDeviceNotificationGate";
import TraceLoader from "../components/TraceLoader";
import type { RootStackParamList } from "./types";

import LandingScreen from "../screens/LandingScreen";
import LoginScreen from "../screens/LoginScreen";
import OnboardingScreen from "../screens/OnboardingScreen";
import NotificationsPermissionScreen from "../screens/NotificationsPermissionScreen";
import GiftOfferScreen from "../screens/GiftOfferScreen";
import GatedHomeScreen from "../screens/GatedHomeScreen";
import TabNavigator from "./TabNavigator";
import PaywallScreen from "../screens/PaywallScreen";
import PremiumWelcomeScreen from "../screens/PremiumWelcomeScreen";
import BusinessWelcomeScreen from "../screens/BusinessWelcomeScreen";
import UpgradeWelcomeScreen from "../screens/UpgradeWelcomeScreen";
import SharedDealScreen from "../screens/SharedDealScreen";
import DiagnosticsScreen from "../screens/DiagnosticsScreen";
import SaveAccountScreen from "../screens/SaveAccountScreen";

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { user, profile, loading, isPremium } = useAuth();

  /**
   * "Your feed is ready" (Oct 2026 swipe-first flow).
   *
   * New users land here once, after their first swipe session: their saves,
   * unlocked, and today's other good deals, locked, with Try Free and "Keep
   * swiping free". Leaving clears `feedReadyPending` and routes to MainTabs —
   * the free tier, with its daily swipe limit — for good.
   *
   * This replaces the Sept 2026 hard gate (`accessGate:
   * "subscription_required"`), which rooted new users at this page with no
   * way into the app without paying. Every ad promises "download it free and
   * start swiping"; the gate broke that promise. Accounts still carrying the
   * old flag are deliberately not special-cased: they get the free tier too.
   *
   * Paywall and GiftOffer are pushed on top rather than being roots, so both
   * keep a working close affordance:
   *
   *     FeedReady → Paywall → (dismiss) → GiftOffer → (dismiss) → FeedReady
   */
  const isGated =
    !!profile?.onboardingComplete &&
    profile?.feedReadyPending === true &&
    !isPremium;

  // Re-sync this device's push token to the userProfile if OS permission
  // is already granted — covers users who sign in on a new device after
  // already going through the soft prompt elsewhere. Idempotent.
  const profileId = profile?.onboardingComplete ? profile.id : null;
  useEnsurePushTokenRegistered(profileId);

  if (loading) {
    return (
      <View style={{ flex: 1 }}>
        <TraceLoader />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!user ? (
        <>
          <Stack.Screen name="Landing" component={LandingScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
          {/* Diagnostics is reachable from Landing's hidden long-press
              even when unauthed. Registered as a modal so it overlays
              cleanly and "Close" pops back to Landing. */}
          <Stack.Screen
            name="Diagnostics"
            component={DiagnosticsScreen}
            options={{ presentation: "modal" }}
          />
        </>
      ) : !profile?.onboardingComplete ? (
        <>
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          <Stack.Screen
            name="Diagnostics"
            component={DiagnosticsScreen}
            options={{ presentation: "modal" }}
          />
        </>
      ) : isGated ? (
        <>
          <Stack.Screen name="GatedHome" component={GatedHomeScreen} />
          <Stack.Screen
            name="Paywall"
            component={PaywallScreen}
            options={{ presentation: "fullScreenModal" }}
          />
          {/* Lets a gated user change an answer (wrong airport, forgot
              international) without re-running the whole funnel. Editing
              mode already skips every non-question beat and pops back here
              on save, and GatedHome refetches when the airport changes. */}
          <Stack.Screen
            name="EditPreferences"
            component={OnboardingScreen}
            options={{ presentation: "fullScreenModal" }}
          />
          <Stack.Screen
            name="GiftOffer"
            component={GiftOfferScreen}
            options={{ presentation: "fullScreenModal" }}
          />
          <Stack.Screen
            name="PremiumWelcome"
            component={PremiumWelcomeScreen}
            options={{ presentation: "fullScreenModal" }}
          />
          <Stack.Screen
            name="BusinessWelcome"
            component={BusinessWelcomeScreen}
            options={{ presentation: "fullScreenModal" }}
          />
          <Stack.Screen
            name="Diagnostics"
            component={DiagnosticsScreen}
            options={{ presentation: "modal" }}
          />
        </>
      ) : (
        <>
          <Stack.Screen name="MainTabs" component={TabNavigator} />
          <Stack.Screen
            name="GiftOffer"
            component={GiftOfferScreen}
            options={{ presentation: "fullScreenModal" }}
          />
          {/* Paywall: `fullScreenModal` not `modal`. The iOS sheet-style
              `modal` presentation hosts the screen in a separate native
              window outside the App.tsx <GestureHandlerRootView>, and on
              dismiss it leaves an invisible touch-blocking layer over the
              underlying screen — symptom: "only the tab bar is tappable
              after closing the paywall." A local GestureHandlerRootView
              inside PaywallScreen didn't fix it. fullScreenModal pushes
              the screen as a normal full-cover transition that tears
              down cleanly on dismiss. */}
          <Stack.Screen
            name="Paywall"
            component={PaywallScreen}
            options={{ presentation: "fullScreenModal" }}
          />
          {/* Push soft prompt fires once the user has swiped a few deals
              or saved one, whichever lands first. Routing is kicked off by
              useTriggerSoftPrompt inside MainTabs — see that hook for why
              the trigger has moved twice. */}
          <Stack.Screen
            name="NotificationsPermission"
            component={NotificationsPermissionScreen}
            options={{ presentation: "fullScreenModal" }}
          />
          <Stack.Screen
            name="PremiumWelcome"
            component={PremiumWelcomeScreen}
            options={{ presentation: "fullScreenModal" }}
          />
          <Stack.Screen
            name="BusinessWelcome"
            component={BusinessWelcomeScreen}
            options={{ presentation: "fullScreenModal" }}
          />
          {/* The email ask, after a trial starts on an anonymous session. */}
          <Stack.Screen
            name="SaveAccount"
            component={SaveAccountScreen}
            options={{ presentation: "fullScreenModal", gestureEnabled: false }}
          />
          <Stack.Screen
            name="UpgradeWelcome"
            component={UpgradeWelcomeScreen}
            options={{ presentation: "fullScreenModal" }}
          />
          <Stack.Screen
            name="EditPreferences"
            component={OnboardingScreen}
            options={{ presentation: "fullScreenModal" }}
          />
          <Stack.Screen
            name="SharedDeal"
            component={SharedDealScreen}
            options={{ presentation: "fullScreenModal" }}
          />
          <Stack.Screen
            name="Diagnostics"
            component={DiagnosticsScreen}
            options={{ presentation: "modal" }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}
