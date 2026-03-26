import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { X, Check } from "lucide-react-native";
import { colors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";
import ExternalLinkDisclosure from "../components/ExternalLinkDisclosure";
import { useUpgradeDetection } from "../hooks/useUpgradeDetection";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function SubscriptionPlanScreen() {
  const navigation = useNavigation<Nav>();
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;
  const { user, profile } = useAuth();
  const [showDisclosure, setShowDisclosure] = useState(false);
  const { captureStatus, onReturn } = useUpgradeDetection();
  const [selectedPlan, setSelectedPlan] = useState<string>("premium");

  const plans = [
    {
      name: "Premium",
      id: "premium",
      description: "Unlock all features",
      color: colors.brand.traceRed,
      features: ["Unlimited swipes", "Unlimited saves", "Full Explore", "Deal alerts"],
      current: profile?.subscriptionStatus === "premium",
    },
    {
      name: "Business",
      id: "business",
      description: "The ultimate experience",
      color: colors.brand.amber500,
      features: ["Everything in Premium", "Business class deals", "48h early access", "VIP support"],
      current: profile?.subscriptionStatus === "business",
    },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 }}>
        <Text style={{ fontSize: 20, fontWeight: "800", color: theme.foreground }}>Choose a Plan</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <X color={theme.foreground} size={24} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        {plans.map((plan) => (
          <View
            key={plan.name}
            style={{
              backgroundColor: theme.card,
              borderRadius: 20,
              padding: 24,
              borderWidth: 2,
              borderColor: plan.current ? plan.color : theme.border,
            }}
          >
            {plan.current && (
              <View style={{ backgroundColor: plan.color, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, alignSelf: "flex-start", marginBottom: 12 }}>
                <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>Current Plan</Text>
              </View>
            )}
            <Text style={{ fontSize: 24, fontWeight: "900", color: theme.foreground, marginBottom: 4 }}>{plan.name}</Text>
            <Text style={{ fontSize: 16, color: theme.mutedForeground, marginBottom: 16 }}>{plan.description}</Text>
            {plan.features.map((f, i) => (
              <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <Check color={plan.color} size={16} />
                <Text style={{ fontSize: 14, color: theme.foreground }}>{f}</Text>
              </View>
            ))}
            {!plan.current && (
              <TouchableOpacity
                onPress={() => {
                  setSelectedPlan(plan.id);
                  captureStatus();
                  setShowDisclosure(true);
                }}
                style={{
                  marginTop: 16,
                  paddingVertical: 14,
                  borderRadius: 12,
                  backgroundColor: plan.color,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>
                  Get Started
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </ScrollView>

      <ExternalLinkDisclosure
        visible={showDisclosure}
        onClose={() => setShowDisclosure(false)}
        plan={selectedPlan}
        email={user?.email || undefined}
        onReturn={onReturn}
      />
    </SafeAreaView>
  );
}
