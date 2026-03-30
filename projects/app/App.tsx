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
