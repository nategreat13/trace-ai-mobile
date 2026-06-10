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
import TabNavigator from "./TabNavigator";
import PaywallScreen from "../screens/PaywallScreen";
import PremiumWelcomeScreen from "../screens/PremiumWelcomeScreen";
import BusinessWelcomeScreen from "../screens/BusinessWelcomeScreen";
import UpgradeWelcomeScreen from "../screens/UpgradeWelcomeScreen";
import SharedDealScreen from "../screens/SharedDealScreen";
import DiagnosticsScreen from "../screens/DiagnosticsScreen";

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { user, profile, loading } = useAuth();

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
      ) : (
        <>
          <Stack.Screen name="MainTabs" component={TabNavigator} />
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
          {/* Push soft prompt now fires after the user saves their first
              deal — moment of demonstrated value, vs. the cold post-
              onboarding ask that was converting at ~24%. Routing is
              kicked off by useTriggerSoftPromptAfterFirstSave inside
              MainTabs. */}
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
