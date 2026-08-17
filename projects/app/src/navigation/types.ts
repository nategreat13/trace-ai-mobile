import type { NavigatorScreenParams } from "@react-navigation/native";

export type TabParamList = {
  SwipeDeck: undefined;
  /** `search` pre-fills the destination search — used by the assistant card. */
  Explore: { search?: string } | undefined;
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
  Paywall:
    | {
        entryPoint?: string;
        tier?: "premium" | "business";
        /** Computed, per-user sub line (e.g. "You've saved 3 trips under $500...") — overrides the entry point's default static sub when present. */
        personalizedSub?: string;
        /**
         * Live "what you're missing right now" stat, e.g. "You're seeing 5 of
         * 340 destinations". Computed by the calling screen from data it
         * already holds, so the paywall never fetches to render it — when the
         * caller can't compute one, the row is simply omitted. Rendered as a
         * highlighted row above the feature list.
         */
        lockedStat?: string;
      }
    | undefined;
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
