import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  useColorScheme,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Linking,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import Animated, { FadeInUp } from "react-native-reanimated";
import { Image } from "expo-image";
import { X, CheckCircle2, Circle, Send, ExternalLink } from "lucide-react-native";
import { colors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";
import {
  subscribeTripGroup,
  joinTripGroup,
  addGroupComment,
  toggleIsIn,
} from "../services/firestore";
import type { TripGroup, TripGroupMember, TripGroupComment } from "@trace/shared";
const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

type RouteProps = RouteProp<RootStackParamList, "TripGroup">;
type NavProps = NativeStackNavigationProp<RootStackParamList>;

export default function TripGroupScreen() {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;
  const { user, profile } = useAuth();
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<NavProps>();
  const { groupId } = route.params;

  const [group, setGroup] = useState<(TripGroup & { id: string }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const isMember = group?.members.some((m) => m.userId === user?.uid) ?? false;
  const currentMember = group?.members.find((m) => m.userId === user?.uid);
  const isIn = currentMember?.isIn ?? false;

  useEffect(() => {
    if (!groupId) return;
    const unsub = subscribeTripGroup(groupId, (g) => {
      setGroup(g);
      setLoading(false);
    });
    return unsub;
  }, [groupId]);

  // Auto-join when arriving via deep link as a non-member
  useEffect(() => {
    if (!group || !user || !profile || isMember) return;
    const member: TripGroupMember = {
      userId: user.uid,
      displayName: profile.displayName || profile.firstName || "Traveler",
      profilePictureUrl: profile.profilePictureUrl ?? null,
      joinedAt: new Date(),
      isIn: false,
    };
    joinTripGroup(groupId, member).catch(console.error);
  }, [group?.id, user?.uid, isMember]);

  const handleToggleIsIn = async () => {
    if (!group || !user) return;
    try {
      await toggleIsIn(groupId, user.uid, !isIn, group.members);
    } catch (err) {
      console.error("Failed to toggle isIn:", err);
    }
  };

  const handleSendComment = async () => {
    if (!commentText.trim() || !user || !profile || submitting) return;
    setSubmitting(true);
    const comment: TripGroupComment = {
      id: genId(),
      userId: user.uid,
      displayName: profile.displayName || profile.firstName || "Traveler",
      text: commentText.trim(),
      createdAt: new Date(),
    };
    setCommentText("");
    try {
      await addGroupComment(groupId, comment);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 200);
    } catch (err) {
      console.error("Failed to send comment:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleBookDeal = () => {
    if (group?.deal?.url) Linking.openURL(group.deal.url);
  };

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  const formatTime = (date: any) => {
    const d = date?.toDate ? date.toDate() : new Date(date);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={theme.primary} />
      </SafeAreaView>
    );
  }

  if (!group) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Text style={{ fontSize: 16, color: theme.mutedForeground, textAlign: "center" }}>
          This trip group no longer exists.
        </Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 20 }}>
          <Text style={{ color: colors.brand.traceRed, fontWeight: "600" }}>Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const deal = group.deal;
  const everyoneIsIn = group.members.length > 0 && group.members.every((m) => m.isIn);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
        }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 12 }}>
            <X size={22} color={theme.foreground} />
          </TouchableOpacity>
          <Text style={{ fontSize: 17, fontWeight: "700", color: theme.foreground, flex: 1 }}>
            Trip Group
          </Text>
          {everyoneIsIn && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <CheckCircle2 size={16} color={colors.brand.traceGreen} />
              <Text style={{ fontSize: 12, fontWeight: "700", color: colors.brand.traceGreen }}>
                Everyone's in!
              </Text>
            </View>
          )}
        </View>

        <FlatList
          ref={flatListRef}
          data={group.comments}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <>
              {/* Deal card */}
              <Animated.View entering={FadeInUp.duration(300)} style={{ margin: 16 }}>
                <View style={{
                  backgroundColor: theme.card,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: theme.border,
                  overflow: "hidden",
                }}>
                  {deal?.imageUrl ? (
                    <View>
                      <Image source={{ uri: deal.imageUrl }} style={{ width: "100%", height: 180 }} contentFit="cover" />
                      {deal.discountPct > 0 && (
                        <View style={{
                          position: "absolute", top: 10, left: 10,
                          backgroundColor: deal.discountPct >= 50 ? "#FF8C00" : "#16a34a",
                          borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
                        }}>
                          <Text style={{ color: "#fff", fontSize: 12, fontWeight: "800" }}>
                            -{Math.round(deal.discountPct)}%
                          </Text>
                        </View>
                      )}
                      {deal.urgency && (
                        <View style={{
                          position: "absolute", bottom: 10, left: 10,
                          backgroundColor: "rgba(0,0,0,0.6)",
                          borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
                        }}>
                          <Text style={{ color: "#fff", fontSize: 11, fontWeight: "600" }}>{deal.urgency}</Text>
                        </View>
                      )}
                    </View>
                  ) : null}
                  <View style={{ padding: 14 }}>
                    {deal?.origin ? (
                      <Text style={{ fontSize: 13, color: theme.mutedForeground, fontWeight: "600", marginBottom: 4 }}>
                        {deal.origin} → {deal.destination}
                      </Text>
                    ) : (
                      <Text style={{ fontSize: 16, fontWeight: "800", color: theme.foreground, marginBottom: 4 }}>
                        {deal?.destination}
                      </Text>
                    )}
                    <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
                      <Text style={{ fontSize: 24, fontWeight: "800", color: theme.foreground }}>${deal?.price}</Text>
                      {deal?.originalPrice > 0 && deal.originalPrice !== deal.price && (
                        <Text style={{ fontSize: 14, color: theme.mutedForeground, textDecorationLine: "line-through" }}>
                          ${deal.originalPrice}
                        </Text>
                      )}
                    </View>
                    {deal?.travelWindow && (
                      <Text style={{ fontSize: 12, color: theme.mutedForeground, marginTop: 4 }}>
                        📅 {deal.travelWindow}
                      </Text>
                    )}
                    {deal?.airlines && (
                      <Text style={{ fontSize: 12, color: theme.mutedForeground, marginTop: 2 }}>
                        ✈️ {deal.airlines}
                      </Text>
                    )}
                  </View>
                </View>
              </Animated.View>

              {/* Members section */}
              <Animated.View entering={FadeInUp.delay(80).duration(300)} style={{ paddingHorizontal: 16, marginBottom: 16 }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: theme.mutedForeground, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Who's Going
                </Text>
                {group.members.map((member) => (
                  <View key={member.userId} style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 8,
                    gap: 10,
                  }}>
                    {member.profilePictureUrl ? (
                      <Image
                        source={{ uri: member.profilePictureUrl }}
                        style={{ width: 36, height: 36, borderRadius: 18 }}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={{
                        width: 36, height: 36, borderRadius: 18,
                        backgroundColor: colors.brand.traceRed,
                        alignItems: "center", justifyContent: "center",
                      }}>
                        <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>
                          {getInitials(member.displayName)}
                        </Text>
                      </View>
                    )}
                    <Text style={{ fontSize: 15, fontWeight: "600", color: theme.foreground, flex: 1 }}>
                      {member.displayName}
                      {member.userId === group.createdBy ? (
                        <Text style={{ fontSize: 12, color: theme.mutedForeground, fontWeight: "400" }}> · host</Text>
                      ) : null}
                    </Text>
                    {member.isIn && (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#dcfce7", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                        <CheckCircle2 size={13} color={colors.brand.traceGreen} />
                        <Text style={{ fontSize: 12, fontWeight: "700", color: colors.brand.traceGreen }}>I'm in</Text>
                      </View>
                    )}
                  </View>
                ))}
              </Animated.View>

              {/* I'm In toggle */}
              <Animated.View entering={FadeInUp.delay(140).duration(300)} style={{ paddingHorizontal: 16, marginBottom: 20 }}>
                <TouchableOpacity
                  onPress={handleToggleIsIn}
                  style={{
                    backgroundColor: isIn ? colors.brand.traceGreen : theme.muted,
                    borderRadius: 14,
                    paddingVertical: 14,
                    alignItems: "center",
                    flexDirection: "row",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  {isIn ? (
                    <CheckCircle2 size={18} color="#fff" />
                  ) : (
                    <Circle size={18} color={theme.mutedForeground} />
                  )}
                  <Text style={{
                    fontSize: 16,
                    fontWeight: "700",
                    color: isIn ? "#fff" : theme.mutedForeground,
                  }}>
                    {isIn ? "You're in!" : "I'm in"}
                  </Text>
                </TouchableOpacity>
              </Animated.View>

              {/* Comments header */}
              {group.comments.length > 0 && (
                <Text style={{
                  fontSize: 13, fontWeight: "700", color: theme.mutedForeground,
                  paddingHorizontal: 16, marginBottom: 8,
                  textTransform: "uppercase", letterSpacing: 0.5,
                }}>
                  Comments
                </Text>
              )}
            </>
          }
          renderItem={({ item, index }: { item: TripGroupComment; index: number }) => (
            <Animated.View
              entering={FadeInUp.delay(index * 30).duration(250)}
              style={{ paddingHorizontal: 16, marginBottom: 12 }}
            >
              <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
                <View style={{
                  width: 30, height: 30, borderRadius: 15,
                  backgroundColor: item.userId === user?.uid ? colors.brand.traceRed : theme.muted,
                  alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <Text style={{ color: item.userId === user?.uid ? "#fff" : theme.mutedForeground, fontSize: 11, fontWeight: "700" }}>
                    {getInitials(item.displayName)}
                  </Text>
                </View>
                <View style={{
                  flex: 1,
                  backgroundColor: theme.card,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: theme.border,
                  padding: 10,
                }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: theme.foreground }}>{item.displayName}</Text>
                    <Text style={{ fontSize: 11, color: theme.mutedForeground }}>{formatTime(item.createdAt)}</Text>
                  </View>
                  <Text style={{ fontSize: 14, color: theme.foreground, lineHeight: 20 }}>{item.text}</Text>
                </View>
              </View>
            </Animated.View>
          )}
          ListFooterComponent={<View style={{ height: 16 }} />}
          contentContainerStyle={{ paddingBottom: 8 }}
          onContentSizeChange={() => {
            if (group.comments.length > 0) {
              flatListRef.current?.scrollToEnd({ animated: false });
            }
          }}
        />

        {/* Bottom bar: comment input + book button */}
        <View style={{
          borderTopWidth: 1,
          borderTopColor: theme.border,
          paddingHorizontal: 12,
          paddingVertical: 10,
          gap: 10,
          backgroundColor: theme.background,
        }}>
          {/* Book Deal button */}
          <TouchableOpacity
            onPress={handleBookDeal}
            style={{
              backgroundColor: colors.brand.traceRed,
              borderRadius: 14,
              paddingVertical: 13,
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <ExternalLink size={16} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Book Deal</Text>
          </TouchableOpacity>

          {/* Comment input */}
          <View style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: theme.muted,
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 6,
            gap: 8,
          }}>
            <TextInput
              value={commentText}
              onChangeText={setCommentText}
              placeholder="Add a comment…"
              placeholderTextColor={theme.mutedForeground}
              style={{ flex: 1, fontSize: 14, color: theme.foreground, paddingVertical: 4 }}
              returnKeyType="send"
              onSubmitEditing={handleSendComment}
              blurOnSubmit={false}
            />
            <TouchableOpacity onPress={handleSendComment} disabled={!commentText.trim() || submitting}>
              <Send
                size={18}
                color={commentText.trim() ? colors.brand.traceRed : theme.mutedForeground}
              />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
