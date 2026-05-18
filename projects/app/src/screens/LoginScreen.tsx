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
import { logEvent } from "../lib/analytics";
import { LinearGradient } from "expo-linear-gradient";

type Nav = NativeStackNavigationProp<RootStackParamList>;

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
        const msg = error?.message || "Could not send reset email.";
        Alert.alert("Error", msg);
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
      } else {
        await login(email.trim(), password);
        logEvent("login", { method: "email" });
      }
    } catch (error: any) {
      const msg = error?.message || "Authentication failed";
      Alert.alert("Error", msg);
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
            borderRadius: 14,
            padding: 4,
            marginBottom: 20,
          }}>
            {(["Sign Up", "Sign In"] as const).map((label) => {
              const active = label === "Sign Up" ? isSignup : !isSignup;
              return active ? (
                <LinearGradient
                  key={label}
                  colors={[colors.brand.traceRed, colors.brand.tracePink]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ flex: 1, borderRadius: 10 }}
                >
                  <TouchableOpacity
                    onPress={() => setIsSignup(label === "Sign Up")}
                    style={{ paddingVertical: 11, alignItems: "center" }}
                  >
                    <Text style={{ fontSize: 15, fontWeight: "800", color: "#fff" }}>{label}</Text>
                  </TouchableOpacity>
                </LinearGradient>
              ) : (
                <TouchableOpacity
                  key={label}
                  onPress={() => setIsSignup(label === "Sign Up")}
                  style={{ flex: 1, paddingVertical: 11, alignItems: "center", borderRadius: 10 }}
                >
                  <Text style={{ fontSize: 15, fontWeight: "600", color: theme.mutedForeground }}>{label}</Text>
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
