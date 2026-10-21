import React from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import UpgradeCelebration from "../components/UpgradeCelebration";
import { auth } from "../services/firebase";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function PremiumWelcomeScreen() {
  const navigation = useNavigation<Nav>();
  return (
    <UpgradeCelebration
      tier="premium"
      // Anonymous (swipe-first) users are asked for an email here — the
      // moment after a trial starts is when they have a reason to give one.
      onContinue={() =>
        auth.currentUser?.isAnonymous
          ? navigation.replace("SaveAccount")
          : navigation.replace("MainTabs", { screen: "SwipeDeck" })
      }
    />
  );
}
