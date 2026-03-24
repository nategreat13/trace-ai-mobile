import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  Share,
  useColorScheme,
  Modal,
} from "react-native";
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
  Tag,
  CheckCircle,
  AlertCircle,
  Share2,
  Pencil,
  Camera,
} from "lucide-react-native";
import { colors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";
import { useProfile } from "../hooks/useProfile";
import { logout } from "../services/auth";
import { deleteUserProfile } from "../services/firestore";
import { storage } from "../services/firebase";
import { DEAL_TYPE_LABELS, DEST_LABELS } from "../lib/constants";
import ExternalLinkDisclosure from "../components/ExternalLinkDisclosure";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;
  const { user, profile, isPremium } = useAuth();
  const { updateProfile } = useProfile();

  const [promoCode, setPromoCode] = useState("");
  const [promoStatus, setPromoStatus] = useState<null | "success" | "error">(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [tempFirstName, setTempFirstName] = useState("");
  const [tempLastName, setTempLastName] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showDisclosure, setShowDisclosure] = useState(false);

  const handleSaveName = async () => {
    const first = tempFirstName.trim();
    if (first) {
      const last = tempLastName.trim();
      const capitalizeName = (n: string) => n.replace(/\b\w/g, (c) => c.toUpperCase());
      const fullName = [capitalizeName(first), last ? capitalizeName(last) : ""].filter(Boolean).join(" ");
      await updateProfile({ displayName: fullName });
    }
    setEditingName(false);
  };

  const handlePickPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Please allow access to your photo library.");
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
      Alert.alert("Upload failed", error?.message || "Could not save photo. Check Firebase Storage rules.");
    }
  };

  const handlePromoCode = async () => {
    setPromoLoading(true);
    setPromoStatus(null);
    const VALID_CODES = ["TRACE2024", "TRACE2025", "TRACETEST", "TRACEVIP"];
    const BUSINESS_CODES = ["TRACEBIZ"];
    const code = promoCode.trim().toUpperCase();

    if (VALID_CODES.includes(code) || BUSINESS_CODES.includes(code)) {
      const trialEnd = new Date();
      trialEnd.setFullYear(trialEnd.getFullYear() + 1);
      const isBusiness = BUSINESS_CODES.includes(code);
      await updateProfile({
        subscriptionStatus: isBusiness ? "business" : "premium",
        trialEndDate: trialEnd,
      });
      setPromoStatus("success");
      setPromoCode("");
      setTimeout(() => {
        navigation.navigate(isBusiness ? "BusinessWelcome" : "PremiumWelcome");
      }, 1000);
    } else {
      setPromoStatus("error");
    }
    setPromoLoading(false);
  };

  const handleLogout = async () => {
    await logout();
  };

  const handleDeleteAccount = async () => {
    if (deleteText !== "DELETE") return;
    try {
      if (profile?.id) await deleteUserProfile(profile.id);
      await logout();
    } catch (error) {
      console.error("Error deleting account:", error);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message:
          "✈️ Check out Trace — it uses AI to find insane flight deals. Swipe through the best deals and save your favorites! https://swipe-ai.base44.app",
      });
    } catch {}
  };

  const handleResetPreferences = () => {
    Alert.alert("Reset Preferences", "This will take you through onboarding again.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reset",
        onPress: async () => {
          await updateProfile({
            destinationPreference: "both",
            travelTimeframe: [],
            dealTypes: [],
            onboardingComplete: false,
          });
        },
      },
    ]);
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
            t
              .replace(/_/g, " ")
              .replace(/\b\w/g, (l) => l.toUpperCase())
          )
          .join(", ") || "No preference",
    },
    {
      icon: Heart,
      label: "Deal Types",
      value: profile?.dealTypes?.map((t) => DEAL_TYPE_LABELS[t] || t).join(", ") || "All",
    },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.muted }} edges={["top", "left", "right"]}>
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
          <Text style={{ fontSize: 24, fontWeight: "800", color: theme.foreground }}>Profile</Text>
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
            <View style={{ flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 24 }}>
              {/* Avatar with camera overlay */}
              <TouchableOpacity onPress={handlePickPhoto} disabled={uploadingPhoto}>
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
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ fontSize: 20, fontWeight: "800", color: theme.foreground }}>
                    {profile?.displayName || user?.displayName || "Travel Explorer"}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      const name = profile?.displayName || user?.displayName || "";
                      const parts = name.split(" ");
                      setTempFirstName(parts[0] || "");
                      setTempLastName(parts.slice(1).join(" ") || "");
                      setEditingName(true);
                    }}
                  >
                    <Pencil color={theme.mutedForeground} size={14} />
                  </TouchableOpacity>
                </View>
                <Text style={{ fontSize: 14, color: theme.mutedForeground }}>{user?.email}</Text>
              </View>
            </View>
            {/* Stats grid */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-around",
                paddingTop: 16,
                borderTopWidth: 1,
                borderTopColor: theme.border,
              }}
            >
              <View style={{ alignItems: "center" }}>
                <Text style={{ fontSize: 24, fontWeight: "800", color: theme.foreground }}>
                  {profile?.swipeCount || 0}
                </Text>
                <Text style={{ fontSize: 12, color: theme.mutedForeground }}>Swipes</Text>
              </View>
              <View style={{ alignItems: "center" }}>
                <Text style={{ fontSize: 24, fontWeight: "800", color: theme.foreground }}>
                  {profile?.streakDays || 0}
                </Text>
                <Text style={{ fontSize: 12, color: theme.mutedForeground }}>Streak</Text>
              </View>
              <View style={{ alignItems: "center" }}>
                <Text style={{ fontSize: 24, fontWeight: "800", color: theme.foreground }}>
                  {profile?.dealHunterLevel || 1}
                </Text>
                <Text style={{ fontSize: 12, color: theme.mutedForeground }}>Level</Text>
              </View>
            </View>
          </View>

          {/* Subscription with gradient background */}
          <LinearGradient
            colors={scheme === "dark" ? ["#1c1917", "#1a1a1a"] : ["#fff1f2", "#fff7ed"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: 16,
              padding: 24,
              borderWidth: 1,
              borderColor: theme.border,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "700", color: theme.foreground, marginBottom: 16 }}>
              Subscription
            </Text>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                padding: 16,
                backgroundColor: scheme === "dark" ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.7)",
                borderRadius: 12,
                marginBottom: 16,
              }}
            >
              <View>
                <Text
                  style={{ fontWeight: "600", color: theme.foreground, textTransform: "capitalize" }}
                >
                  {profile?.subscriptionStatus || "free"}
                </Text>
                <Text style={{ fontSize: 12, color: theme.mutedForeground, marginTop: 4 }}>
                  {profile?.subscriptionStatus === "trial" && profile?.trialEndDate
                    ? `Trial ends ${new Date(profile.trialEndDate).toLocaleDateString()}`
                    : profile?.subscriptionStatus === "premium" || profile?.subscriptionStatus === "business"
                    ? "Active subscription"
                    : "Upgrade to unlock premium features"}
                </Text>
              </View>
              <Crown color={colors.brand.rose500} size={20} />
            </View>
            <TouchableOpacity
              onPress={() => setShowDisclosure(true)}
              style={{
                backgroundColor: colors.brand.traceRed,
                borderRadius: 12,
                paddingVertical: 14,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>
                {profile?.subscriptionStatus === "free"
                  ? "View Plans"
                  : profile?.subscriptionStatus === "premium" || profile?.subscriptionStatus === "business"
                  ? "Manage Plan"
                  : "View Plans"}
              </Text>
            </TouchableOpacity>
          </LinearGradient>

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
              <Text style={{ fontSize: 16, fontWeight: "700", color: theme.foreground }}>
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
                <Text style={{ fontSize: 12, fontWeight: "600", color: theme.foreground }}>Reset</Text>
              </TouchableOpacity>
            </View>
            {settings.map((s, i) => (
              <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 }}>
                <s.icon color={theme.mutedForeground} size={20} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: "500", color: theme.foreground }}>{s.label}</Text>
                  <Text style={{ fontSize: 12, color: theme.mutedForeground }}>{s.value}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Promo Code */}
          {(profile?.subscriptionStatus === "free" || profile?.subscriptionStatus === "trial") && (
            <View
              style={{
                backgroundColor: theme.card,
                borderRadius: 16,
                padding: 24,
                borderWidth: 1,
                borderColor: theme.border,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <Tag color={theme.foreground} size={16} />
                <Text style={{ fontSize: 16, fontWeight: "700", color: theme.foreground }}>Promo Code</Text>
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TextInput
                  value={promoCode}
                  onChangeText={(v) => {
                    setPromoCode(v);
                    setPromoStatus(null);
                  }}
                  placeholder="Enter code"
                  placeholderTextColor={theme.mutedForeground}
                  autoCapitalize="characters"
                  style={{
                    flex: 1,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderWidth: 1,
                    borderColor: theme.border,
                    backgroundColor: theme.background,
                    borderRadius: 8,
                    fontSize: 14,
                    color: theme.foreground,
                  }}
                />
                <TouchableOpacity
                  onPress={handlePromoCode}
                  disabled={promoLoading || !promoCode}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    backgroundColor: theme.foreground,
                    borderRadius: 8,
                    opacity: promoLoading || !promoCode ? 0.5 : 1,
                  }}
                >
                  <Text style={{ color: theme.background, fontSize: 14, fontWeight: "600" }}>
                    {promoLoading ? "..." : "Apply"}
                  </Text>
                </TouchableOpacity>
              </View>
              {promoStatus === "success" && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 }}>
                  <CheckCircle color="#16a34a" size={16} />
                  <Text style={{ color: "#16a34a", fontSize: 14 }}>Premium activated!</Text>
                </View>
              )}
              {promoStatus === "error" && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 }}>
                  <AlertCircle color="#ef4444" size={16} />
                  <Text style={{ color: "#ef4444", fontSize: 14 }}>Invalid promo code.</Text>
                </View>
              )}
            </View>
          )}

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
            <Text style={{ fontSize: 16, fontWeight: "700", color: theme.foreground, marginBottom: 4 }}>
              Share Trace
            </Text>
            <Text style={{ fontSize: 12, color: theme.mutedForeground, marginBottom: 16 }}>
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
                <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>Share with Friends</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

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
            <Text style={{ fontSize: 14, fontWeight: "600", color: theme.foreground }}>Sign Out</Text>
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
            <Text style={{ fontSize: 14, fontWeight: "600", color: "#ef4444" }}>Delete Account</Text>
          </TouchableOpacity>

        </View>
      </ScrollView>

      {/* Name edit modal */}
      <Modal visible={editingName} transparent animationType="fade">
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setEditingName(false)}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", paddingHorizontal: 16 }}
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
            <Text style={{ fontSize: 16, fontWeight: "700", color: theme.foreground, marginBottom: 16 }}>
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
                style={{ flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: theme.border, alignItems: "center" }}
              >
                <Text style={{ fontSize: 14, fontWeight: "600", color: theme.foreground }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveName}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: colors.brand.traceRed, alignItems: "center" }}
              >
                <Text style={{ fontSize: 14, fontWeight: "600", color: "#fff" }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      <ExternalLinkDisclosure
        visible={showDisclosure}
        onClose={() => setShowDisclosure(false)}
      />

      {/* Delete modal */}
      <Modal visible={showDeleteModal} transparent animationType="fade">
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setShowDeleteModal(false)}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", paddingHorizontal: 16 }}
        >
          <View style={{ backgroundColor: theme.card, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: theme.border }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: theme.foreground, marginBottom: 8 }}>
              Delete Account
            </Text>
            <Text style={{ fontSize: 14, color: theme.mutedForeground, marginBottom: 16 }}>
              This will permanently delete your profile and all your data.
            </Text>
            <Text style={{ fontSize: 14, color: theme.mutedForeground, marginBottom: 8 }}>
              Type <Text style={{ fontWeight: "700", color: theme.foreground }}>DELETE</Text> to confirm:
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
                onPress={() => { setShowDeleteModal(false); setDeleteText(""); }}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: theme.border, alignItems: "center" }}
              >
                <Text style={{ fontSize: 14, fontWeight: "600", color: theme.foreground }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDeleteAccount}
                disabled={deleteText !== "DELETE"}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 8,
                  backgroundColor: deleteText === "DELETE" ? "#ef4444" : theme.muted,
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: "600", color: deleteText === "DELETE" ? "#fff" : theme.mutedForeground }}>
                  Delete
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}
