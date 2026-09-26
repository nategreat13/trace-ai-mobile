import React from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  ActivityIndicator,
} from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { Bell, Bookmark, TrendingDown } from "lucide-react-native";
import { colors } from "../../theme/colors";

/**
 * The account ask, moved to the end of onboarding.
 *
 * It used to be the second screen in the app. Everyone who wouldn't invent a
 * password for a product they hadn't seen was lost before the demo, the feed
 * or the paywall — the most expensive possible place to lose someone, because
 * they cost the same to acquire as the ones who convert.
 *
 * By the time this renders they've picked an airport, seen a real fare from
 * it, swiped a deck and watched their feed get built. The ask is the same;
 * what's changed is that there's now something to lose by refusing, which is
 * what the three lines below name.
 */
export interface AccountDraft {
  email: string;
  password: string;
}

interface AccountBeatProps {
  value: AccountDraft;
  onChange: (next: AccountDraft) => void;
  /** Set when linking failed — already-registered email, weak password, etc. */
  error: string | null;
  busy: boolean;
  firstName?: string;
  /**
   * Offered only when the email is already registered. Without it that error
   * is a dead end: there's no route from inside onboarding to the sign-in
   * screen, so the user would be stuck holding an email they can't use.
   */
  onSignInInstead?: () => void;
}

const KEEPS = [
  { Icon: Bookmark, text: "The feed we just built for you" },
  { Icon: Bell, text: "Alerts the moment a fare drops" },
  { Icon: TrendingDown, text: "Every price we track from your airport" },
];

export default function AccountBeat({
  value,
  onChange,
  error,
  busy,
  firstName,
  onSignInInstead,
}: AccountBeatProps) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;

  const field = {
    backgroundColor: theme.muted,
    borderColor: error ? colors.brand.traceRed : theme.border,
    color: theme.foreground,
  };

  return (
    <View style={styles.wrap}>
      <Animated.View
        entering={FadeInDown.duration(380)}
        style={[styles.keeps, { backgroundColor: theme.muted }]}
      >
        {KEEPS.map(({ Icon, text }) => (
          <View key={text} style={styles.keepRow}>
            <Icon size={17} color={colors.brand.traceRed} strokeWidth={2.4} />
            <Text style={[styles.keepText, { color: theme.foreground }]}>
              {text}
            </Text>
          </View>
        ))}
      </Animated.View>

      <Animated.View entering={FadeIn.duration(360).delay(120)} style={styles.form}>
        <TextInput
          value={value.email}
          onChangeText={(email) => onChange({ ...value, email })}
          placeholder="Email"
          placeholderTextColor={theme.mutedForeground}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          editable={!busy}
          style={[styles.input, field]}
        />
        <TextInput
          value={value.password}
          onChangeText={(password) => onChange({ ...value, password })}
          placeholder="Password"
          placeholderTextColor={theme.mutedForeground}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          // `newPassword` asks the keychain to offer a strong one and to save
          // it, which is the difference between a password they'll have next
          // time and one they'll reset.
          textContentType="newPassword"
          editable={!busy}
          style={[styles.input, field]}
        />

        {error ? (
          <View style={styles.errorBlock}>
            <Text style={[styles.error, { color: colors.brand.traceRed }]}>
              {error}
            </Text>
            {onSignInInstead ? (
              <TouchableOpacity
                onPress={onSignInInstead}
                disabled={busy}
                style={[styles.signIn, { borderColor: theme.border }]}
              >
                <Text style={[styles.signInText, { color: theme.foreground }]}>
                  Sign in instead
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          <Text style={[styles.hint, { color: theme.mutedForeground }]}>
            At least 6 characters.
          </Text>
        )}
      </Animated.View>

      {busy ? (
        <View style={styles.busy}>
          <ActivityIndicator color={colors.brand.traceRed} />
          <Text style={[styles.busyText, { color: theme.mutedForeground }]}>
            {firstName ? `Saving your feed, ${firstName}…` : "Saving your feed…"}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 20 },
  keeps: { borderRadius: 16, padding: 16, gap: 13 },
  keepRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  keepText: { fontSize: 15, fontWeight: "600", flex: 1 },
  form: { gap: 10 },
  input: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 16,
  },
  hint: { fontSize: 12.5, paddingHorizontal: 4 },
  errorBlock: { gap: 10 },
  error: { fontSize: 13, fontWeight: "600", paddingHorizontal: 4, lineHeight: 18 },
  signIn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 11,
    paddingVertical: 12,
    alignItems: "center",
  },
  signInText: { fontSize: 14.5, fontWeight: "700" },
  busy: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 },
  busyText: { fontSize: 14 },
});
