import { useAuth } from "../context/AuthContext";
import { updateUserProfile } from "../services/firestore";
import { UserProfile } from "@trace/shared";

export function useProfile() {
  const { profile, setProfile } = useAuth();

  const update = async (updates: Partial<UserProfile>) => {
    if (!profile?.id) return;
    await updateUserProfile(profile.id, updates);
    setProfile((prev) => (prev ? { ...prev, ...updates } : prev));
  };

  return { profile, updateProfile: update };
}
