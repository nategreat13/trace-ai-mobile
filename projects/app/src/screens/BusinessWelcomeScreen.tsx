import React from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import UpgradeCelebration from "../components/UpgradeCelebration";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function BusinessWelcomeScreen() {
  const navigation = useNavigation<Nav>();
  return (
    <UpgradeCelebration
      tier="business"
      onContinue={() => navigation.replace("MainTabs", { screen: "SwipeDeck" })}
    />
  );
}
