import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { X, Check, Shield } from "lucide-react-native";
import { colors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";
import { useProfile } from "../hooks/useProfile";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import type { RootStackParamList } from "../navigation/types";

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, "TrialSignup">;

export default function TrialSignupScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;
  const { user } = useAuth();
  const { updateProfile } = useProfile();
  const [loading, setLoading] = useState(false);

  const plan = route.params?.plan || "premium";
  const isPremiumPlan = plan === "premium";

  const handleStartTrial = async () => {
    setLoading(true);
    try {
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 3); // 3-day trial
      await updateProfile({
        subscriptionStatus: isPremiumPlan ? "trial" : "trial",
        trialEndDate: trialEnd,
      });
      navigation.replace(isPremiumPlan ? "PremiumWelcome" : "BusinessWelcome");
    } catch (error) {
      console.error("Failed to start trial:", error);
    } finally {
      setLoading(false);
    }
  };

  const features = isPremiumPlan
    ? [
        "Unlimited daily swipes",
        "Unlimited saved deals",
        "Full Explore access",
        "Priority deal alerts",
      ]
    : [
        "Everything in Premium",
        "Business class deals",
        "48h early access",
        "VIP support",
      ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Close button */}
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={{ position: "absolute", top: 56, right: 16, zIndex: 10, padding: 8 }}
      >
        <X color={theme.foreground} size={24} />
      </TouchableOpacity>

      <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 24 }}>
        {/* Plan header */}
        <View style={{ alignItems: "center", marginBottom: 32 }}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: isPremiumPlan ? colors.brand.traceRed : colors.brand.amber500,
              justifyContent: "center",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <Text style={{ fontSize: 36 }}>{isPremiumPlan ? "✈️" : "👑"}</Text>
          </View>
          <Text style={{ fontSize: 28, fontWeight: "900", color: theme.foreground, textAlign: "center" }}>
            {isPremiumPlan ? "Premium" : "Business Class"}
          </Text>
          <Text style={{ fontSize: 14, color: theme.mutedForeground, marginTop: 4, textAlign: "center" }}>
            3-day free trial · Cancel anytime
          </Text>
        </View>

        {/* Price */}
        <View
          style={{
            backgroundColor: theme.card,
            borderRadius: 20,
            padding: 24,
            borderWidth: 1,
            borderColor: theme.border,
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <Text style={{ fontSize: 40, fontWeight: "900", color: theme.foreground }}>
            {isPremiumPlan ? "$49" : "$139"}
          </Text>
          <Text style={{ fontSize: 14, color: theme.mutedForeground }}>/year</Text>
        </View>

        {/* Features */}
        <View style={{ gap: 12, marginBottom: 32 }}>
          {features.map((f, i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: isPremiumPlan ? colors.brand.traceRed : colors.brand.amber500,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Check color="#fff" size={14} strokeWidth={3} />
              </View>
              <Text style={{ fontSize: 16, color: theme.foreground }}>{f}</Text>
            </View>
          ))}
        </View>

        {/* CTA */}
        <TouchableOpacity
          onPress={handleStartTrial}
          disabled={loading}
          style={{
            paddingVertical: 18,
            borderRadius: 16,
            backgroundColor: isPremiumPlan ? colors.brand.traceRed : colors.brand.amber500,
            alignItems: "center",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>Start Free Trial</Text>
          )}
        </TouchableOpacity>

        {/* Trust */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 16 }}>
          <Shield color={theme.mutedForeground} size={14} />
          <Text style={{ fontSize: 12, color: theme.mutedForeground }}>
            Cancel anytime · No charge today
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
