import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  Share,
  Image as RNImage,
  Pressable as RNPressable,
  useColorScheme,
  Modal,
  Platform,
  Linking,
  Switch,
  ActivityIndicator,
} from "react-native";
import * as Application from "expo-application";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { LinearGradient } from "expo-linear-gradient";
import {
  Plane,
  Globe,
  Calendar,
  Heart,
  RefreshCw,
  LogOut,
  User,
  Trash2,
  Crown,
  Share2,
  Pencil,
  Camera,
  ChevronRight,
  MessageCircle,
} from "lucide-react-native";
import { colors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";
import { useProfile } from "../hooks/useProfile";
import { logout } from "../services/auth";
import { deleteAccount } from "../services/deleteAccountApi";
import PromoCodeModal from "../components/PromoCodeModal";
import {
  requestNotificationPermission,
  registerPushToken,
} from "../services/push";
import { storage } from "../services/firebase";
import { DEAL_TYPE_LABELS, DEST_LABELS, API_BASE_URL } from "../lib/constants";
import { restorePurchases, hasEntitlement } from "../services/iap";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;
  const { user, profile, isPremium } = useAuth();
  const { updateProfile } = useProfile();

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [tempFirstName, setTempFirstName] = useState("");
  const [tempLastName, setTempLastName] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [showNotifPrefs, setShowNotifPrefs] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [supportName, setSupportName] = useState("");
  const [supportSubject, setSupportSubject] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [supportSent, setSupportSent] = useState(false);

  const handleSaveName = async () => {
    const first = tempFirstName.trim();
    if (first) {
      const last = tempLastName.trim();
      const capitalizeName = (n: string) =>
        n.replace(/\b\w/g, (c) => c.toUpperCase());
      const fullName = [capitalizeName(first), last ? capitalizeName(last) : ""]
        .filter(Boolean)
        .join(" ");
      await updateProfile({ displayName: fullName });
    }
    setEditingName(false);
  };

  const handlePickPhoto = async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission needed",
          "Please allow access to your photo library.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets[0] && user) {
        setUploadingPhoto(true);
        const uri = result.assets[0].uri;
        const response = await fetch(uri);
        const blob = await response.blob();
        const storageRef = ref(storage, `profilePhotos/${user.uid}`);
        await uploadBytes(storageRef, blob);
        const downloadURL = await getDownloadURL(storageRef);
        await updateProfile({ profilePictureUrl: downloadURL });
        setUploadingPhoto(false);
      }
    } catch (error: any) {
      console.error("Photo upload failed:", error);
      setUploadingPhoto(false);
      Alert.alert(
        "Upload failed",
        error?.message || "Could not save photo. Check Firebase Storage rules.",
      );
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  const handleDeleteAccount = async () => {
    if (deleteText !== "DELETE" || !user || isDeleting) return;
    setIsDeleting(true);
    try {
      // Server-side deletion via the /delete-account endpoint. Uses
      // the Firebase Admin SDK on the backend, which bypasses the
      // client-side `auth/requires-recent-login` guardrail — so the
      // user doesn't need to re-enter their password.
      await deleteAccount();
      // Force a local sign-out — fixes a real bug where Firebase's
      // onAuthStateChanged didn't fire (or fired 30-60s late) after
      // the server invalidated the token. Modal sat open, user
      // assumed nothing happened, tapped Delete again, server logged
      // a second "already gone" call. Calling logout() pushes the
      // auth listener immediately so RootNavigator routes back to
      // Landing within a frame.
      await logout();
      // Modal will unmount as Profile unmounts; clear state defensively
      // so re-mounting from a fresh signin doesn't carry "DELETE" text.
      setShowDeleteModal(false);
      setDeleteText("");
    } catch (error: any) {
      console.error("Error deleting account:", error);
      Alert.alert(
        "Error",
        error?.message ?? "Failed to delete account. Please try again."
      );
      setIsDeleting(false);
    }
  };

  const handleShare = async () => {
    try {
      const img = RNImage.resolveAssetSource(require("../../assets/1.png"));
      await Share.share({
        title: "Trace Travel",
        message:
          "Found this app called Trace — it finds insane flight deals. Worth downloading ✈️\nhttps://apps.apple.com/us/app/trace-travel/id6760838076",
        url: img.uri,
      });
    } catch {}
  };

  const handleSendSupport = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/support`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: supportName.trim(),
          email: user?.email ?? "",
          subject: supportSubject.trim() || "Support Request",
          message: supportMessage.trim(),
        }),
      });
      if (!res.ok) throw new Error("Failed");
      setSupportSent(true);
    } catch {
      Alert.alert("Error", "Couldn't send your message. Please try again.");
    }
  };

  const handleResetPreferences = () => {
    Alert.alert(
      "Reset Preferences",
      "This will take you through onboarding again.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          onPress: () => {
            navigation.navigate("EditPreferences");
          },
        },
      ],
    );
  };

  const settings = [
    {
      icon: Plane,
      label: "Home Airport",
      value: profile?.homeAirport || "Not set",
    },
    {
      icon: Globe,
      label: "Destination",
      value: DEST_LABELS[profile?.destinationPreference || "both"] || "Both",
    },
    {
      icon: Calendar,
      label: "Travel Timeframe",
      value:
        profile?.travelTimeframe
          ?.map((t) =>
            t.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
          )
          .join(", ") || "No preference",
    },
    {
      icon: Heart,
      label: "Deal Types",
      value:
        profile?.dealTypes?.map((t) => DEAL_TYPE_LABELS[t] || t).join(", ") ||
        "All",
    },
  ];

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.muted }}
      edges={["top", "left", "right"]}
    >
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <View
          style={{
            backgroundColor: theme.background,
            paddingHorizontal: 24,
            paddingTop: 24,
            paddingBottom: 16,
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
          }}
        >
          <Text
            style={{ fontSize: 24, fontWeight: "800", color: theme.foreground }}
          >
            Profile
          </Text>
        </View>

        <View style={{ padding: 16, gap: 12 }}>
          {/* User Card */}
          <View
            style={{
              backgroundColor: theme.card,
              borderRadius: 16,
              padding: 24,
              borderWidth: 1,
              borderColor: theme.border,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 16,
                marginBottom: 24,
              }}
            >
              {/* Avatar with camera overlay */}
              <TouchableOpacity
                onPress={handlePickPhoto}
                disabled={uploadingPhoto}
              >
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: theme.muted,
                    justifyContent: "center",
                    alignItems: "center",
                    overflow: "hidden",
                  }}
                >
                  {profile?.profilePictureUrl ? (
                    <Image
                      source={{ uri: profile.profilePictureUrl }}
                      style={{ width: 56, height: 56 }}
                      contentFit="cover"
                    />
                  ) : (
                    <User color={theme.mutedForeground} size={28} />
                  )}
                </View>
                {/* Camera icon overlay */}
                <View
                  style={{
                    position: "absolute",
                    bottom: 0,
                    right: 0,
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: colors.brand.traceRed,
                    justifyContent: "center",
                    alignItems: "center",
                    borderWidth: 2,
                    borderColor: theme.card,
                  }}
                >
                  <Camera color="#fff" size={10} />
                </View>
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  <Text
                    style={{
                      fontSize: 20,
                      fontWeight: "800",
                      color: theme.foreground,
                    }}
                  >
                    {profile?.displayName ||
                      user?.displayName ||
                      "Travel Explorer"}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      const name =
                        profile?.displayName || user?.displayName || "";
                      const parts = name.split(" ");
                      setTempFirstName(parts[0] || "");
                      setTempLastName(parts.slice(1).join(" ") || "");
                      setEditingName(true);
                    }}
                  >
                    <Pencil color={theme.mutedForeground} size={14} />
                  </TouchableOpacity>
                </View>
                <Text style={{ fontSize: 14, color: theme.mutedForeground }}>
                  {user?.email}
                </Text>
              </View>
            </View>
          </View>

          {/* Subscription with gradient background */}
          <LinearGradient
            colors={
              scheme === "dark"
                ? ["#1c1917", "#1a1a1a"]
                : ["#fff1f2", "#fff7ed"]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: 16,
              padding: 24,
              borderWidth: 1,
              borderColor: theme.border,
            }}
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: "700",
                color: theme.foreground,
                marginBottom: 16,
              }}
            >
              Subscription
            </Text>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                padding: 16,
                backgroundColor:
                  scheme === "dark"
                    ? "rgba(255,255,255,0.05)"
                    : "rgba(255,255,255,0.7)",
                borderRadius: 12,
                marginBottom: 16,
              }}
            >
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <Text
                    style={{
                      fontWeight: "600",
                      color: theme.foreground,
                      textTransform: "capitalize",
                    }}
                  >
                    {profile?.subscriptionStatus || "free"}
                  </Text>
                  {profile?.subscriptionSource === "promo" && (
                    <View
                      style={{
                        backgroundColor: colors.brand.amber50,
                        borderWidth: 1,
                        borderColor: colors.brand.amber200,
                        borderRadius: 6,
                        paddingHorizontal: 6,
                        paddingVertical: 1,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: "800",
                          color: colors.brand.amber600,
                          letterSpacing: 0.5,
                        }}
                      >
                        🎁 PROMO
                      </Text>
                    </View>
                  )}
                </View>
                <Text
                  style={{
                    fontSize: 12,
                    color: theme.mutedForeground,
                    marginTop: 4,
                  }}
                >
                  {profile?.subscriptionStatus === "trial" &&
                  profile?.trialEndDate
                    ? `Trial ends ${new Date(profile.trialEndDate).toLocaleDateString()}`
                    : profile?.subscriptionSource === "promo" &&
                        profile?.trialEndDate
                      ? `Promo access through ${new Date(profile.trialEndDate).toLocaleDateString()}`
                      : profile?.subscriptionStatus === "premium" ||
                          profile?.subscriptionStatus === "business"
                        ? "Active subscription"
                        : "Upgrade to unlock premium features"}
                </Text>
              </View>
              <Crown color={colors.brand.rose500} size={20} />
            </View>
            <TouchableOpacity
              onPress={() => {
                const isPromoAccess = profile?.subscriptionSource === "promo";
                const hasPaidStoreSub =
                  !isPromoAccess &&
                  (profile?.subscriptionStatus === "premium" ||
                    profile?.subscriptionStatus === "business");
                if (hasPaidStoreSub) {
                  Linking.openURL(
                    Platform.OS === "ios"
                      ? "https://apps.apple.com/account/subscriptions"
                      : "https://play.google.com/store/account/subscriptions"
                  );
                } else {
                  // Promo users + free users both go to the paywall — promo
                  // users so they can subscribe before their grant expires.
                  navigation.navigate("Paywall", { entryPoint: "profile_subscription_row" });
                }
              }}
              style={{
                backgroundColor: colors.brand.traceRed,
                borderRadius: 12,
                paddingVertical: 14,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>
                {profile?.subscriptionSource === "promo"
                  ? `Subscribe to keep ${profile?.subscriptionStatus === "business" ? "Business" : "Premium"}`
                  : profile?.subscriptionStatus === "premium" ||
                      profile?.subscriptionStatus === "business"
                    ? "Manage Subscription"
                    : "View Plans"}
              </Text>
            </TouchableOpacity>
          </LinearGradient>

          {/* Notifications */}
          <View
            style={{
              backgroundColor: theme.card,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: theme.border,
              overflow: "hidden",
            }}
          >
            {/* Master toggle */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 18,
                paddingVertical: 14,
                gap: 12,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: theme.foreground }}>
                  Push notifications
                </Text>
                <Text style={{ fontSize: 12, color: theme.mutedForeground, marginTop: 1 }}>
                  Manage what Trace can send you
                </Text>
              </View>
              <Switch
                value={profile?.notificationsEnabled === true}
                onValueChange={async (next) => {
                  if (!profile?.id) return;
                  if (next) {
                    const status = await requestNotificationPermission();
                    if (status === "granted") {
                      await registerPushToken(profile.id);
                      await updateProfile({ notificationsEnabled: true });
                    } else {
                      Alert.alert(
                        "Notifications blocked",
                        "Push notifications are turned off in your device settings. Open the Settings app to enable them for Trace.",
                      );
                      await updateProfile({ notificationsEnabled: false });
                    }
                  } else {
                    await updateProfile({ notificationsEnabled: false });
                  }
                }}
                trackColor={{ false: theme.muted, true: colors.brand.traceRed }}
                thumbColor="#fff"
              />
            </View>

            {/* Customize link — only shown when master is on */}
            {profile?.notificationsEnabled === true && (
              <View style={{ borderTopWidth: 1, borderTopColor: theme.border }}>
                <TouchableOpacity
                  onPress={() => setShowNotifPrefs((v) => !v)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingHorizontal: 18,
                    paddingVertical: 12,
                  }}
                >
                  <Text style={{ fontSize: 13, color: theme.mutedForeground }}>
                    Customize notifications
                  </Text>
                  <ChevronRight
                    color={theme.mutedForeground}
                    size={16}
                    style={{ transform: [{ rotate: showNotifPrefs ? "90deg" : "0deg" }] }}
                  />
                </TouchableOpacity>

                {showNotifPrefs && (() => {
                  const prefs = profile.notificationPreferences;
                  const categories: { key: keyof NonNullable<typeof prefs>; label: string; description: string }[] = [
                    { key: "deals", label: "Deal alerts", description: "Hot deals and saved alert matches" },
                    { key: "account", label: "Account & billing", description: "Trial, renewals, billing issues" },
                    { key: "reengagement", label: "Re-engagement", description: "When you haven't opened the app in a while" },
                    { key: "offers", label: "Tips & recommendations", description: "Upgrade suggestions and tips" },
                  ];
                  return (
                    <View style={{ borderTopWidth: 1, borderTopColor: theme.border }}>
                      {categories.map((cat, i) => (
                        <View
                          key={cat.key}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            paddingHorizontal: 18,
                            paddingVertical: 12,
                            borderTopWidth: i === 0 ? 0 : 1,
                            borderTopColor: theme.border,
                            gap: 12,
                          }}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13, fontWeight: "600", color: theme.foreground }}>
                              {cat.label}
                            </Text>
                            <Text style={{ fontSize: 11, color: theme.mutedForeground, marginTop: 1 }}>
                              {cat.description}
                            </Text>
                          </View>
                          <Switch
                            value={prefs?.[cat.key] !== false}
                            onValueChange={async (next) => {
                              if (!profile?.id) return;
                              await updateProfile({
                                notificationPreferences: {
                                  deals: prefs?.deals !== false,
                                  account: prefs?.account !== false,
                                  reengagement: prefs?.reengagement !== false,
                                  offers: prefs?.offers !== false,
                                  [cat.key]: next,
                                },
                              });
                            }}
                            trackColor={{ false: theme.muted, true: colors.brand.traceRed }}
                            thumbColor="#fff"
                          />
                        </View>
                      ))}
                    </View>
                  );
                })()}
              </View>
            )}
          </View>

          {/* Promo code redemption */}
          <TouchableOpacity
            onPress={() => setShowPromoModal(true)}
            activeOpacity={0.85}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: theme.card,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: theme.border,
              paddingHorizontal: 18,
              paddingVertical: 14,
              gap: 12,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
              <Text style={{ fontSize: 22 }}>🎁</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: theme.foreground }}>
                  Have a promo code?
                </Text>
                <Text style={{ fontSize: 12, color: theme.mutedForeground, marginTop: 1 }}>
                  Tap to redeem.
                </Text>
              </View>
            </View>
            <ChevronRight color={theme.mutedForeground} size={18} />
          </TouchableOpacity>

          {/* Preferences */}
          <View
            style={{
              backgroundColor: theme.card,
              borderRadius: 16,
              padding: 24,
              borderWidth: 1,
              borderColor: theme.border,
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
                  fontSize: 16,
                  fontWeight: "700",
                  color: theme.foreground,
                }}
              >
                Travel Preferences
              </Text>
              <TouchableOpacity
                onPress={handleResetPreferences}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  backgroundColor: theme.muted,
                  borderRadius: 8,
                }}
              >
                <RefreshCw color={theme.foreground} size={14} />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: theme.foreground,
                  }}
                >
                  Reset
                </Text>
              </TouchableOpacity>
            </View>
            {settings.map((s, i) => (
              <View
                key={i}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingVertical: 8,
                }}
              >
                <s.icon color={theme.mutedForeground} size={20} />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "500",
                      color: theme.foreground,
                    }}
                  >
                    {s.label}
                  </Text>
                  <Text style={{ fontSize: 12, color: theme.mutedForeground }}>
                    {s.value}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* Share with gradient button */}
          <View
            style={{
              backgroundColor: theme.card,
              borderRadius: 16,
              padding: 24,
              borderWidth: 1,
              borderColor: theme.border,
            }}
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: "700",
                color: theme.foreground,
                marginBottom: 4,
              }}
            >
              Share Trace
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: theme.mutedForeground,
                marginBottom: 16,
              }}
            >
              Invite friends to find flight deals with AI
            </Text>
            <TouchableOpacity onPress={handleShare} activeOpacity={0.85}>
              <LinearGradient
                colors={[colors.brand.rose500, colors.brand.orange500]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  paddingVertical: 12,
                  borderRadius: 12,
                }}
              >
                <Share2 color="#fff" size={16} />
                <Text
                  style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}
                >
                  Share with Friends
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Contact Support */}
          <TouchableOpacity
            onPress={() => setShowSupportModal(true)}
            activeOpacity={0.85}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: theme.card,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: theme.border,
              paddingHorizontal: 18,
              paddingVertical: 14,
              gap: 12,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
              <MessageCircle color={theme.mutedForeground} size={20} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: theme.foreground }}>
                  Contact Support
                </Text>
                <Text style={{ fontSize: 12, color: theme.mutedForeground, marginTop: 1 }}>
                  Get help from the Trace team
                </Text>
              </View>
            </View>
            <ChevronRight color={theme.mutedForeground} size={18} />
          </TouchableOpacity>

          {/* Restore Purchases */}
          <TouchableOpacity
            onPress={async () => {
              try {
                const customerInfo = await restorePurchases();
                if (hasEntitlement(customerInfo, "business")) {
                  await updateProfile({ subscriptionStatus: "business" });
                  Alert.alert("Restored", "Your subscription has been restored.");
                } else if (hasEntitlement(customerInfo, "premium")) {
                  await updateProfile({ subscriptionStatus: "premium" });
                  Alert.alert("Restored", "Your subscription has been restored.");
                } else {
                  Alert.alert("No Purchases Found", "We couldn't find any active subscriptions to restore.");
                }
              } catch (e: any) {
                Alert.alert("Error", e?.message || "Failed to restore purchases.");
              }
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              paddingVertical: 14,
              backgroundColor: theme.card,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: theme.border,
            }}
          >
            <RefreshCw color={theme.foreground} size={20} />
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: theme.foreground,
              }}
            >
              Restore Purchases
            </Text>
          </TouchableOpacity>

{/* Actions */}
          <TouchableOpacity
            onPress={handleLogout}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              paddingVertical: 14,
              backgroundColor: theme.card,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: theme.border,
            }}
          >
            <LogOut color={theme.foreground} size={20} />
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: theme.foreground,
              }}
            >
              Sign Out
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setShowDeleteModal(true)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              paddingVertical: 14,
              backgroundColor: theme.card,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: theme.border,
            }}
          >
            <Trash2 color="#ef4444" size={20} />
            <Text style={{ fontSize: 14, fontWeight: "600", color: "#ef4444" }}>
              Delete Account
            </Text>
          </TouchableOpacity>

          {/* Hidden diagnostics trigger. Long-press the version line below
              for 3 seconds to open the diagnostics modal. Same pattern as
              the logo on LandingScreen — undiscoverable to normal users.
              Visible label is "Trace" + version so it doubles as a
              useful footer for testers reporting bugs. */}
          <RNPressable
            onLongPress={() => navigation.navigate("Diagnostics")}
            delayLongPress={3000}
            hitSlop={8}
            style={{ alignItems: "center", paddingTop: 24 }}
          >
            <Text style={{ color: theme.mutedForeground, fontSize: 11 }}>
              Trace · v{Application.nativeApplicationVersion ?? "?"} (
              {Application.nativeBuildVersion ?? "?"})
            </Text>
          </RNPressable>
        </View>
      </ScrollView>

      {/* Promo code redemption modal */}
      <PromoCodeModal
        visible={showPromoModal}
        onClose={() => setShowPromoModal(false)}
      />

      {/* Name edit modal */}
      <Modal visible={editingName} transparent animationType="fade">
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setEditingName(false)}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            paddingHorizontal: 16,
          }}
        >
          <View
            style={{
              backgroundColor: theme.card,
              borderRadius: 20,
              padding: 24,
              borderWidth: 1,
              borderColor: theme.border,
            }}
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: "700",
                color: theme.foreground,
                marginBottom: 16,
              }}
            >
              Edit Name
            </Text>
            <TextInput
              value={tempFirstName}
              onChangeText={setTempFirstName}
              placeholder="First name"
              placeholderTextColor={theme.mutedForeground}
              autoFocus
              style={{
                padding: 12,
                borderWidth: 1,
                borderColor: theme.border,
                borderRadius: 8,
                fontSize: 14,
                color: theme.foreground,
                marginBottom: 8,
              }}
            />
            <TextInput
              value={tempLastName}
              onChangeText={setTempLastName}
              placeholder="Last name"
              placeholderTextColor={theme.mutedForeground}
              style={{
                padding: 12,
                borderWidth: 1,
                borderColor: theme.border,
                borderRadius: 8,
                fontSize: 14,
                color: theme.foreground,
                marginBottom: 16,
              }}
            />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity
                onPress={() => setEditingName(false)}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: theme.border,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "600",
                    color: theme.foreground,
                  }}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveName}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 8,
                  backgroundColor: colors.brand.traceRed,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{ fontSize: 14, fontWeight: "600", color: "#fff" }}
                >
                  Save
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Contact Support modal */}
      <Modal visible={showSupportModal} transparent animationType="fade">
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => {
            setShowSupportModal(false);
            setSupportSent(false);
            setSupportName("");
            setSupportSubject("");
            setSupportMessage("");
          }}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            paddingHorizontal: 16,
          }}
        >
          <TouchableOpacity activeOpacity={1}>
            <View
              style={{
                backgroundColor: theme.card,
                borderRadius: 20,
                overflow: "hidden",
                borderWidth: 1,
                borderColor: theme.border,
              }}
            >
              {/* Colored header */}
              <LinearGradient
                colors={[colors.brand.rose500, colors.brand.orange500]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ padding: 24, paddingBottom: 20 }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <MessageCircle color="#fff" size={22} />
                  <Text style={{ fontSize: 20, fontWeight: "800", color: "#fff" }}>
                    Contact Support
                  </Text>
                </View>
                <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", marginTop: 4 }}>
                  The Trace team usually responds within 24 hours
                </Text>
              </LinearGradient>

              {supportSent ? (
                /* Confirmation state */
                <View style={{ padding: 24, alignItems: "center", gap: 12 }}>
                  <Text style={{ fontSize: 40 }}>✅</Text>
                  <Text style={{ fontSize: 17, fontWeight: "700", color: theme.foreground, textAlign: "center" }}>
                    Message received!
                  </Text>
                  <Text style={{ fontSize: 14, color: theme.mutedForeground, textAlign: "center", lineHeight: 20 }}>
                    We got your message and will follow up at{" "}
                    <Text style={{ fontWeight: "600", color: theme.foreground }}>{user?.email}</Text>.
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setShowSupportModal(false);
                      setSupportSent(false);
                      setSupportSubject("");
                      setSupportMessage("");
                    }}
                    style={{
                      marginTop: 8,
                      backgroundColor: colors.brand.traceRed,
                      borderRadius: 12,
                      paddingVertical: 13,
                      paddingHorizontal: 32,
                    }}
                  >
                    <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Done</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                /* Form state */
                <View style={{ padding: 24, gap: 12 }}>
                  {/* Email — pre-filled, read-only */}
                  <View>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: theme.mutedForeground, marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Email
                    </Text>
                    <TextInput
                      value={user?.email || ""}
                      editable={false}
                      style={{
                        padding: 12,
                        borderWidth: 1,
                        borderColor: theme.border,
                        borderRadius: 10,
                        fontSize: 14,
                        color: theme.mutedForeground,
                        backgroundColor: theme.muted,
                      }}
                    />
                  </View>
                  {/* Name — editable */}
                  <View>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: colors.brand.rose500, marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Name
                    </Text>
                    <TextInput
                      value={supportName}
                      onChangeText={setSupportName}
                      placeholder="Your name"
                      placeholderTextColor={theme.mutedForeground}
                      style={{
                        padding: 12,
                        borderWidth: 1.5,
                        borderColor: colors.brand.rose500 + "55",
                        borderRadius: 10,
                        fontSize: 14,
                        color: theme.foreground,
                        backgroundColor: scheme === "dark" ? "rgba(239,68,68,0.06)" : "rgba(239,68,68,0.04)",
                      }}
                    />
                  </View>
                  {/* Subject — editable */}
                  <View>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: colors.brand.rose500, marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Subject
                    </Text>
                    <TextInput
                      value={supportSubject}
                      onChangeText={setSupportSubject}
                      placeholder="e.g. Issue with my subscription"
                      placeholderTextColor={theme.mutedForeground}
                      style={{
                        padding: 12,
                        borderWidth: 1.5,
                        borderColor: colors.brand.rose500 + "55",
                        borderRadius: 10,
                        fontSize: 14,
                        color: theme.foreground,
                        backgroundColor: scheme === "dark" ? "rgba(239,68,68,0.06)" : "rgba(239,68,68,0.04)",
                      }}
                    />
                  </View>
                  {/* Message — editable */}
                  <View>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: colors.brand.rose500, marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Message
                    </Text>
                    <TextInput
                      value={supportMessage}
                      onChangeText={setSupportMessage}
                      placeholder="Describe your issue or question…"
                      placeholderTextColor={theme.mutedForeground}
                      multiline
                      textAlignVertical="top"
                      style={{
                        padding: 12,
                        borderWidth: 1.5,
                        borderColor: colors.brand.rose500 + "55",
                        borderRadius: 10,
                        fontSize: 14,
                        color: theme.foreground,
                        minHeight: 110,
                        backgroundColor: scheme === "dark" ? "rgba(239,68,68,0.06)" : "rgba(239,68,68,0.04)",
                      }}
                    />
                  </View>
                  {/* Buttons */}
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                    <TouchableOpacity
                      onPress={() => {
                        setShowSupportModal(false);
                        setSupportSubject("");
                        setSupportMessage("");
                      }}
                      style={{
                        flex: 1,
                        paddingVertical: 13,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: theme.border,
                        alignItems: "center",
                      }}
                    >
                      <Text style={{ fontSize: 14, fontWeight: "600", color: theme.foreground }}>
                        Cancel
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleSendSupport}
                      disabled={!supportMessage.trim()}
                      style={{ flex: 1 }}
                    >
                      <LinearGradient
                        colors={supportMessage.trim()
                          ? [colors.brand.rose500, colors.brand.orange500]
                          : [theme.muted, theme.muted]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={{
                          paddingVertical: 13,
                          borderRadius: 10,
                          alignItems: "center",
                        }}
                      >
                        <Text style={{
                          fontSize: 14,
                          fontWeight: "700",
                          color: supportMessage.trim() ? "#fff" : theme.mutedForeground,
                        }}>
                          Send Message
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Delete modal */}
      <Modal visible={showDeleteModal} transparent animationType="fade">
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setShowDeleteModal(false)}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            paddingHorizontal: 16,
          }}
        >
          <View
            style={{
              backgroundColor: theme.card,
              borderRadius: 20,
              padding: 24,
              borderWidth: 1,
              borderColor: theme.border,
            }}
          >
            <Text
              style={{
                fontSize: 18,
                fontWeight: "700",
                color: theme.foreground,
                marginBottom: 8,
              }}
            >
              Delete Account
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: theme.mutedForeground,
                marginBottom: 16,
              }}
            >
              This will permanently delete your profile and all your data.
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: theme.mutedForeground,
                marginBottom: 8,
              }}
            >
              Type{" "}
              <Text style={{ fontWeight: "700", color: theme.foreground }}>
                DELETE
              </Text>{" "}
              to confirm:
            </Text>
            <TextInput
              value={deleteText}
              onChangeText={setDeleteText}
              placeholder="DELETE"
              placeholderTextColor={theme.mutedForeground}
              style={{
                padding: 12,
                borderWidth: 1,
                borderColor: deleteText === "DELETE" ? "#ef4444" : theme.border,
                borderRadius: 8,
                fontSize: 14,
                color: theme.foreground,
                marginBottom: 16,
              }}
            />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity
                onPress={() => {
                  setShowDeleteModal(false);
                  setDeleteText("");
                }}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: theme.border,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "600",
                    color: theme.foreground,
                  }}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDeleteAccount}
                disabled={deleteText !== "DELETE" || isDeleting}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 8,
                  backgroundColor:
                    deleteText === "DELETE" ? "#ef4444" : theme.muted,
                  alignItems: "center",
                  opacity: isDeleting ? 0.7 : 1,
                }}
              >
                {isDeleting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "600",
                      color:
                        deleteText === "DELETE"
                          ? "#fff"
                          : theme.mutedForeground,
                    }}
                  >
                    Delete
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}
