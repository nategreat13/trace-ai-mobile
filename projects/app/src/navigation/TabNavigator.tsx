import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Compass, MapPin, Plane, Briefcase, User } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColorScheme } from "react-native";
import { colors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";
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
          tabBarIcon: ({ color, size }) => <Compass color={color} size={size} />,
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
          tabBarIcon: ({ color, size }) => <Plane color={color} size={size} />,
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
