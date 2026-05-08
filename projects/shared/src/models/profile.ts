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
  // Push notifications. Each device that grants permission registers an
  // Expo push token here; the server fans out to every active token when
  // sending a push. expired-token cleanup happens server-side based on
  // Expo Push API responses.
  pushTokens?: PushTokenRecord[];
  /** Per-user master toggle; OS-level permission is also required */
  notificationsEnabled?: boolean;
  /** True after we've shown the in-app permission ask once */
  notificationPermissionAsked?: boolean;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripeSubscriptionStatus?: string;
  stripePriceId?: string;
  stripeCurrentPeriodEnd?: Date | null;
}
