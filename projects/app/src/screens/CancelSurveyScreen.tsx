import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { X, Check } from "lucide-react-native";
import { colors } from "../theme/colors";
import { logEvent } from "../lib/analytics";
import type { RootStackParamList } from "../navigation/types";

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * "Why did you cancel?" — one question, opened from the push sent when
 * someone turns off auto-renew (RevenueCat CANCELLATION). Apple runs the
 * cancel flow in Settings, so this is the only place we can ask.
 *
 * Answers land in `events` as cancel_survey_answered (reason + optional
 * note). Their access runs to the end of the period either way; nothing
 * here tries to change their mind — the point is to stop guessing.
 */
const REASONS = [
  { key: "too_expensive", label: "Too expensive" },
  { key: "not_traveling_soon", label: "I'm not traveling soon" },
  { key: "deals_not_good", label: "The deals weren't good enough" },
  { key: "airport_not_covered", label: "Not enough from my airport" },
  { key: "just_trying", label: "I was just trying it out" },
  { key: "other", label: "Something else" },
] as const;

export default function CancelSurveyScreen() {
  const navigation = useNavigation<Nav>();
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);
  // Explicit insets rather than SafeAreaView: opened from a push tap, this
  // can mount mid-transition, when SafeAreaView briefly reports zero.
  const insets = useSafeAreaInsets();

  useEffect(() => {
    logEvent("cancel_survey_viewed", {});
  }, []);

  const close = () =>
    navigation.canGoBack() ? navigation.goBack() : navigation.navigate("MainTabs", { screen: "SwipeDeck" });

  const submit = () => {
    if (!reason) return;
    logEvent("cancel_survey_answered", { reason, note: note.trim().slice(0, 500) || null });
    setSent(true);
    setTimeout(close, 1200);
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.background,
        paddingTop: Math.max(insets.top, 44),
        paddingBottom: insets.bottom,
      }}
    >
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <TouchableOpacity
          onPress={close}
          accessibilityLabel="Close"
          style={{
            marginTop: 4,
            marginLeft: 16,
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: theme.muted,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <X size={20} color={theme.foreground} />
        </TouchableOpacity>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24, gap: 10 }}>
          <Text style={{ fontSize: 28, fontWeight: "900", color: theme.foreground, lineHeight: 34 }}>
            {sent ? "Thank you" : "What made you cancel?"}
          </Text>
          <Text style={{ fontSize: 15, color: theme.mutedForeground, lineHeight: 21, marginBottom: 8 }}>
            {sent
              ? "That genuinely helps. You keep Premium until your current period ends."
              : "One tap. It goes straight to the two people who build Trace. You keep Premium until your current period ends."}
          </Text>
          {!sent &&
            REASONS.map((r) => {
              const on = reason === r.key;
              return (
                <TouchableOpacity
                  key={r.key}
                  onPress={() => setReason(r.key)}
                  activeOpacity={0.8}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderWidth: 1.5,
                    borderColor: on ? colors.brand.traceRed : theme.border,
                    backgroundColor: on ? colors.brand.traceRed + "10" : theme.card,
                    borderRadius: 14,
                    paddingHorizontal: 16,
                    paddingVertical: 15,
                  }}
                >
                  <Text style={{ fontSize: 15.5, fontWeight: "600", color: theme.foreground }}>{r.label}</Text>
                  {on && <Check size={18} color={colors.brand.traceRed} strokeWidth={3} />}
                </TouchableOpacity>
              );
            })}
          {!sent && !!reason && (
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Anything else? (optional)"
              placeholderTextColor={theme.mutedForeground}
              multiline
              style={{
                marginTop: 6,
                minHeight: 80,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: theme.border,
                backgroundColor: theme.muted,
                padding: 14,
                fontSize: 15,
                color: theme.foreground,
                textAlignVertical: "top",
              }}
            />
          )}
        </ScrollView>
        {!sent && (
          <View style={{ paddingHorizontal: 24, paddingBottom: 12 }}>
            <TouchableOpacity
              onPress={submit}
              disabled={!reason}
              style={{
                backgroundColor: colors.brand.traceRed,
                opacity: reason ? 1 : 0.4,
                borderRadius: 12,
                paddingVertical: 17,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#fff", fontSize: 17, fontWeight: "800" }}>Send</Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}
