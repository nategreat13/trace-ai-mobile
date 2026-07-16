import { useAuth } from "../context/AuthContext";
import { updateUserProfile } from "../services/firestore";
import { UserProfile } from "@trace/shared";

export function useProfile() {
  const { profile, setProfile } = useAuth();

  const update = async (updates: Partial<UserProfile>) => {
    if (!profile?.id) {
      if (__DEV__) console.warn("[useProfile] updateProfile no-op — profile.id missing", updates);
      return;
    }
    setProfile((prev) => (prev ? { ...prev, ...updates } : prev));
    try {
      await updateUserProfile(profile.id, updates);
    } catch (err) {
      // Previously swallowed as a silent unhandled rejection — the optimistic
      // setProfile above would still look right in this session, but the
      // write never lands, so the next Firestore snapshot reverts it and any
      // "seen this already" flag (tutorial modals, swipe milestones) looks
      // like it never persisted.
      console.error("[useProfile] updateProfile FAILED to write:", profile.id, updates, err);
    }
  };

  return { profile, updateProfile: update };
}
