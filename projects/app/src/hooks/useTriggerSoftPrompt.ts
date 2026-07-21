import { useEffect, useRef } from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthContext";
import { useShouldShowSoftPrompt } from "./useDeviceNotificationGate";
import type { RootStackParamList } from "../navigation/types";

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Lifetime swipes that qualify as "has seen enough to have an opinion".
 * Low on purpose — this is a reach/context tradeoff and reach is the side
 * that was hurting. Raising it moves the ask later and shrinks the
 * audience; lowering it approaches the old cold ask.
 */
export const SOFT_PROMPT_SWIPE_THRESHOLD = 3;

/**
 * Present the push-notifications soft prompt as a modal once the user has
 * either swiped a few deals or saved one — whichever happens first.
 *
 * History, because this has now moved twice and the reasoning matters:
 *
 *  - Originally a cold ask right after onboarding. Everyone saw it, ~24%
 *    accepted, so ~24% of users ended up reachable.
 *  - Then moved behind `firstSaveAt` ("moment of demonstrated value"). The
 *    accept rate among people asked roughly doubled to ~44% — a real win on
 *    that metric — but only ~24% of users ever save a deal, so only ~21%
 *    were ever asked and just 9% ended up with push enabled (v1.3.6, n=164).
 *    The optimization improved the rate and halved the outcome.
 *  - Now: whichever of `swipeCount >= SOFT_PROMPT_SWIPE_THRESHOLD` or
 *    `firstSaveAt` lands first. ~55% of users swipe at least once vs ~24%
 *    who save, so this keeps warm context while roughly doubling how many
 *    people are ever asked.
 *
 * The lesson worth keeping: accept rate isn't the goal, reachable users
 * are. A gate that converts brilliantly on an audience nobody reaches is
 * worse than a blunt one that reaches everyone.
 *
 * Gates:
 *   - per-device gate via useShouldShowSoftPrompt (OS state + AS flag)
 *   - enough swipes, or a first save
 *
 * Once both are true we navigate once; a local ref prevents a re-fire
 * if the modal's dismiss races the profile subscription.
 */
export function useTriggerSoftPrompt(): void {
  const navigation = useNavigation<Nav>();
  const { profile } = useAuth();
  const shouldShow = useShouldShowSoftPrompt();
  const firedRef = useRef(false);

  const swipeCount = profile?.swipeCount ?? 0;
  const hasEngaged = swipeCount >= SOFT_PROMPT_SWIPE_THRESHOLD || !!profile?.firstSaveAt;

  useEffect(() => {
    if (firedRef.current) return;
    if (shouldShow !== true) return;
    if (!hasEngaged) return;

    firedRef.current = true;
    navigation.navigate("NotificationsPermission");
  }, [shouldShow, hasEngaged, navigation]);
}
