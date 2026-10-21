import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { colors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";
import { useProfile } from "../hooks/useProfile";
import { linkEmailPassword, login, requestPasswordReset } from "../services/auth";
import { initializeIAP, restorePurchases } from "../services/iap";
import { auth } from "../services/firebase";
import { trackSignup } from "../services/trackingApi";
import { identifyForMeta, logMetaCompleteRegistration } from "../lib/metaAppEvents";
import { logEvent } from "../lib/analytics";
import AccountBeat, { type AccountDraft } from "../components/onboarding/AccountBeat";
import type { RootStackParamList } from "../navigation/types";

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * The email ask, after a trial starts (Oct 2026 swipe-first flow).
 *
 * Onboarding no longer asks for an account: 40% of 1.11.0 users who reached
 * that step left, and an in-app purchase never tells us who bought it. So the
 * ask moves to the one moment someone has every reason to say yes — they've
 * just started a trial and want their saves, alerts and subscription to
 * follow them to any phone.
 *
 * It's skippable. The trial, saves and alerts all work on the anonymous
 * session; "Not now" just means they live on this device until restored.
 */
export default function SaveAccountScreen() {
  const navigation = useNavigation<Nav>();
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;
  const { profile, setProfile } = useAuth();
  const { updateProfile } = useProfile();

  const [account, setAccount] = useState<AccountDraft>({ email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [emailTaken, setEmailTaken] = useState(false);

  useEffect(() => {
    logEvent("signup_viewed", { at: "post_trial" });
  }, []);

  // Opened from Profile it pops back there; after a purchase it replaced
  // PremiumWelcome, so the deck is the place to land.
  const done = () =>
    navigation.canGoBack()
      ? navigation.goBack()
      : navigation.replace("MainTabs", { screen: "SwipeDeck" });

  const save = async () => {
    const email = account.email.trim();
    if (!email || account.password.length < 6) {
      setError("Enter an email and a password of at least 6 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await linkEmailPassword(email, account.password);
      logEvent("signup_completed", { method: "email", at: "post_trial" });
      // The profile was created anonymously with no email; give it the one
      // they just chose so receipts, win-back and trial reminders can reach
      // them.
      setProfile((prev) => (prev ? { ...prev, email } : prev));
      updateProfile({ email }).catch(() => {});

      const current = auth.currentUser;
      if (current) {
        let country: string | null = null;
        try {
          const locale = Intl.DateTimeFormat().resolvedOptions().locale;
          if (locale && locale.includes("-")) country = locale.split("-")[1];
        } catch {
          /* best-effort */
        }
        trackSignup({ userId: current.uid, email, country, source: "post_trial" });
        identifyForMeta(current.uid, email);
        logMetaCompleteRegistration("email");
      }
      done();
    } catch (err: any) {
      const code = err?.code || "";
      if (code === "auth/email-already-in-use") {
        setEmailTaken(true);
        logEvent("signup_existing_email", { at: "post_trial" });
      }
      logEvent("signup_failed", { method: "email", code, at: "post_trial" });
      setError(
        code === "auth/email-already-in-use"
          ? "That email already has a Trace account. Sign in to it and your trial moves over with you."
          : code === "auth/invalid-email"
            ? "That doesn't look like a valid email address."
            : code === "auth/weak-password"
              ? "Pick a password with at least 6 characters."
              : err?.message || "Could not save your account. Try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  /**
   * An existing customer who started a trial on this phone before signing in.
   * The trial was bought under the anonymous account, so after signing in we
   * restore purchases: with RevenueCat's restore behaviour set to transfer,
   * that moves the trial to the account they signed into. Their existing
   * account's profile and saves take over from there.
   */
  const signInInstead = async () => {
    const email = account.email.trim();
    setBusy(true);
    setError(null);
    try {
      await login(email, account.password);
      logEvent("login", { method: "email", at: "post_trial" });
      const uid = auth.currentUser?.uid;
      if (uid) {
        await initializeIAP(uid);
        await restorePurchases().catch((err) =>
          console.warn("[SaveAccount] restore after sign-in failed:", err),
        );
      }
      done();
    } catch {
      setError(
        "That password doesn't match the account for this email. Try again, or email yourself a reset link below.",
      );
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async () => {
    const email = account.email.trim();
    if (!email) return;
    setBusy(true);
    try {
      await requestPasswordReset(email);
      logEvent("password_reset_requested", { at: "post_trial" });
      setError(
        `We've emailed a reset link to ${email}. Set a new password from it, then come back here and tap Sign in instead.`,
      );
    } catch {
      setError("We couldn't send the reset email. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const canSave = account.email.trim().length > 3 && account.password.length >= 6 && !busy;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 32, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={{ fontSize: 30, fontWeight: "900", color: theme.foreground, lineHeight: 36 }}>
            Where should we send your deals?
          </Text>
          <Text
            style={{
              fontSize: 15.5,
              color: theme.mutedForeground,
              marginTop: 10,
              marginBottom: 24,
              lineHeight: 22,
            }}
          >
            Save your account so your saves — and your subscription, if you
            have one — follow you to any phone. We'll remind you before a trial
            ends.
          </Text>
          <AccountBeat
            value={account}
            onChange={setAccount}
            error={error}
            busy={busy}
            firstName={profile?.firstName}
            onSignInInstead={emailTaken ? signInInstead : undefined}
            onResetPassword={emailTaken ? resetPassword : undefined}
          />
        </ScrollView>

        <View style={{ paddingHorizontal: 24, paddingBottom: 12, gap: 4 }}>
          <TouchableOpacity
            onPress={save}
            disabled={!canSave}
            activeOpacity={0.85}
            style={{
              backgroundColor: colors.brand.traceRed,
              opacity: canSave ? 1 : 0.4,
              borderRadius: 12,
              paddingVertical: 17,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontSize: 17, fontWeight: "800" }}>
              Save my account
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              logEvent("signup_skipped", { at: "post_trial" });
              done();
            }}
            style={{ paddingVertical: 14, alignItems: "center" }}
          >
            <Text style={{ color: theme.mutedForeground, fontSize: 14, fontWeight: "600" }}>
              Not now
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
