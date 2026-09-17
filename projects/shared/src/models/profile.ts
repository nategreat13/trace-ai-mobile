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
  /**
   * What the user says is stopping them from travelling, captured in
   * onboarding (see BARRIERS in the app's constants). Multi-select — most
   * people have more than one reason and forcing a single pick threw away
   * signal for no benefit.
   *
   * Not used for deal targeting — it's a segmentation key for lifecycle
   * copy, so a "prices are too high" user and a "never know when to book"
   * user can get different Klaviyo messaging during the trial window.
   * Optional because everyone onboarded before Sept 2026 predates the step.
   */
  travelBarriers?: string[];
  /**
   * True once the win-back "we have a gift" offer has been shown.
   *
   * One-shot per user, like postOnboardingPaywallShown: a discount that
   * reappears every time you dismiss a paywall stops being a gift and just
   * becomes the price, which is the whole reason it is worth discounting
   * this deeply in the first place.
   */
  giftOfferShown?: boolean;
  /**
   * How many times the gift has been shown, and when it was last shown.
   *
   * The gift is no longer strictly one-shot: it re-offers on a later visit
   * (24h+ after the last showing) up to GIFT_MAX_SHOWS times, and can always
   * be reopened by the user from the feed page. Never twice in one session —
   * a discount that reappears the moment you dismiss it stops being a gift
   * and becomes the price, and makes the paywall's number look fake.
   */
  giftOfferShowCount?: number;
  giftOfferLastShownAt?: Date | null;
  /**
   * Whether this user must hold a paid entitlement to reach the app at all.
   *
   * Set to "subscription_required" for everyone who completes the Sept 2026
   * onboarding; absent for every account created before it. That scoping is
   * deliberate and load-bearing: the gate is meant for people who just went
   * through the new flow, and applying it to the whole base would lock ~450
   * existing free users out of an app they have been using for months, plus
   * anyone whose trial lapses. Widening it later is a one-line change in
   * RootNavigator; un-ringing that bell is not.
   */
  accessGate?: "subscription_required";
  /**
   * Destinations this user was shown the last time they opened the gated
   * home screen. Diffed on the next visit to count what's genuinely new.
   *
   * Stored as names rather than a timestamp because the deals API carries no
   * "listed at" field — there is no honest way to ask "what appeared since
   * Tuesday", but "which of these hadn't I seen" is exactly answerable.
   */
  gatedHomeSeenDestinations?: string[];
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
  dailySwipeWindowStart: string;
  travelPersonality: string;
  onboardingComplete: boolean;
  howToSwipeShown: boolean;
  exploreTutorialShown: boolean;
  dashboardTutorialShown: boolean;
  aiLearningShown: boolean;
  /**
   * True after we've auto-opened the paywall once at the end of onboarding.
   * Drives the "trial as hero" exposure step that follows onboardingComplete
   * — we open the paywall a single time per user so trial offers are seen by
   * ~100% of completed signups, not the small fraction who hit the cap or
   * a blurred Explore deal.
   */
  postOnboardingPaywallShown?: boolean;
  /**
   * When the user saved their first deal. Set on the first right-swipe (or
   * the first save from ExpandedDeal). Gates the push-notifications soft
   * prompt — we hold the ask until the user has demonstrated value, instead
   * of firing it cold right after onboarding.
   */
  firstSaveAt?: Date | null;
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
