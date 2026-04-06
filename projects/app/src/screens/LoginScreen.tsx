import React, { useState } from "react";
import {
  View,
  Text,
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
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { login, signup } from "../services/auth";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function LoginScreen() {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;
  const navigation = useNavigation<Nav>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignup, setIsSignup] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Error", "Please enter email and password");
      return;
    }
    setLoading(true);
    try {
      if (isSignup) {
        await signup(email.trim(), password);
      } else {
        await login(email.trim(), password);
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
        <View style={{ alignItems: "center", marginBottom: 32 }}>
          <Text style={{ fontSize: 40, marginBottom: 8 }}>✈️</Text>
          <Text
            style={{
              fontSize: 28,
              fontWeight: "800",
              color: theme.foreground,
              marginBottom: 4,
            }}
          >
            Trace AI
          </Text>
          <Text style={{ fontSize: 14, color: theme.mutedForeground }}>
            Your next adventure starts with a swipe
          </Text>
        </View>

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
                {isSignup ? "Create Account" : "Sign In"}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Toggle */}
        <TouchableOpacity
          onPress={() => setIsSignup(!isSignup)}
          style={{ marginTop: 20, alignItems: "center" }}
        >
          <Text style={{ color: theme.mutedForeground, fontSize: 14 }}>
            {isSignup
              ? "Already have an account? Sign In"
              : "Don't have an account? Sign Up"}
          </Text>
        </TouchableOpacity>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
