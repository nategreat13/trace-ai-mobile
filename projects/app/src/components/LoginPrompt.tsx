import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  useColorScheme,
} from "react-native";
import { LogIn } from "lucide-react-native";
import { colors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";

interface LoginPromptProps {
  visible: boolean;
  onClose: () => void;
  message?: string;
}

export default function LoginPrompt({ visible, onClose, message }: LoginPromptProps) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;
  const { exitGuestMode } = useAuth();

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.6)",
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 16,
        }}
      >
        <View
          style={{
            backgroundColor: theme.card,
            borderRadius: 24,
            padding: 28,
            width: "100%",
            maxWidth: 380,
            borderWidth: 1,
            borderColor: theme.border,
            alignItems: "center",
          }}
        >
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: colors.brand.traceRed,
              justifyContent: "center",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <LogIn color="#fff" size={32} />
          </View>
          <Text
            style={{
              fontSize: 22,
              fontWeight: "900",
              color: theme.foreground,
              marginBottom: 8,
              textAlign: "center",
            }}
          >
            Create an Account
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: theme.mutedForeground,
              textAlign: "center",
              marginBottom: 24,
              lineHeight: 20,
            }}
          >
            {message || "Sign up to save deals, track your favorites, and unlock personalized recommendations."}
          </Text>
          <TouchableOpacity
            onPress={() => {
              onClose();
              exitGuestMode();
            }}
            style={{
              width: "100%",
              paddingVertical: 14,
              borderRadius: 16,
              backgroundColor: colors.brand.traceRed,
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>
              Sign Up
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose}>
            <Text style={{ color: theme.mutedForeground, fontSize: 14 }}>
              Not Now
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}
