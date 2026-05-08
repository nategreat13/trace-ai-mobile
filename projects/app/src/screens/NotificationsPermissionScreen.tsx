import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  useColorScheme,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BellRing } from "lucide-react-native";
import { colors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";
import { useProfile } from "../hooks/useProfile";
import {
  requestNotificationPermission,
  registerPushToken,
} from "../services/push";
import {
  markSoftPromptDismissed,
  triggerGateRecheck,
} from "../hooks/useDeviceNotificationGate";
import { logEvent } from "../lib/analytics";

/**
 * Custom "soft prompt" shown after onboarding completes, before iOS /
 * Android shows their actual permission dialog. Lifts accept rate
 * dramatically vs. firing the OS prompt directly:
 *
 *   - If the user taps "Enable", we then trigger the OS dialog. They
 *     arrive primed and almost always accept.
 *   - If they tap "Maybe later", we skip the OS dialog entirely so
 *     we can re-ask in a different context later. Once iOS shows its
 *     dialog and the user denies, we can't programmatically re-prompt
 *     ever — only Settings can flip it back. So preserving the
 *     ability to re-prompt is the whole point.
 *
 * The screen is gated by `profile.notificationPermissionAsked`: false
 * = show, true = skip and let RootNavigator route to MainTabs.
 */
export default function NotificationsPermissionScreen() {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;
  const { profile } = useAuth();
  const { updateProfile } = useProfile();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    logEvent("push_soft_prompt_shown", {});
  }, []);

  const handleEnable = async () => {
    if (!profile?.id || submitting) return;
    setSubmitting(true);
    logEvent("push_soft_prompt_enable_tapped", {});
    try {
      // Now show the OS dialog. requestNotificationPermission already
      // logs push_permission_requested + push_permission_granted/denied.
      const status = await requestNotificationPermission();
      const updates: {
        notificationPermissionAsked: boolean;
        notificationsEnabled: boolean;
      } = {
        notificationPermissionAsked: true,
        notificationsEnabled: status === "granted",
      };
      // Don't await these — Firestore writes can be slow and we want
      // the gate to re-resolve and unmount this screen ASAP. Both
      // functions are fire-and-forget safe (registerPushToken has
      // internal error handling; updateProfile is just persistence).
      updateProfile(updates).catch(() => {});
      if (status === "granted") {
        registerPushToken(profile.id).catch(() => {});
      } else {
        // User denied at OS dialog. Mark dismissed so we don't keep
        // showing the soft prompt — they can re-enable from Settings.
        markSoftPromptDismissed().catch(() => {});
      }
    } catch (err) {
      if (__DEV__) console.warn("[NotificationsPermission] enable failed:", err);
      updateProfile({
        notificationPermissionAsked: true,
        notificationsEnabled: false,
      }).catch(() => {});
      markSoftPromptDismissed().catch(() => {});
    } finally {
      setSubmitting(false);
      // Force the gate to re-evaluate. AppState foregrounding after
      // the OS dialog usually triggers it on its own, but firing here
      // makes the unmount deterministic regardless of dialog timing.
      triggerGateRecheck();
    }
  };

  const handleLater = async () => {
    if (!profile?.id || submitting) return;
    setSubmitting(true);
    logEvent("push_soft_prompt_later_tapped", {});
    try {
      // Mark asked but DON'T touch the OS-level permission. iOS /
      // Android status stays "undetermined", so a future contextual
      // re-prompt (e.g. when setting a deal alert) can still work.
      updateProfile({
        notificationPermissionAsked: true,
        notificationsEnabled: false,
      }).catch(() => {});
      // Per-device dismissal so we don't re-prompt on the next cold
      // launch of this same install. A new device install won't have
      // this flag and will see the soft prompt again.
      await markSoftPromptDismissed();
    } finally {
      setSubmitting(false);
      triggerGateRecheck();
    }
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.background }}
      edges={["top", "left", "right", "bottom"]}
    >
      <View style={{ flex: 1, paddingHorizontal: 28, paddingTop: 32 }}>
        {/* Hero */}
        <View style={{ alignItems: "center", marginBottom: 32 }}>
          <View
            style={{
              width: 88,
              height: 88,
              borderRadius: 44,
              backgroundColor: colors.brand.traceRed + "12",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 20,
            }}
          >
            <BellRing color={colors.brand.traceRed} size={40} strokeWidth={2.2} />
          </View>
          <Text
            style={{
              fontSize: 26,
              fontWeight: "900",
              color: theme.foreground,
              textAlign: "center",
              marginBottom: 8,
              lineHeight: 32,
            }}
          >
            Be the first to know{"\n"}when great deals drop
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: theme.mutedForeground,
              textAlign: "center",
              lineHeight: 20,
              maxWidth: 320,
            }}
          >
            We'll only ping you about deals that actually matter — no spam,
            and you can turn it off anytime.
          </Text>
        </View>

        {/* Benefits */}
        <View style={{ marginBottom: 32 }}>
          <BenefitRow
            emoji="🔥"
            title="Hot deals & flash sales"
            body={`We'll ping you when a serious price drop lands at ${
              profile?.homeAirport ?? "your home airport"
            }.`}
            theme={theme}
          />
          <BenefitRow
            emoji="✈️"
            title="Alerts for places you care about"
            body="Set an alert for a destination — we'll tell you the second a deal matches."
            theme={theme}
          />
          <BenefitRow
            emoji="⚡"
            title="Be there before they sell out"
            body="The best deals disappear in hours. We make sure you're first."
            theme={theme}
          />
        </View>

        {/* Spacer pushes the CTA cluster to the bottom */}
        <View style={{ flex: 1 }} />

        {/* CTAs */}
        <TouchableOpacity
          onPress={handleEnable}
          disabled={submitting}
          activeOpacity={0.85}
          style={{
            borderRadius: 14,
            overflow: "hidden",
            opacity: submitting ? 0.6 : 1,
          }}
        >
          <LinearGradient
            colors={[colors.brand.traceRed, colors.brand.tracePink]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              paddingVertical: 16,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text
                style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}
              >
                Enable notifications
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleLater}
          disabled={submitting}
          activeOpacity={0.7}
          style={{ marginTop: 16, alignItems: "center", paddingVertical: 8 }}
        >
          <Text
            style={{
              fontSize: 14,
              color: theme.mutedForeground,
              fontWeight: "500",
            }}
          >
            Maybe later
          </Text>
        </TouchableOpacity>

        <Text
          style={{
            textAlign: "center",
            fontSize: 11,
            color: theme.mutedForeground,
            marginTop: Platform.OS === "ios" ? 12 : 18,
            paddingHorizontal: 16,
          }}
        >
          You can change this anytime in Profile → Push notifications.
        </Text>
      </View>
    </SafeAreaView>
  );
}

function BenefitRow({
  emoji,
  title,
  body,
  theme,
}: {
  emoji: string;
  title: string;
  body: string;
  theme: typeof colors.light | typeof colors.dark;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 14,
        marginBottom: 18,
      }}
    >
      <Text style={{ fontSize: 28, lineHeight: 32 }}>{emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 15,
            fontWeight: "700",
            color: theme.foreground,
            marginBottom: 2,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            fontSize: 13,
            color: theme.mutedForeground,
            lineHeight: 18,
          }}
        >
          {body}
        </Text>
      </View>
    </View>
  );
}
