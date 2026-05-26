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
  SharedDeal: { shareId: string };
  // Hidden diagnostics screen. Reachable only via a 3-second long-press
  // on the Trace logo (Landing or Profile). Always available — including
  // on production binaries — per design decision (no passcode in v1).
  Diagnostics: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
