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

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { user, profile, loading, isPremium } = useAuth();

  /**
   * Subscription gate (Sept 2026).
   *
   * Users stamped `accessGate: "subscription_required"` at signup cannot
   * reach MainTabs without a paid entitlement — the paywall *is* their root
   * screen. The point is that finishing onboarding shouldn't deposit someone
   * into the free tier they were just shown the limits of.
   *
   * Scoped by the per-user flag rather than applied to every free account:
   * accounts created before this change have no flag and keep their access.
   * To widen it to everyone, drop the `accessGate` check here.
   *
   * The gated stack is rooted at GatedHome — their onboarding feed, locked —
   * rather than at the paywall itself. That ordering is what makes the
   * win-back reachable: Paywall and GiftOffer are pushed on top, so both keep
   * a working close affordance, and dismissing the gift lands back on a
   * screen that is still selling rather than on a dead end.
   *
   *     GatedHome → Paywall → (dismiss) → GiftOffer → (dismiss) → GatedHome
   */
  const isGated =
    !!profile?.onboardingComplete &&
    profile?.accessGate === "subscription_required" &&
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
