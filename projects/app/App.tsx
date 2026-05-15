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
import { initEnvFromStorage } from "./src/lib/env";
import { initDeviceId } from "./src/lib/device";
import {
  configureNotificationHandler,
  subscribeToNotifications,
  type PushNotificationData,
} from "./src/services/push";

/**
 * Manual deep link parser. The previous implementation used the global
 * `new URL(...)` constructor, which works reliably in browsers but is
 * inconsistent for custom schemes in React Native — depending on the
 * Hermes/JSC URL polyfill version, `tracetravel://share/abc` may
 * produce empty `hostname`/`pathname` or throw. Parsing manually with
 * a small regex avoids that whole class of bug.
 *
 * Returns { host, path, query } for our two known shapes:
 *   tracetravel://share/<id>         → { host: "share", path: "<id>", ... }
 *   tracetravel://upgrade-success?plan=premium
 *                                    → { host: "upgrade-success", path: "", ... }
 */
function parseTraceLink(
  url: string
): { host: string; path: string; query: URLSearchParams } | null {
  const SCHEME = "tracetravel://";
  if (!url.startsWith(SCHEME)) return null;
  const remainder = url.slice(SCHEME.length);
  const [beforeQuery, queryStr = ""] = remainder.split("?");
  const slashIdx = beforeQuery.indexOf("/");
  const host = slashIdx === -1 ? beforeQuery : beforeQuery.slice(0, slashIdx);
  const path = slashIdx === -1 ? "" : beforeQuery.slice(slashIdx + 1);
  const query = new URLSearchParams(queryStr);
  return { host, path, query };
}

function handleDeepLink(
  url: string,
  nav: NavigationContainerRef<RootStackParamList> | null
) {
  if (!nav) {
    console.log("[deep-link] no nav ref; dropping", url);
    return;
  }
  const parsed = parseTraceLink(url);
  if (!parsed) {
    console.log("[deep-link] unparseable URL", url);
    return;
  }
  console.log("[deep-link] routing", parsed.host, "path=", parsed.path);
  logEvent("deep_link_routed", { host: parsed.host });
  if (parsed.host === "upgrade-success") {
    const plan = parsed.query.get("plan");
    if (plan === "business") nav.navigate("BusinessWelcome");
    else nav.navigate("PremiumWelcome");
  } else if (parsed.host === "share") {
    const shareId = parsed.path;
    if (shareId) nav.navigate("SharedDeal", { shareId });
    else console.log("[deep-link] share with no id");
  }
}

/**
 * Returns true if this deep link can be routed in the current auth state.
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
  const parsed = parseTraceLink(url);
  if (!parsed) return false;
  if (parsed.host === "share") return !!(user && onboardingComplete);
  return true;
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
 * Now we hold the URL until auth + onboarding + nav-ready all line up,
 * then route. Lives inside AuthProvider so it can react to auth state
 * changes via useAuth(). Uses a setInterval-driven retry instead of
 * useState because React 18's setState skips re-renders when the value
 * is identical — so the previous `setPendingUrl((u) => u)` retry was
 * silently a no-op.
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
      if (url) {
        console.log("[deep-link] initial URL:", url);
        logEvent("deep_link_received", { source: "cold_launch" });
        setPendingUrl(url);
      }
    });
    const sub = Linking.addEventListener("url", ({ url }) => {
      console.log("[deep-link] live URL:", url);
      logEvent("deep_link_received", { source: "live" });
      setPendingUrl(url);
    });
    return () => sub.remove();
  }, []);

  // Drive a routing attempt whenever auth/profile state changes
  // (the typical unblocker for share routing). Plus a setInterval
  // for the window when nav hasn't mounted yet but everything else
  // is ready.
  useEffect(() => {
    if (!pendingUrl) return;

    function tryRoute(): boolean {
      if (authLoading) return false;
      const nav = navRef.current;
      if (!nav?.isReady?.()) return false;
      if (!isDeepLinkRoutable(pendingUrl!, user, !!profile?.onboardingComplete)) {
        return false;
      }
      handleDeepLink(pendingUrl!, nav);
      setPendingUrl(null);
      return true;
    }

    // Try immediately on dependency change.
    if (tryRoute()) return;

    // Otherwise poll until ready or timeout. Caps at 15s so we don't
    // burn battery if something is genuinely broken.
    const start = Date.now();
    const interval = setInterval(() => {
      if (tryRoute() || Date.now() - start > 15000) {
        clearInterval(interval);
        if (Date.now() - start > 15000) {
          console.log("[deep-link] gave up after 15s waiting for nav/auth", pendingUrl);
          logEvent("deep_link_received", { source: "timeout" });
        }
      }
    }, 200);

    return () => clearInterval(interval);
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

  // Gate the entire tree on env hydration. `getEnv()` defaults to "prod"
  // before this resolves, so even if the user had previously toggled to
  // staging we'd briefly read prod data. Render nothing until we know.
  //
  // Also hydrate the device_id so every event from this launch carries
  // the stable per-install UUID (`lib/device.ts`). Done in parallel —
  // both reads are cheap AsyncStorage lookups.
  const [envHydrated, setEnvHydrated] = useState(false);
  useEffect(() => {
    Promise.all([initEnvFromStorage(), initDeviceId()]).finally(() =>
      setEnvHydrated(true)
    );
  }, []);

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

  // Hold the app on a blank screen until we know which env to talk to.
  // In practice this resolves in <10ms (a single AsyncStorage read), so
  // users won't see a flicker.
  if (!envHydrated) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider />
      </GestureHandlerRootView>
    );
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
