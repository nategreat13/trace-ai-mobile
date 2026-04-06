import React from "react";
import { ActivityIndicator, View } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthContext";
import type { RootStackParamList } from "./types";

import LandingScreen from "../screens/LandingScreen";
import LoginScreen from "../screens/LoginScreen";
import OnboardingScreen from "../screens/OnboardingScreen";
import TabNavigator from "./TabNavigator";
import TrialSignupScreen from "../screens/TrialSignupScreen";
import SubscriptionPlanScreen from "../screens/SubscriptionPlanScreen";
import PremiumWelcomeScreen from "../screens/PremiumWelcomeScreen";
import BusinessWelcomeScreen from "../screens/BusinessWelcomeScreen";
import UpgradeWelcomeScreen from "../screens/UpgradeWelcomeScreen";

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#FF655B" />
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
      ) : (
        <>
          <Stack.Screen name="MainTabs" component={TabNavigator} />
          <Stack.Screen
            name="TrialSignup"
            component={TrialSignupScreen}
            options={{ presentation: "modal" }}
          />
          <Stack.Screen
            name="SubscriptionPlan"
            component={SubscriptionPlanScreen}
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
