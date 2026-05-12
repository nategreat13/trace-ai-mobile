import "./global.css";
import React, { useEffect, useRef, useState } from "react";
import { Linking } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  NavigationContainer,
  NavigationContainerRef,
} from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Updates from "expo-updates";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
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
  } else if (parsed.hostname === "share") {
    // tracetravel://share/SHARE_ID
    const shareId = parsed.pathname.replace(/^\//, "");
    if (shareId) nav.navigate("SharedDeal", { shareId });
  }
}

/**
 * Returns true if the deep link can be routed in the current auth state.
 * Share links require a fully authed + onboarded user because
 * SharedDealScreen is only mounted in the post-auth navigator stack.
 * Other deep links (Premium/Business welcome) can be routed any time
 * the navigator is ready.
 */
function isDeepLinkRoutable(
  url: string,
  user: { uid?: string } | null,
  onboardingComplete: boolean
): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "share") {
      return !!(user && onboardingComplete);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Captures incoming deep links (cold-launch and live) and defers
 * routing until both the NavigationContainer is ready AND the target
 * screen is actually mounted in the current navigator stack.
 *
 * On cold launch via `tracetravel://share/<id>`, the previous
 * implementation tried to navigate immediately — but the SharedDeal
 * screen only exists in RootNavigator's authed stack, and auth
 * resolves asynchronously. The navigate call fired before the screen
 * was registered and silently no-op'd, so users tapping a share link
 * landed on Landing instead of the deal.
 *
 * Now we hold the URL in state until auth + onboarding + nav-ready
 * all line up, then route. Lives inside AuthProvider so it can react
 * to auth state changes via useAuth().
 */
function DeepLinkHandler({
  navRef,
}: {
  navRef: React.RefObject<NavigationContainerRef<RootStackParamList> | null>;
}) {
  const { user, profile, loading: authLoading } = useAuth();
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);

  // Capture incoming URLs (cold launch + live).
  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (url) setPendingUrl(url);
    });
    const sub = Linking.addEventListener("url", ({ url }) => {
      setPendingUrl(url);
    });
    return () => sub.remove();
  }, []);

  // Try to route the pending URL whenever auth/profile state changes
  // (it's the auth resolve that typically unblocks share routing).
  useEffect(() => {
    if (!pendingUrl) return;
    if (authLoading) return;
    const nav = navRef.current;
    if (!nav?.isReady?.()) {
      // Nav not ready yet — try again on next tick. NavigationContainer's
      // onReady will trigger a re-render via the state-change handler.
      const t = setTimeout(() => setPendingUrl((u) => u), 100);
      return () => clearTimeout(t);
    }
    if (!isDeepLinkRoutable(pendingUrl, user, !!profile?.onboardingComplete)) {
      // Hold the URL — user might sign in or finish onboarding shortly
      // and this effect re-runs when that happens.
      return;
    }
    handleDeepLink(pendingUrl, nav);
    setPendingUrl(null);
  }, [pendingUrl, authLoading, user, profile?.onboardingComplete, navRef]);

  return null;
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

  // Deep link handling moved into <DeepLinkHandler> below — it needs
  // access to auth state to defer share-link routing until the user is
  // signed in (otherwise SharedDealScreen isn't in the navigator yet).

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
          <DeepLinkHandler navRef={navRef} />
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
