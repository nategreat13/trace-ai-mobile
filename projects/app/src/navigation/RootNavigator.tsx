import React from "react";
import { View } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthContext";
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

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { user, profile, loading } = useAuth();

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
        </>
      ) : !profile?.onboardingComplete ? (
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      ) : !profile?.notificationPermissionAsked ? (
        // After onboarding completes, show the soft prompt for push
        // notifications before any normal app screens. Once the user
        // taps Enable or Maybe later, notificationPermissionAsked
        // flips to true and they advance to MainTabs.
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
        </>
      )}
    </Stack.Navigator>
  );
}
