import React, { useState } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  useColorScheme,
} from "react-native";
import { X, Gift } from "lucide-react-native";
import { colors } from "../theme/colors";
import { redeemPromoCode } from "../services/promoApi";
import Purchases from "react-native-purchases";
import { logEvent } from "../lib/analytics";

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Called after a successful redemption so the parent can refresh
   *  whatever subscription state it cares about. */
  onSuccess?: (tier: "premium" | "business") => void;
}

export default function PromoCodeModal({ visible, onClose, onSuccess }: Props) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    tier: "premium" | "business";
    durationDays: number;
  } | null>(null);

  function reset() {
    setCode("");
    setLoading(false);
    setError(null);
    setSuccess(null);
  }

  async function handleSubmit() {
    if (!code.trim() || loading) return;
    setLoading(true);
    setError(null);
    logEvent("promo_redeem_attempted", { code_length: code.trim().length });
    try {
      const result = await redeemPromoCode(code.trim());
      // Force RC to re-fetch CustomerInfo so the local SDK sees the new
      // entitlement immediately. The webhook will mirror to Firestore
      // independently — we don't wait on it.
      try {
        await Purchases.invalidateCustomerInfoCache();
        await Purchases.getCustomerInfo();
      } catch {
        // non-fatal — webhook will catch up
      }
      logEvent("promo_redeem_succeeded", {
        tier: result.tier,
        duration_days: result.durationDays,
      });
      setSuccess({ tier: result.tier, durationDays: result.durationDays });
      onSuccess?.(result.tier);
    } catch (err: any) {
      const msg = err?.message ?? "Something went wrong.";
      setError(msg);
      logEvent("promo_redeem_failed", { reason: msg.slice(0, 100) });
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    onClose();
    // Delay reset so the closing animation doesn't flicker
    setTimeout(reset, 250);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.55)",
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 24,
        }}
      >
        <TouchableOpacity
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          activeOpacity={1}
          onPress={handleClose}
        />
        <View
          style={{
            backgroundColor: theme.background,
            borderRadius: 20,
            padding: 24,
            width: "100%",
            maxWidth: 400,
          }}
        >
          {/* Close X */}
          <TouchableOpacity
            onPress={handleClose}
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: theme.muted,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X color={theme.foreground} size={16} />
          </TouchableOpacity>

          {success ? (
            <View style={{ alignItems: "center", paddingVertical: 8 }}>
              <Text style={{ fontSize: 44, marginBottom: 12 }}>🎉</Text>
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: "900",
                  color: theme.foreground,
                  textAlign: "center",
                  marginBottom: 8,
                }}
              >
                You're in!
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: theme.mutedForeground,
                  textAlign: "center",
                  lineHeight: 20,
                  marginBottom: 24,
                }}
              >
                {success.tier === "business" ? "Business" : "Premium"} access
                granted for {success.durationDays} day
                {success.durationDays === 1 ? "" : "s"}.
              </Text>
              <TouchableOpacity
                onPress={handleClose}
                style={{
                  backgroundColor: colors.brand.traceRed,
                  borderRadius: 12,
                  paddingVertical: 14,
                  paddingHorizontal: 32,
                }}
              >
                <Text
                  style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}
                >
                  Start exploring
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={{ alignItems: "center", marginBottom: 16 }}>
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: colors.brand.traceRed + "15",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 8,
                  }}
                >
                  <Gift color={colors.brand.traceRed} size={24} />
                </View>
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: "900",
                    color: theme.foreground,
                    textAlign: "center",
                  }}
                >
                  Redeem a promo code
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: theme.mutedForeground,
                    textAlign: "center",
                    marginTop: 4,
                  }}
                >
                  Enter the code we gave you to unlock free access.
                </Text>
              </View>

              <TextInput
                value={code}
                onChangeText={(v) => setCode(v.toUpperCase())}
                placeholder="TRACE-XXXX-XXXX-XXXX"
                placeholderTextColor={theme.mutedForeground}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!loading}
                style={{
                  backgroundColor: theme.muted,
                  borderRadius: 12,
                  padding: 14,
                  fontSize: 14,
                  fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
                  color: theme.foreground,
                  borderWidth: 1,
                  borderColor: error ? "#ef4444" : theme.border,
                  textAlign: "center",
                  letterSpacing: 1,
                  marginBottom: 12,
                }}
              />

              {error && (
                <Text
                  style={{
                    color: "#ef4444",
                    fontSize: 12,
                    textAlign: "center",
                    marginBottom: 12,
                  }}
                >
                  {error}
                </Text>
              )}

              <TouchableOpacity
                onPress={handleSubmit}
                disabled={!code.trim() || loading}
                style={{
                  backgroundColor: colors.brand.traceRed,
                  borderRadius: 12,
                  paddingVertical: 14,
                  alignItems: "center",
                  opacity: !code.trim() || loading ? 0.5 : 1,
                }}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text
                    style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}
                  >
                    Redeem
                  </Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
