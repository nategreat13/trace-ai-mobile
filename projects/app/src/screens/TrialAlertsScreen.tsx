import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BellRing } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { colors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";
import { useProfile } from "../hooks/useProfile";
import { requestNotificationPermission, registerPushToken } from "../services/push";
import { createDealAlert, getSavedDeals } from "../services/firestore";
import { auth } from "../services/firebase";
import { logEvent } from "../lib/analytics";
import type { RootStackParamList } from "../navigation/types";

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Right after a trial starts: turn on alerts (Oct 2026).
 *
 * The Oct 21 report had 5 of 8 new monthly trials turning off auto-renew
 * within days. Nothing in the trial reached them after they paid — no push
 * permission yet, no alerts set — so the week ran silent. This asks for
 * notifications at the one moment it's an obvious yes, and sets alerts on
 * every trip they've already saved so the first price drop actually lands.
 *
 * Skippable, and never shown twice (profile.trialAlertsAsked).
 */
export default function TrialAlertsScreen() {
  const navigation = useNavigation<Nav>();
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;
  const { user, profile } = useAuth();
  const { updateProfile } = useProfile();
  const [saved, setSaved] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    logEvent("trial_alerts_viewed", {});
    if (!user) return;
    getSavedDeals(user.uid)
      .then((rows) => {
        const names = [...new Set(rows.map((r: any) => r.destination).filter(Boolean))] as string[];
        setSaved(names);
      })
      .catch(() => {});
  }, [user?.uid]);

  /** Next stop: the email ask for anonymous sessions, otherwise the deck. */
  const next = () =>
    auth.currentUser?.isAnonymous
      ? navigation.replace("SaveAccount")
      : navigation.replace("MainTabs", { screen: "SwipeDeck" });

  const enable = async () => {
    if (busy || !user) return;
    setBusy(true);
    try {
      const status = await requestNotificationPermission();
      const granted = status === "granted";
      updateProfile({
        notificationPermissionAsked: true,
        notificationsEnabled: granted,
        trialAlertsAsked: true,
      }).catch(() => {});
      if (granted && profile?.id) registerPushToken(profile.id).catch(() => {});
      // Alerts on their saves either way: they show in the Alerts tab and
      // start working the moment notifications are on.
      await Promise.all(
        saved.slice(0, 10).map((destination) =>
          createDealAlert({ userId: user.uid, destination, month: null, status: "active" }).catch(
            () => {},
          ),
        ),
      );
      logEvent("trial_alerts_enabled", { granted, alerts_created: Math.min(saved.length, 10) });
    } finally {
      setBusy(false);
      next();
    }
  };

  const skip = () => {
    logEvent("trial_alerts_skipped", {});
    updateProfile({ trialAlertsAsked: true }).catch(() => {});
    next();
  };

  const sub =
    saved.length > 0
      ? `We'll watch ${saved.slice(0, 2).join(" and ")}${saved.length > 2 ? ` and ${saved.length - 2} more` : ""} and tell you the moment the price drops.`
      : "We'll tell you the moment a great fare from your airport drops — before it's gone.";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flex: 1, paddingHorizontal: 28, justifyContent: "center", alignItems: "center", gap: 16 }}>
        <View
          style={{
            width: 88,
            height: 88,
            borderRadius: 44,
            backgroundColor: colors.brand.traceRed + "14",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 8,
          }}
        >
          <BellRing size={40} color={colors.brand.traceRed} />
        </View>
        <Text style={{ fontSize: 28, fontWeight: "900", color: theme.foreground, textAlign: "center", lineHeight: 34 }}>
          Turn on alerts for your trips
        </Text>
        <Text style={{ fontSize: 16, color: theme.mutedForeground, textAlign: "center", lineHeight: 23 }}>
          {sub}
        </Text>
      </View>
      <View style={{ paddingHorizontal: 24, paddingBottom: 12, gap: 4 }}>
        <TouchableOpacity onPress={enable} disabled={busy} activeOpacity={0.9}>
          <LinearGradient
            colors={[colors.brand.traceRed, colors.brand.tracePink]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ borderRadius: 12, paddingVertical: 18, alignItems: "center" }}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontSize: 17, fontWeight: "800" }}>Turn on alerts</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity onPress={skip} style={{ paddingVertical: 14, alignItems: "center" }}>
          <Text style={{ color: theme.mutedForeground, fontSize: 14, fontWeight: "600" }}>Not now</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
