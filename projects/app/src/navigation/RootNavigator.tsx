import React from "react";
import { View } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthContext";
import { useDeviceNotificationGate } from "../hooks/useDeviceNotificationGate";
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

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { user, profile, loading } = useAuth();

  // Per-device gate for the soft prompt. On every authed launch this
  // also re-syncs the device's push token to the userProfile if OS
  // permission is already granted — so logging in on a new device
  // automatically registers a push token without any user action.
  const profileId = profile?.onboardingComplete ? profile.id : null;
  const { resolved: gateResolved, shouldShowSoftPrompt } =
    useDeviceNotificationGate(profileId);

  // Block on the gate only after onboarding is done. Until then we
  // don't need it (and triggering OS-permission reads pre-onboarding
  // would be premature).
  const blockingOnGate = !!user && !!profile?.onboardingComplete && !gateResolved;

  if (loading || blockingOnGate) {
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
        </>
      ) : !profile?.onboardingComplete ? (
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      ) : shouldShowSoftPrompt ? (
        // Show the soft prompt for push notifications. Gating is
        // per-device (OS permission state + an AsyncStorage dismissal
        // flag), so a returning user signing in on a new device sees
        // this even if they already went through it on another device.
        <Stack.Screen
          name="NotificationsPermission"
          component={NotificationsPermissionScreen}
        />
      ) : (
        <>
          <Stack.Screen name="MainTabs" component={TabNavigator} />
          <Stack.Screen
            name="Paywall"
            component={PaywallScreen}
            options={{ presentation: "modal" }}
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
        </>
      )}
    </Stack.Navigator>
  );
}
