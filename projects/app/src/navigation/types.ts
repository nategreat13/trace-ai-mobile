import type { NavigatorScreenParams } from "@react-navigation/native";

export type TabParamList = {
  SwipeDeck: undefined;
  Explore: undefined;
  Dashboard: { tab?: "saved" | "alerts"; alertSaved?: boolean } | undefined;
  Upgrade: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Landing: undefined;
  Login: { mode?: "signup" | "signin" } | undefined;
  Onboarding: undefined;
  NotificationsPermission: undefined;
  MainTabs: NavigatorScreenParams<TabParamList>;
  Paywall: { entryPoint?: string } | undefined;
  PremiumWelcome: undefined;
  BusinessWelcome: undefined;
  UpgradeWelcome: undefined;
  EditPreferences: undefined;
  DealType: undefined;
  DealCategory: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
