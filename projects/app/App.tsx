import "./global.css";
import React, { useEffect, useRef } from "react";
import { Linking, AppState, AppStateStatus, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  NavigationContainer,
  NavigationContainerRef,
} from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Updates from "expo-updates";
import { AuthProvider } from "./src/context/AuthContext";
import RootNavigator from "./src/navigation/RootNavigator";
import type { RootStackParamList } from "./src/navigation/types";
import { logEvent } from "./src/lib/analytics";

// Treat a foreground return as a new session if the app was backgrounded
// for at least this long. Avoids spamming `app_open` when the user briefly
// flips out to Mail or Messages mid-flow.
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

function handleDeepLink(
  url: string,
  nav: NavigationContainerRef<RootStackParamList> | null
) {
  if (!nav) return;
  const parsed = new URL(url);
  if (parsed.hostname === "upgrade-success") {
    const plan = parsed.searchParams.get("plan");
    if (plan === "business") nav.navigate("BusinessWelcome");
    else nav.navigate("PremiumWelcome");
  }
}

export default function App() {
  const navRef = useRef<NavigationContainerRef<RootStackParamList>>(null);
  const lastBackgroundedAtRef = useRef<number | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (__DEV__) return;
    Updates.checkForUpdateAsync()
      .then(({ isAvailable }) => {
        if (isAvailable) return Updates.fetchUpdateAsync();
      })
      .catch((e) => console.warn("OTA update check failed", e));
  }, []);

  useEffect(() => {
    const sub = Linking.addEventListener("url", ({ url }) => {
      handleDeepLink(url, navRef.current);
    });
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url, navRef.current);
    });
    return () => sub.remove();
  }, []);

  // Fire `app_open` on cold launch, and again whenever the app returns to
  // the foreground after being backgrounded for more than SESSION_TIMEOUT_MS.
  useEffect(() => {
    // Cold launch
    logEvent("app_open", { source: "cold_launch", platform: Platform.OS });

    const handleChange = (next: AppStateStatus) => {
      const prev = appStateRef.current;
      if (prev === "active" && next.match(/inactive|background/)) {
        lastBackgroundedAtRef.current = Date.now();
      } else if (prev.match(/inactive|background/) && next === "active") {
        const backgroundedAt = lastBackgroundedAtRef.current;
        const elapsed = backgroundedAt ? Date.now() - backgroundedAt : Infinity;
        if (elapsed >= SESSION_TIMEOUT_MS) {
          logEvent("app_open", {
            source: "foreground_resume",
            platform: Platform.OS,
            background_duration_ms: backgroundedAt ? elapsed : null,
          });
        }
      }
      appStateRef.current = next;
    };

    const sub = AppState.addEventListener("change", handleChange);
    return () => sub.remove();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <NavigationContainer ref={navRef}>
            <RootNavigator />
            <StatusBar style="auto" />
          </NavigationContainer>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
