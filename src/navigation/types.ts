import type { NavigatorScreenParams } from "@react-navigation/native";

export type TabParamList = {
  SwipeDeck: undefined;
  Explore: undefined;
  Dashboard: undefined;
  Upgrade: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  Onboarding: undefined;
  MainTabs: NavigatorScreenParams<TabParamList>;
  TrialSignup: { plan: string };
  SubscriptionPlan: undefined;
  PremiumWelcome: undefined;
  BusinessWelcome: undefined;
  UpgradeWelcome: undefined;
  DealType: undefined;
  DealCategory: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
