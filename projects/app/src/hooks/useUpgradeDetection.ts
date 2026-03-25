import { useRef, useState, useEffect, useCallback } from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { useAuth } from "../context/AuthContext";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function useUpgradeDetection() {
  const navigation = useNavigation<Nav>();
  const { profile } = useAuth();
  const prevStatusRef = useRef(profile?.subscriptionStatus);
  const [waitingForUpgrade, setWaitingForUpgrade] = useState(false);

  const captureStatus = useCallback(() => {
    prevStatusRef.current = profile?.subscriptionStatus;
  }, [profile?.subscriptionStatus]);

  const onReturn = useCallback(() => {
    setWaitingForUpgrade(true);
  }, []);

  useEffect(() => {
    if (!waitingForUpgrade) return;
    const prev = prevStatusRef.current;
    const curr = profile?.subscriptionStatus;
    if (prev !== curr) {
      setWaitingForUpgrade(false);
      if (curr === "business") navigation.navigate("BusinessWelcome");
      else if (curr === "premium") navigation.navigate("PremiumWelcome");
    }
  }, [profile?.subscriptionStatus, waitingForUpgrade, navigation]);

  return { captureStatus, onReturn };
}
