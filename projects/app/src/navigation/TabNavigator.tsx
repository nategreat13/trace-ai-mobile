import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Plane, MapPin, Compass, Briefcase, User } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColorScheme } from "react-native";
import { colors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";
import { usePostOnboardingPaywall } from "../hooks/usePostOnboardingPaywall";
import { useTriggerSoftPrompt } from "../hooks/useTriggerSoftPrompt";
import type { TabParamList } from "./types";

import SwipeDeckScreen from "../screens/SwipeDeckScreen";
import ExploreScreen from "../screens/ExploreScreen";
import DashboardScreen from "../screens/DashboardScreen";
import UpgradeScreen from "../screens/UpgradeScreen";
import ProfileScreen from "../screens/ProfileScreen";

const Tab = createBottomTabNavigator<TabParamList>();

export default function TabNavigator() {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;
  const { profile } = useAuth();
  const isBusinessUser = profile?.subscriptionStatus === "business";

  // Forced trial exposure RE-ENABLED 2026-08-16.
  //
  // History, because this flag has been flipped before and the reasoning
  // matters: it was disabled after the v1.3.3 cohort, where opening the
  // paywall immediately after onboarding put the ANNUAL offer in front of
  // users before they'd swiped a single deal — 100% saw it, every purchase
  // attempt was canceled at Apple's sheet, and swipe/save engagement
  // collapsed to 0 saves. The comment here then said trial exposure would
  // instead happen when a user hit the 5-swipe daily limit.
  //
  // That replacement no longer exists. The daily swipe cap was removed in
  // the July monetization rework, which silently deleted the only remaining
  // forced trial exposure in the app — and revenue went to zero within days
  // of the last capped users updating (0 purchases, 0 trials, n=172).
  //
  // Two things differ from the v1.3.3 attempt: the paywall now defaults to
  // the MONTHLY offer rather than annual (the annual sticker price is the
  // leading suspect for those canceled sheets), and it now names four real
  // limits instead of two vague ones.
  //
  // The v1.3.3 engagement collapse is still the risk to watch. If saves per
  // active user drop against the current 7.6 baseline, this is the first
  // thing to turn back off — it's a one-word change.
  usePostOnboardingPaywall(true);

  // Push soft prompt fires once the user has swiped a few deals or saved
  // one, whichever comes first — gating it on saves alone only ever asked
  // ~21% of users. See the hook for the full history.
  useTriggerSoftPrompt();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand.traceRed,
        tabBarInactiveTintColor: theme.mutedForeground,
        tabBarStyle: {
          backgroundColor: theme.background,
          borderTopColor: theme.border,
          height: 64 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "600",
        },
      }}
    >
      <Tab.Screen
        name="SwipeDeck"
        component={SwipeDeckScreen}
        options={{
          tabBarLabel: "Swipe",
          tabBarIcon: ({ color, size }) => <Plane color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Explore"
        component={ExploreScreen}
        options={{
          tabBarLabel: "Explore",
          tabBarIcon: ({ color, size }) => <MapPin color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: "Dashboard",
          tabBarIcon: ({ color, size }) => <Compass color={color} size={size} />,
        }}
      />
      {!isBusinessUser && (
        <Tab.Screen
          name="Upgrade"
          component={UpgradeScreen}
          options={{
            tabBarLabel: "Business",
            tabBarIcon: ({ color, size }) => <Briefcase color={color} size={size} />,
          }}
        />
      )}
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: "Profile",
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
    </Tab.Navigator>
  );
}
