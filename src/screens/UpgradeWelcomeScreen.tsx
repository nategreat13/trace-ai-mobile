import React from "react";
import { View, Text, TouchableOpacity, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { colors } from "../theme/colors";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function UpgradeWelcomeScreen() {
  const navigation = useNavigation<Nav>();
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background, justifyContent: "center", paddingHorizontal: 24 }}>
      <View style={{ alignItems: "center" }}>
        <Text style={{ fontSize: 80, marginBottom: 24 }}>🚀</Text>
        <Text style={{ fontSize: 32, fontWeight: "900", color: theme.foreground, textAlign: "center", marginBottom: 12 }}>
          Upgrade Complete!
        </Text>
        <Text style={{ fontSize: 16, color: theme.mutedForeground, textAlign: "center", marginBottom: 40, lineHeight: 24 }}>
          Your plan has been upgraded. Enjoy all the new features!
        </Text>
        <TouchableOpacity
          onPress={() => navigation.replace("MainTabs", { screen: "SwipeDeck" })}
          style={{
            width: "100%",
            paddingVertical: 18,
            borderRadius: 16,
            backgroundColor: colors.brand.traceRed,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>Continue</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
