import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  useColorScheme,
  Share,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Updates from "expo-updates";
import * as Application from "expo-application";
import Constants from "expo-constants";
import { signOut } from "firebase/auth";
import type { TraceEnv } from "@trace/shared";
import type { RootStackParamList } from "../navigation/types";
import { colors } from "../theme/colors";
import { auth } from "../services/firebase";
import { getEnv, setEnv } from "../lib/env";
import { API_BASE_URL } from "../lib/constants";
import firebaseApp from "../../firebaseConfig";
import ErrorBoundary from "../components/ErrorBoundary";

/**
 * Hidden diagnostics screen. Accessed via a 3-second long-press on the
 * Trace logo on either the LandingScreen (unauthed) or the ProfileScreen
 * (authed). Production users will never find it; beta testers and devs
 * can flip env and copy build info without needing a separate dev tool.
 *
 * Surfaces everything useful for a "what's actually running on my
 * device?" debugging session: app version, build number, runtime
 * version, OTA update ID, git SHA, push token, Auth UID, etc.
 *
 * Decisions baked in:
 *   - No passcode (decision 4): the long-press is the gate.
 *   - Switching env signs out + reloads the JS bundle — see
 *     `lib/env.ts` for why both are needed.
 */

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface Row {
  label: string;
  value: string;
  copy?: boolean;
}

/**
 * Wrap any sync expression that could throw at access time. Returns the
 * fallback string instead of letting the whole component blow up.
 *
 * The diagnostics screen reads from a lot of native + global surfaces
 * (Application.*, Updates.*, firebaseApp.options.*, global.HermesInternal).
 * Any one of those could throw on a particular OS version / build profile
 * — and one throw inside a render would crash the whole modal. With safe()
 * the row whose value can't resolve just shows "" (or the explicit
 * fallback) and everything else still renders. Better partial info than
 * a black screen.
 */
function safe<T>(fn: () => T, fallback = "" as unknown as T): T {
  try {
    const v = fn();
    return v == null ? fallback : v;
  } catch {
    return fallback;
  }
}

function fmtTimestamp(unixSeconds: number): string {
  if (!unixSeconds) return "";
  try {
    return new Date(unixSeconds * 1000).toISOString();
  } catch {
    return "";
  }
}

function DiagnosticsScreenInner() {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;
  const navigation = useNavigation<Nav>();

  const [env, setEnvState] = useState<TraceEnv>(() => safe(() => getEnv(), "prod"));
  const [authUid, setAuthUid] = useState<string | null>(() =>
    safe(() => auth?.currentUser?.uid ?? null, null)
  );

  // Auth state can change while this screen is open (e.g. switching env
  // signs out). Subscribe so the displayed UID is always current.
  // Wrapped in try/catch so a bad auth instance can't kill the screen
  // at mount time — worst case the UID just doesn't update.
  useEffect(() => {
    try {
      return auth.onAuthStateChanged((u) => setAuthUid(u?.uid ?? null));
    } catch {
      return undefined;
    }
  }, []);

  const handleSwitchEnv = useCallback(
    async (next: TraceEnv) => {
      if (next === env) return;
      Alert.alert(
        `Switch to ${next.toUpperCase()}?`,
        next === "staging"
          ? "The app will sign you out and reload. Real production users should never do this — staging data is isolated from production."
          : "The app will sign you out and reload, then talk to the production API and database.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: `Switch to ${next}`,
            style: "destructive",
            onPress: async () => {
              try {
                // Sign out first — the new env may not have a userProfile
                // doc for the current Auth UID. Landing them on the
                // landing screen is the cleanest UX.
                await signOut(auth);
              } catch {
                // best-effort; signOut can fail if already signed out
              }
              try {
                await setEnv(next);
                // Updates.reloadAsync inside setEnv will preempt this,
                // but kept here for clarity.
                setEnvState(next);
              } catch (err: any) {
                Alert.alert(
                  "Failed to switch",
                  String(err?.message ?? err) || "unknown error"
                );
              }
            },
          },
        ]
      );
    },
    [env]
  );

  const handleReload = useCallback(() => {
    Updates.reloadAsync().catch((err) => {
      Alert.alert("Reload failed", String(err?.message ?? err));
    });
  }, []);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut(auth);
    } catch (err: any) {
      Alert.alert("Sign out failed", String(err?.message ?? err));
    }
  }, []);

  const handleClose = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  // Build the row list lazily on each render. Every value goes through
  // safe() — if any single read throws (a missing native binding, an
  // unexpected shape on a particular OS version, etc.) we just show ""
  // for that row instead of crashing the whole screen.
  const extra = safe<{ gitSha?: string; buildTimestamp?: number; devApiUrl?: string | null }>(
    () => (Constants.expoConfig?.extra ?? {}) as any,
    {}
  );
  const gitSha = safe(() => extra.gitSha ?? "", "");
  const buildTimestamp = safe(() => extra.buildTimestamp ?? 0, 0);

  const rows: Row[] = [
    { label: "Environment", value: safe(() => env.toUpperCase(), "") },
    { label: "App version", value: safe(() => Application.nativeApplicationVersion ?? "", "") },
    { label: "Build number", value: safe(() => Application.nativeBuildVersion ?? "", "") },
    { label: "Runtime version", value: safe(() => String(Updates.runtimeVersion ?? ""), "") },
    { label: "OTA channel", value: safe(() => Updates.channel ?? "", "") },
    { label: "OTA update ID", value: safe(() => Updates.updateId ?? "(embedded bundle)", "") },
    { label: "Git SHA", value: gitSha, copy: true },
    { label: "Build timestamp (UTC)", value: fmtTimestamp(buildTimestamp) },
    {
      label: "Platform",
      value: safe(() => `${Platform.OS} ${String(Platform.Version ?? "")}`, ""),
    },
    { label: "Bundle ID", value: safe(() => Application.applicationId ?? "", "") },
    { label: "Auth UID", value: safe(() => authUid ?? "(not signed in)", ""), copy: true },
    {
      label: "Firebase project",
      value: safe(() => firebaseApp?.options?.projectId ?? "", ""),
    },
    { label: "API base URL", value: safe(() => API_BASE_URL, ""), copy: true },
    { label: "Dev API URL override", value: safe(() => extra.devApiUrl ?? "", "") },
    {
      label: "Hermes enabled",
      // `global.HermesInternal` exists on Hermes; reading `global` in
      // strict mode has been known to throw on some RN versions.
      value: safe(() => String(!!(globalThis as any).HermesInternal), ""),
    },
  ];

  const handleCopyAll = useCallback(async () => {
    const dump = rows.map((r) => `${r.label}: ${r.value}`).join("\n");
    try {
      await Share.share({ message: dump });
    } catch {
      // ignore — Share is best-effort on iOS/Android variants
    }
  }, [rows]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingBottom: 60,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <Text
            style={{
              fontSize: 22,
              fontWeight: "800",
              color: theme.foreground,
            }}
          >
            Diagnostics
          </Text>
          <Pressable
            onPress={handleClose}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 8,
              backgroundColor: theme.muted,
            }}
          >
            <Text style={{ color: theme.foreground, fontWeight: "600" }}>
              Close
            </Text>
          </Pressable>
        </View>

        {/* Env toggle — most prominent control on the screen */}
        <View
          style={{
            backgroundColor: theme.card,
            borderRadius: 12,
            padding: 16,
            marginBottom: 20,
            borderWidth: env === "staging" ? 2 : 1,
            borderColor: env === "staging" ? "#f59e0b" : theme.border,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: "700",
              color: theme.foreground,
              marginBottom: 10,
              letterSpacing: 0.5,
            }}
          >
            ENVIRONMENT
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {(["prod", "staging"] as TraceEnv[]).map((opt) => {
              const active = opt === env;
              return (
                <Pressable
                  key={opt}
                  onPress={() => handleSwitchEnv(opt)}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 8,
                    backgroundColor: active
                      ? opt === "staging"
                        ? "#f59e0b"
                        : "#2563eb"
                      : theme.muted,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      color: active ? "#fff" : theme.foreground,
                      fontWeight: "700",
                    }}
                  >
                    {opt.toUpperCase()}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {env === "staging" && (
            <Text
              style={{
                marginTop: 10,
                fontSize: 12,
                color: "#b45309",
                fontWeight: "600",
              }}
            >
              ⚠ You are viewing the STAGING environment. Test data only.
            </Text>
          )}
        </View>

        {/* Diagnostics rows */}
        <View
          style={{
            backgroundColor: theme.card,
            borderRadius: 12,
            paddingVertical: 4,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: theme.border,
          }}
        >
          {rows.map((row, i) => (
            <View
              key={row.label}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderBottomWidth: i < rows.length - 1 ? 1 : 0,
                borderBottomColor: theme.border,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  color: theme.mutedForeground,
                  letterSpacing: 0.5,
                  marginBottom: 4,
                }}
              >
                {row.label.toUpperCase()}
              </Text>
              <Text
                selectable
                style={{
                  fontSize: 14,
                  color: theme.foreground,
                  fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
                }}
              >
                {row.value}
              </Text>
            </View>
          ))}
        </View>

        <View style={{ gap: 10 }}>
          <Pressable
            onPress={handleCopyAll}
            style={{
              paddingVertical: 14,
              borderRadius: 10,
              backgroundColor: theme.muted,
              alignItems: "center",
            }}
          >
            <Text style={{ color: theme.foreground, fontWeight: "700" }}>
              Share diagnostics dump
            </Text>
          </Pressable>
          <Pressable
            onPress={handleReload}
            style={{
              paddingVertical: 14,
              borderRadius: 10,
              backgroundColor: theme.muted,
              alignItems: "center",
            }}
          >
            <Text style={{ color: theme.foreground, fontWeight: "700" }}>
              Reload app
            </Text>
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate("PremiumWelcome")}
            style={{
              paddingVertical: 14,
              borderRadius: 10,
              backgroundColor: "#FF655B",
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>Preview Premium Welcome</Text>
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate("BusinessWelcome")}
            style={{
              paddingVertical: 14,
              borderRadius: 10,
              backgroundColor: "#F59E0B",
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>Preview Business Welcome</Text>
          </Pressable>
          {authUid && (
            <Pressable
              onPress={handleSignOut}
              style={{
                paddingVertical: 14,
                borderRadius: 10,
                backgroundColor: "#dc2626",
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "700" }}>Sign out</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * Default export wraps the screen in an ErrorBoundary. The screen has
 * had an unexplained crash on release devices that didn't reproduce on
 * the emulator and survived a defensive `safe()` pass. The boundary
 * converts any JS render error into an on-screen message — both keeping
 * the app alive AND surfacing the exact error text so it can finally be
 * diagnosed. If the app still hard-crashes past this, the cause is
 * native (the boundary can't catch native faults).
 */
export default function DiagnosticsScreen() {
  const navigation = useNavigation<Nav>();
  return (
    <ErrorBoundary
      label="Diagnostics"
      onClose={() => {
        try {
          navigation.goBack();
        } catch {
          // best-effort
        }
      }}
    >
      <DiagnosticsScreenInner />
    </ErrorBoundary>
  );
}
