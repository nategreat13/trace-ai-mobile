import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  useColorScheme,
} from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { ExternalLink } from "lucide-react-native";
import { colors } from "../theme/colors";
import { openSubscribeUrl } from "../lib/openSubscribeUrl";

interface ExternalLinkDisclosureProps {
  visible: boolean;
  onClose: () => void;
  plan?: string;
  email?: string;
}

export default function ExternalLinkDisclosure({
  visible,
  onClose,
  plan,
  email,
}: ExternalLinkDisclosureProps) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;

  const handleContinue = async () => {
    onClose();
    await openSubscribeUrl(plan, email);
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        style={styles.overlay}
      >
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <Animated.View
            entering={FadeInUp.springify().damping(20).stiffness(200)}
            style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
          >
            <View style={styles.iconContainer}>
              <ExternalLink size={24} color="#ffffff" />
            </View>

            <Text style={[styles.title, { color: theme.foreground }]}>
              You're leaving Trace
            </Text>
            <Text style={[styles.body, { color: theme.mutedForeground }]}>
              You'll be taken to our website to view subscription plans and
              complete your purchase. Subscriptions are managed by the developer,
              not Apple.
            </Text>

            <TouchableOpacity
              onPress={handleContinue}
              style={styles.continueButton}
              activeOpacity={0.85}
            >
              <Text style={styles.continueText}>Continue</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={onClose} style={styles.cancelButton}>
              <Text style={[styles.cancelText, { color: theme.mutedForeground }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    backgroundColor: colors.brand.rose500,
  },
  title: {
    fontSize: 21,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  continueButton: {
    width: "100%",
    backgroundColor: colors.brand.rose500,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: "center",
    marginBottom: 12,
  },
  continueText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  cancelButton: {
    paddingVertical: 4,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: "500",
  },
});
