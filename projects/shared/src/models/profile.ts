export interface PushTokenRecord {
  /** Expo push token, e.g. "ExponentPushToken[xxxxxxxx]" */
  token: string;
  platform: "ios" | "android";
  /** ISO string or Date — Firestore returns Timestamps which we convert */
  addedAt: Date | string;
}

export interface UserProfile {
  id?: string;
  userId: string;
  email: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  homeAirport: string;
  destinationPreference: "domestic" | "international" | "both";
  dealTypes: string[];
  travelTimeframe: string[];
  subscriptionStatus: "free" | "trial" | "premium" | "business";
  /**
   * Where the user's current paid tier came from:
   *   "store" — real subscription via App Store / Play Store (RC webhook)
   *   "promo" — granted via /redeem-promo (RC promotional entitlement)
   * Null/unset means free or legacy users with no recorded source.
   */
  subscriptionSource?: "store" | "promo" | null;
  trialEndDate: Date | null;
  swipeCount: number;
  streakDays: number;
  dealHunterLevel: number;
  badges: string[];
  dailySwipesToday: number;
  dailySwipeDate: string;
  travelPersonality: string;
  onboardingComplete: boolean;
  howToSwipeShown: boolean;
  exploreTutorialShown: boolean;
  dashboardTutorialShown: boolean;
  aiLearningShown: boolean;
  profilePictureUrl: string | null;
  createdAt: Date;
  // Activity / cohort metadata. firstSeenAt, firstPlatform, firstAppVersion,
  // country are write-once at signup and underpin per-user cohort slicing.
  // lastSeenAt is updated on cold launch / 30+min foreground resume.
  firstSeenAt?: Date;
  firstPlatform?: "ios" | "android" | "web";
  firstAppVersion?: string;
  country?: string;
  lastSeenAt?: Date;
  // Lifetime revenue + first/last purchase. Mirrored from the RevenueCat
  // webhook so per-user dashboards can compute LTV without scanning the
  // events log.
  firstPurchaseAt?: Date;
  lastPurchaseAt?: Date;
  lifetimeRevenueCents?: number;
  everUsedFreeTrial?: boolean;
  // Whether the user is CURRENTLY in a free-trial period (set true on a
  // trial INITIAL_PURCHASE, false once it converts to paid or expires).
  // Maintained by the RevenueCat webhook; powers the admin "in trial" count.
  // Note: `subscriptionStatus` is the tier ("premium"/"business") during a
  // trial, so this flag is what distinguishes trial from paid server-side.
  inTrial?: boolean;
  // Push notifications. Each device that grants permission registers an
  // Expo push token here; the server fans out to every active token when
  // sending a push. expired-token cleanup happens server-side based on
  // Expo Push API responses.
  pushTokens?: PushTokenRecord[];
  /** Per-user master toggle; OS-level permission is also required */
  notificationsEnabled?: boolean;
  /** True after we've shown the in-app permission ask once */
  notificationPermissionAsked?: boolean;
  /**
   * Per-category toggles set by the user in Profile → Notifications.
   * Each defaults to true (we treat missing/undefined as "on"). The
   * server consults these before firing a templated push — e.g. a
   * user with `offers: false` won't get premium_nudge_* even if the
   * cron's matching conditions are met.
   *
   * Category → template-key mapping is defined server-side in
   * lib/notification-preferences.ts.
   */
  notificationPreferences?: {
    /** Deal-driven pushes — hot_deal_alert, deal_alert_match */
    deals?: boolean;
    /** Account lifecycle — trial_ending_*, billing_issue, subscription_renewal_24h, welcome_to_premium */
    account?: boolean;
    /** Re-engagement when inactive — welcome, inactivity_3d/7d/14d */
    reengagement?: boolean;
    /** Upsells & promotional pushes — premium_nudge_*, business_class_nudge_*, discount_on_* */
    offers?: boolean;
  };
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripeSubscriptionStatus?: string;
  stripePriceId?: string;
  stripeCurrentPeriodEnd?: Date | null;
}
