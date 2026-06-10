import { useEffect, useRef } from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthContext";
import { useShouldShowSoftPrompt } from "./useDeviceNotificationGate";
import type { RootStackParamList } from "../navigation/types";

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Present the push-notifications soft prompt as a modal the first time
 * the user saves a deal. Beats the previous post-onboarding ask (which
 * accepted at ~24% on the v1.3.2 cohort): the user has now demonstrated
 * intent by saving something they liked, so "we'll ping you when more
 * deals like this drop" lands with real context.
 *
 * Gates:
 *   - per-device gate via useShouldShowSoftPrompt (OS state + AS flag)
 *   - profile.firstSaveAt is set (the moment of demonstrated value)
 *
 * Once both are true we navigate once; a local ref prevents a re-fire
 * if the modal's dismiss races the profile subscription.
 */
export function useTriggerSoftPromptAfterFirstSave(): void {
  const navigation = useNavigation<Nav>();
  const { profile } = useAuth();
  const shouldShow = useShouldShowSoftPrompt();
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    if (shouldShow !== true) return;
    if (!profile?.firstSaveAt) return;

    firedRef.current = true;
    navigation.navigate("NotificationsPermission");
  }, [shouldShow, profile?.firstSaveAt, navigation]);
}
