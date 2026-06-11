import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Plane, MapPin, Compass, Briefcase, User } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColorScheme } from "react-native";
import { colors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";
import { usePostOnboardingPaywall } from "../hooks/usePostOnboardingPaywall";
import { useTriggerSoftPromptAfterFirstSave } from "../hooks/useTriggerSoftPromptAfterFirstSave";
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

  // Forced trial exposure DISABLED (v1.3.3 cohort): opening the paywall
  // immediately after onboarding put the annual offer in front of users
  // before they'd swiped a single deal — 100% saw it, but every purchase
  // attempt was canceled at Apple's sheet and core swipe/save engagement
  // collapsed (0 saves). Trial exposure now happens only after the user
  // hits the 5-swipe daily limit (auto-opens the paywall in SwipeDeckScreen),
  // i.e. after they've felt the value. Pass `true` to re-enable.
  usePostOnboardingPaywall(false);

  // Push soft prompt fires after the user's first save (moment of
  // demonstrated value), not cold after onboarding.
  useTriggerSoftPromptAfterFirstSave();

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
