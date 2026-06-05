import React, { createContext, useContext, useEffect, useState } from "react";
import { AppState } from "react-native";
import { onAuthStateChanged, User } from "firebase/auth";
import type { CustomerInfo } from "react-native-purchases";
import { auth } from "../services/firebase";
import { getUserProfile, subscribeToProfile } from "../services/firestore";
import {
  initializeIAP,
  logOutIAP,
  getCustomerInfo,
  readEntitlementState,
  addCustomerInfoListener,
} from "../services/iap";
import { UserProfile } from "@trace/shared";

interface AuthContextType {
  user: User | null;
  profile: (UserProfile & { id: string }) | null;
  setProfile: React.Dispatch<React.SetStateAction<(UserProfile & { id: string }) | null>>;
  loading: boolean;
  isPremium: boolean;
  /** True when the active entitlement is currently in its free-trial period. */
  isTrialPeriod: boolean;
  /** When the current trial/paid period ends (from RevenueCat), or null. */
  trialEndsAt: Date | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  setProfile: () => {},
  loading: true,
  isPremium: false,
  isTrialPeriod: false,
  trialEndsAt: null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<(UserProfile & { id: string }) | null>(null);
  const [loading, setLoading] = useState(true);
  // Live RevenueCat entitlement snapshot — the payments source of truth.
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("[AuthContext] onAuthStateChanged:", firebaseUser?.uid);
      setUser(firebaseUser);
      if (!firebaseUser) {
        setProfile(null);
        setCustomerInfo(null);
        logOutIAP();
        setLoading(false);
        return;
      }
      // Initialize RevenueCat with the Firebase user ID
      await initializeIAP(firebaseUser.uid);
      // Fetch initial profile
      const p = await getUserProfile(firebaseUser.uid);
      console.log("[AuthContext] getUserProfile result:", p?.id, p?.homeAirport);
      setProfile(p);
      setLoading(false);
    });
    return unsubAuth;
  }, []);

  // Real-time profile subscription
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToProfile(user.uid, (p) => {
      if (p) setProfile(p);
    });
    return unsub;
  }, [user]);

  // Keep live RevenueCat entitlement state in sync. This is the reconciliation
  // layer: access is granted from RevenueCat directly (not just the Firestore
  // profile the webhook maintains), so a missed/late webhook can't strand a
  // paying user. We refresh on sign-in, whenever RC pushes an update, and on
  // every app foreground.
  useEffect(() => {
    if (!user) {
      setCustomerInfo(null);
      return;
    }
    // Wait until the auth effect has finished (it sets loading=false only
    // after initializeIAP configures RevenueCat). Calling getCustomerInfo /
    // adding a listener before configure would throw.
    if (loading) return;
    let mounted = true;
    const refresh = () => {
      getCustomerInfo()
        .then((info) => {
          if (mounted) setCustomerInfo(info);
        })
        .catch(() => {
          // non-fatal — profile-based access still applies
        });
    };
    refresh();
    const unsub = addCustomerInfoListener((info) => {
      if (mounted) setCustomerInfo(info);
    });
    const appStateSub = AppState.addEventListener("change", (s) => {
      if (s === "active") refresh();
    });
    return () => {
      mounted = false;
      unsub();
      appStateSub.remove();
    };
  }, [user, loading]);

  const entState = readEntitlementState(customerInfo);

  // Premium access is the union of the Firestore profile (webhook-maintained,
  // good for analytics/admin) and the live RevenueCat entitlement (self-heals
  // missed webhooks). OR-ing can only *grant* access RevenueCat confirms.
  const isPremium =
    profile?.subscriptionStatus === "premium" ||
    profile?.subscriptionStatus === "business" ||
    (profile?.subscriptionStatus === "trial" &&
      profile?.trialEndDate != null &&
      new Date(profile.trialEndDate) > new Date()) ||
    entState.isPremium;

  // Trial state comes primarily from RevenueCat (the profile's
  // subscriptionStatus is the tier, not "trial", so it can't tell us this on
  // its own). Fall back to the webhook-maintained `inTrial` profile flag for
  // the window where live CustomerInfo isn't available yet (before first
  // fetch, or on a fetch error) — mirrors the isPremium union so the trial
  // badge doesn't vanish for a genuine trial user.
  const profileTrialActive =
    !!profile?.inTrial &&
    profile?.trialEndDate != null &&
    new Date(profile.trialEndDate) > new Date();
  const isTrialPeriod = entState.isTrial || profileTrialActive;
  const trialEndsAt =
    entState.expiresAt ??
    (profileTrialActive ? (profile?.trialEndDate ?? null) : null);

  return (
    <AuthContext.Provider
      value={{ user, profile, setProfile, loading, isPremium, isTrialPeriod, trialEndsAt }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
