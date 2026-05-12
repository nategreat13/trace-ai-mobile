import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Linking,
  useColorScheme,
} from "react-native";
import { useRoute, useNavigation, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { useAuth } from "../context/AuthContext";
import ExpandedDeal from "../components/swipe/ExpandedDeal";
import { fetchShare, markShareOpened, type ShareRecord } from "../services/shareApi";
import { getSavedDeals } from "../services/firestore";
import { colors } from "../theme/colors";

const APP_STORE_URL = "https://apps.apple.com/app/trace-travel-ai/id6504194853";

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, "SharedDeal">;

export default function SharedDealScreen() {
  const { params } = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { user, profile } = useAuth();
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;

  const [share, setShare] = useState<ShareRecord | null>(null);
  const [bothSaved, setBothSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const markedOpened = useRef(false);

  useEffect(() => {
    fetchShare(params.shareId)
      .then(setShare)
      .catch(() => setError("This link has expired or is no longer available."));
  }, [params.shareId]);

  // Once we have the share record and a logged-in user, mark it opened (once only).
  useEffect(() => {
    if (!share || !user || markedOpened.current) return;
    if (user.uid === share.sharerId) return; // sharer viewing their own link — skip
    markedOpened.current = true;
    const openerName =
      profile?.displayName ||
      user.displayName ||
      user.email?.split("@")[0] ||
      "Someone";
    markShareOpened(params.shareId, user.uid, openerName).catch(() => {});
  }, [share, user, profile, params.shareId]);

  // Check if both users have saved this deal.
  useEffect(() => {
    if (!share || !user) return;
    if (user.uid === share.sharerId) return;
    const dealId = share.dealSnapshot.id;

    Promise.all([
      getSavedDeals(share.sharerId),
      getSavedDeals(user.uid),
    ])
      .then(([sharerDeals, myDeals]) => {
        const sharerSaved = sharerDeals.some((d: any) => d.originalDealId === dealId);
        const iSaved = myDeals.some((d: any) => d.originalDealId === dealId);
        setBothSaved(sharerSaved && iSaved);
      })
      .catch(() => {});
  }, [share, user]);

  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={[styles.errorEmoji]}>✈️</Text>
        <Text style={[styles.errorTitle, { color: theme.foreground }]}>Link unavailable</Text>
        <Text style={[styles.errorBody, { color: theme.mutedForeground }]}>{error}</Text>
        <TouchableOpacity
          style={[styles.closeBtn, { backgroundColor: colors.brand.traceRed }]}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.closeBtnText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!share) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={colors.brand.traceRed} />
      </View>
    );
  }

  // If the user isn't logged in, show a prompt to download the app.
  if (!user) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={styles.errorEmoji}>✈️</Text>
        <Text style={[styles.errorTitle, { color: theme.foreground }]}>
          Get Trace to view this deal
        </Text>
        <Text style={[styles.errorBody, { color: theme.mutedForeground }]}>
          {share.sharerName} shared a deal with you. Download Trace to see it.
        </Text>
        <TouchableOpacity
          style={[styles.closeBtn, { backgroundColor: colors.brand.traceRed }]}
          onPress={() => Linking.openURL(APP_STORE_URL)}
        >
          <Text style={styles.closeBtnText}>Download Trace</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ExpandedDeal
      deal={share.dealSnapshot}
      visible
      onClose={() => navigation.goBack()}
      onSave={() => {}}
      onBook={() => {}}
      userProfile={profile}
      sharedBy={share.sharerId !== user.uid ? share.sharerName : undefined}
      bothSaved={bothSaved}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  errorEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 10,
  },
  errorBody: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
  },
  closeBtn: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
  },
  closeBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
