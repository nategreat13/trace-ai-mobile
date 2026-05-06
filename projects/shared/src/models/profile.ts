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
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripeSubscriptionStatus?: string;
  stripePriceId?: string;
  stripeCurrentPeriodEnd?: Date | null;
}
