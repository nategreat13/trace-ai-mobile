import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColorScheme } from "react-native";
import { colors } from "../theme/colors";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { login, signup, requestPasswordReset } from "../services/auth";
import { auth } from "../services/firebase";
import { trackSignup } from "../services/trackingApi";
import { logEvent } from "../lib/analytics";

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Firebase's own `error.message` reads "Firebase: Error
 * (auth/email-already-in-use)." — which we were showing to users verbatim in
 * an OK-only alert. Map the codes we actually hit to plain English.
 */
function friendlyAuthError(code: string | undefined, fallback: string): string {
  switch (code) {
    case "auth/invalid-email":
      return "That doesn't look like a valid email address.";
    case "auth/weak-password":
      return "Passwords need to be at least 6 characters.";
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "That email and password don't match. Try again, or reset your password.";
    case "auth/user-not-found":
      return "We couldn't find an account with that email.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a minute and try again.";
    case "auth/network-request-failed":
      return "Couldn't reach the network. Check your connection and try again.";
    default:
      return fallback;
  }
}

export default function LoginScreen() {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, "Login">>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignup, setIsSignup] = useState(route.params?.mode !== "signin");
  /**
   * "forgot" mode reuses the email field but hides the password field
   * and re-labels the submit button. Sending the reset email returns
   * the user to sign-in mode after a success alert.
   */
  const [isForgot, setIsForgot] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (isForgot) {
      if (!email.trim()) {
        Alert.alert("Email required", "Enter your email address.");
        return;
      }
      setLoading(true);
      try {
        await requestPasswordReset(email.trim());
        logEvent("password_reset_requested", {});
        Alert.alert(
          "Check your email",
          "If an account exists for that address, we've sent a reset link.",
          [{ text: "OK", onPress: () => setIsForgot(false) }]
        );
      } catch (error: any) {
        Alert.alert(
          "Error",
          friendlyAuthError(error?.code, "Could not send reset email."),
        );
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!email.trim() || !password.trim()) {
      Alert.alert("Error", "Please enter email and password");
      return;
    }
    setLoading(true);
    try {
      if (isSignup) {
        await signup(email.trim(), password);
        logEvent("signup_completed", { method: "email" });
        // Fire Meta CAPI `CompleteRegistration` via our server. This is
        // the *acquisition* signal — fires for every new Auth signup,
        // including users who later abandon onboarding. Fire-and-forget;
        // never blocks the navigation to the next screen. The server
        // also enriches with the request IP + user-agent before
        // forwarding to Meta, which is the highest-value match signal
        // we have without the Meta Mobile SDK installed.
        let country: string | null = null;
        try {
          const locale = Intl.DateTimeFormat().resolvedOptions().locale;
          if (locale && locale.includes("-")) {
            country = locale.split("-")[1];
          }
        } catch {
          /* best-effort */
        }
        const currentUser = auth.currentUser;
        if (currentUser) {
          trackSignup({
            userId: currentUser.uid,
            email: email.trim() || currentUser.email || null,
            country,
          });
        }
      } else {
        await login(email.trim(), password);
        logEvent("login", { method: "email" });
      }
    } catch (error: any) {
      /**
       * Signing up with an email that already has an account was a dead end:
       * an OK-only alert containing a raw Firebase string, with no way
       * forward. Two people hit it in 1.10.0's first week and neither got in.
       * Both routes out are one tap now, and the email they typed carries
       * over to whichever they pick.
       */
      if (isSignup && error?.code === "auth/email-already-in-use") {
        logEvent("signup_existing_email", {});
        Alert.alert(
          "You already have an account",
          `${email.trim()} is already registered. Sign in instead, or reset your password if you've forgotten it.`,
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Reset password",
              onPress: () => {
                setIsSignup(false);
                setIsForgot(true);
                setPassword("");
              },
            },
            {
              text: "Sign in",
              onPress: () => {
                setIsSignup(false);
                setPassword("");
              },
            },
          ],
        );
        return;
      }
      Alert.alert(
        "Error",
        friendlyAuthError(error?.code, error?.message || "Authentication failed"),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Back to landing */}
      {navigation.canGoBack() && (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ paddingHorizontal: 20, paddingTop: 8 }}
        >
          <Text style={{ color: theme.mutedForeground, fontSize: 16 }}>
            ← Back
          </Text>
        </TouchableOpacity>
      )}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1, justifyContent: "center", paddingHorizontal: 24 }}
      >
        {/* Logo */}
        <View style={{ alignItems: "center", marginBottom: 28 }}>
          <Image
            source={require("../../assets/Bluelogo.png")}
            style={{ width: 56, height: 56, resizeMode: "contain", marginBottom: 10 }}
          />
          <Text style={{ fontSize: 26, fontWeight: "900", color: theme.foreground, marginBottom: 6 }}>
            Trace Travel
          </Text>
          <Text style={{ fontSize: 14, color: theme.mutedForeground }}>
            Your next adventure starts with a swipe
          </Text>
        </View>

        {/* Sign In / Sign Up tab toggle */}
        {!isForgot && (
          <View style={{
            flexDirection: "row",
            backgroundColor: theme.muted,
            borderRadius: 12,
            padding: 3,
            marginBottom: 20,
          }}>
            {(["Sign Up", "Sign In"] as const).map((label) => {
              const active = label === "Sign Up" ? isSignup : !isSignup;
              return (
                <TouchableOpacity
                  key={label}
                  onPress={() => setIsSignup(label === "Sign Up")}
                  style={{
                    flex: 1,
                    paddingVertical: 7,
                    alignItems: "center",
                    borderRadius: 10,
                    backgroundColor: active ? theme.background : "transparent",
                  }}
                >
                  <Text style={{
                    fontSize: 13,
                    fontWeight: active ? "700" : "500",
                    color: active ? (label === "Sign Up" ? colors.brand.traceRed : "#4A90D9") : theme.mutedForeground,
                  }}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Form */}
        <View style={{ gap: 12 }}>
          <TextInput
            placeholder="Email"
            placeholderTextColor={theme.mutedForeground}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            style={{
              backgroundColor: theme.muted,
              borderRadius: 12,
              padding: 14,
              fontSize: 16,
              color: theme.foreground,
              borderWidth: 1,
              borderColor: theme.border,
            }}
          />
          {!isForgot && (
            <TextInput
              placeholder="Password"
              placeholderTextColor={theme.mutedForeground}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              style={{
                backgroundColor: theme.muted,
                borderRadius: 12,
                padding: 14,
                fontSize: 16,
                color: theme.foreground,
                borderWidth: 1,
                borderColor: theme.border,
              }}
            />
          )}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={loading}
            style={{
              backgroundColor: colors.brand.traceRed,
              borderRadius: 12,
              padding: 16,
              alignItems: "center",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>
                {isForgot
                  ? "Email reset link"
                  : isSignup
                    ? "Create Account"
                    : "Sign In"}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Forgot password (sign-in mode only) */}
        {!isSignup && !isForgot && (
          <TouchableOpacity
            onPress={() => setIsForgot(true)}
            style={{ marginTop: 12, alignItems: "center" }}
          >
            <Text style={{ color: theme.mutedForeground, fontSize: 13 }}>
              Forgot password?
            </Text>
          </TouchableOpacity>
        )}

        {/* Back to sign-in (forgot mode only) */}
        {isForgot && (
          <TouchableOpacity
            onPress={() => setIsForgot(false)}
            style={{ marginTop: 12, alignItems: "center" }}
          >
            <Text style={{ color: theme.mutedForeground, fontSize: 13 }}>
              ← Back to sign in
            </Text>
          </TouchableOpacity>
        )}


      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
