import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "../services/firebase";
import { getUserProfile, subscribeToProfile } from "../services/firestore";
import { UserProfile } from "@trace/shared";

const GUEST_PROFILE: UserProfile & { id: string } = {
  id: "guest",
  userId: "guest",
  email: "",
  displayName: "Guest",
  homeAirport: "LAX",
  destinationPreference: "both",
  dealTypes: [],
  travelTimeframe: [],
  subscriptionStatus: "free",
  trialEndDate: null,
  swipeCount: 0,
  streakDays: 0,
  dealHunterLevel: 1,
  badges: [],
  dailySwipesToday: 0,
  dailySwipeDate: "",
  travelPersonality: "",
  onboardingComplete: true,
  howToSwipeShown: true,
  exploreTutorialShown: true,
  dashboardTutorialShown: true,
  aiLearningShown: true,
  profilePictureUrl: null,
  createdAt: new Date(),
};

interface AuthContextType {
  user: User | null;
  profile: (UserProfile & { id: string }) | null;
  setProfile: React.Dispatch<React.SetStateAction<(UserProfile & { id: string }) | null>>;
  loading: boolean;
  isPremium: boolean;
  isGuest: boolean;
  enterGuestMode: () => void;
  exitGuestMode: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  setProfile: () => {},
  loading: true,
  isPremium: false,
  isGuest: false,
  enterGuestMode: () => {},
  exitGuestMode: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<(UserProfile & { id: string }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

  const enterGuestMode = useCallback(() => {
    setIsGuest(true);
    setProfile(GUEST_PROFILE);
  }, []);

  const exitGuestMode = useCallback(() => {
    setIsGuest(false);
    setProfile(null);
  }, []);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("[AuthContext] onAuthStateChanged:", firebaseUser?.uid);
      setUser(firebaseUser);
      if (!firebaseUser) {
        setProfile(null);
        setLoading(false);
        return;
      }
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

  const isPremium =
    profile?.subscriptionStatus === "premium" ||
    profile?.subscriptionStatus === "business" ||
    (profile?.subscriptionStatus === "trial" &&
      profile?.trialEndDate != null &&
      new Date(profile.trialEndDate) > new Date());

  return (
    <AuthContext.Provider value={{ user, profile, setProfile, loading, isPremium, isGuest, enterGuestMode, exitGuestMode }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
