import "./global.css";
import React, { useEffect, useRef } from "react";
import { Linking } from "react-native";
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
import AnalyticsLifecycle from "./src/components/AnalyticsLifecycle";
import {
  configureNotificationHandler,
  subscribeToNotifications,
  type PushNotificationData,
} from "./src/services/push";

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

/**
 * Routes a notification tap to the right in-app screen based on its
 * `deepLink` payload. Supported values map to the most-needed places
 * a notification might want to send the user. Falls back to no-op
 * (the app just opens to wherever it was last) if the value is missing
 * or unrecognized — better than crashing on a typo'd link.
 */
function handleNotificationDeepLink(
  data: PushNotificationData,
  nav: NavigationContainerRef<RootStackParamList> | null
) {
  if (!nav) return;
  const link = typeof data.deepLink === "string" ? data.deepLink : "";
  if (!link) return;
  if (link === "/paywall") {
    nav.navigate("Paywall", { entryPoint: "push_notification" });
  } else if (link === "/dashboard" || link.startsWith("/dashboard?tab=alerts")) {
    nav.navigate("MainTabs", {
      screen: "Dashboard",
      params: link.includes("alerts") ? { tab: "alerts" } : undefined,
    });
  } else if (link === "/dashboard?tab=saved") {
    nav.navigate("MainTabs", { screen: "Dashboard", params: { tab: "saved" } });
  } else if (link === "/swipe") {
    nav.navigate("MainTabs", { screen: "SwipeDeck" });
  } else if (link === "/explore") {
    nav.navigate("MainTabs", { screen: "Explore" });
  } else if (link === "/profile") {
    nav.navigate("MainTabs", { screen: "Profile" });
  }
  // Unknown deep links: silently no-op rather than crash on a typo.
}

export default function App() {
  const navRef = useRef<NavigationContainerRef<RootStackParamList>>(null);
  const previousRouteRef = useRef<string | null>(null);

  useEffect(() => {
    if (__DEV__) return;
    Updates.checkForUpdateAsync()
      .then(({ isAvailable }) => {
        if (isAvailable) return Updates.fetchUpdateAsync();
      })
      .catch((e) => console.warn("OTA update check failed", e));
  }, []);

  // Configure expo-notifications (foreground display) + subscribe to
  // taps so they route to the right screen via the navigation ref.
  useEffect(() => {
    configureNotificationHandler();
    const unsubscribe = subscribeToNotifications({
      onTap: (data) => handleNotificationDeepLink(data, navRef.current),
    });
    return unsubscribe;
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

  // Emits `screen_view` whenever the active route changes. The previous
  // route is included so per-screen drop-off (e.g. "X% who hit Onboarding
  // never reach Home") becomes computable from the events log.
  function handleNavigationStateChange() {
    const currentRoute = navRef.current?.getCurrentRoute()?.name ?? null;
    if (!currentRoute) return;
    if (currentRoute === previousRouteRef.current) return;
    logEvent("screen_view", {
      screen_name: currentRoute,
      previous_screen: previousRouteRef.current,
    });
    previousRouteRef.current = currentRoute;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <AnalyticsLifecycle />
          <NavigationContainer
            ref={navRef}
            onReady={handleNavigationStateChange}
            onStateChange={handleNavigationStateChange}
          >
            <RootNavigator />
            <StatusBar style="auto" />
          </NavigationContainer>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
