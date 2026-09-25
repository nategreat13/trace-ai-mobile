import React from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown, SlideInDown, Easing } from "react-native-reanimated";
import { X, Lock, Mail, CreditCard, Check } from "lucide-react-native";
import { colors } from "../theme/colors";

/**
 * The step before Apple's payment sheet.
 *
 * 26 people tapped "Try Free" in the 1.8.0 cohort and 6 finished — 77% quit
 * on Apple's sheet, the largest single leak in the funnel and the only one
 * that happens on a screen Trace doesn't own. The old monthly sheet lost 70%,
 * so a chunk of that is simply what StoreKit costs. The extra is almost
 * certainly surprise: every screen in the flow says $3.99/mo, and the sheet
 * is the first place anyone sees $47.99 — arriving with a Face ID prompt
 * attached, which reads as a purchase rather than a trial.
 *
 * This can't change Apple's sheet, so it changes what happens immediately
 * before it. Three jobs, in order of what the data says matters:
 *
 *   1. Say the annual number out loud FIRST, so the sheet confirms an
 *      expectation instead of springing one.
 *   2. Lay out the timeline, so "free trial" stops being a vague promise
 *      and becomes three dated events with a $0 at the front.
 *   3. Name what the sheet will do — "Apple will ask you to confirm; you
 *      won't be charged today" — so the Face ID prompt is expected too.
 *
 * It adds a step to the funnel, which normally costs conversions. Worth it
 * here because the friction already exists: it's currently sitting inside
 * Apple's sheet where the framing is out of our hands, and anyone who bails
 * on this screen was going to bail on that one.
 */
interface TrialExplainerProps {
  visible: boolean;
  /** e.g. "7 days" */
  trialDuration: string;
  /** Localised renewal price, e.g. "$47.99" */
  priceString: string;
  /** "year" | "month" */
  period: string;
  /** Localised per-month equivalent for an annual plan, e.g. "$3.99/mo". */
  perMonth?: string | null;
  purchasing?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function TrialExplainer({
  visible,
  trialDuration,
  priceString,
  period,
  perMonth,
  purchasing = false,
  onConfirm,
  onCancel,
}: TrialExplainerProps) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;

  if (!visible) return null;

  // Reminder lands two days out on a 7-day trial, one day out on a 3-day one.
  const days = parseInt(trialDuration, 10);
  const reminderDay = Number.isFinite(days) && days >= 5 ? days - 2 : Math.max(1, (days || 3) - 1);

  const steps = [
    {
      Icon: Lock,
      tone: colors.brand.traceGreen,
      title: "Today — everything unlocks",
      body: "Full access to every deal, alert and guide. You are not charged today.",
    },
    {
      Icon: Mail,
      tone: colors.brand.amber500,
      title: `Day ${reminderDay} — we email you`,
      body: "A reminder that your trial is nearly up, so the date never sneaks up on you.",
    },
    {
      Icon: CreditCard,
      tone: theme.mutedForeground,
      title: `Day ${days || trialDuration} — billing starts`,
      body: `${priceString} per ${period} unless you cancel before then. Cancel anytime in two taps.`,
    },
  ];

  return (
    <Modal visible transparent animationType="none" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={purchasing ? undefined : onCancel}>
        <Animated.View entering={FadeIn.duration(200)} style={StyleSheet.absoluteFill} />
      </Pressable>

      <Animated.View
        entering={SlideInDown.duration(340).easing(Easing.out(Easing.cubic))}
        style={[styles.sheet, { backgroundColor: theme.background }]}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onCancel}
            disabled={purchasing}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={[styles.close, { backgroundColor: theme.muted }]}
          >
            <X size={18} color={theme.foreground} strokeWidth={2.4} />
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          {/* The duration lives in the price row below, so it stays out of
              the title — `trialDuration` is the noun form ("7 days") and
              reads wrong as an adjective ("7 days free trial"). */}
          <Text style={[styles.title, { color: theme.foreground }]}>
            How your free trial works
          </Text>

          {/* The annual number, said out loud before Apple says it. */}
          <Animated.View
            entering={FadeInDown.duration(300).delay(60)}
            style={[styles.priceRow, { backgroundColor: theme.muted }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.priceLabel, { color: theme.mutedForeground }]}>
                Due today
              </Text>
              <Text style={[styles.priceToday, { color: colors.brand.traceGreen }]}>
                $0.00
              </Text>
            </View>
            <View style={[styles.priceDivider, { backgroundColor: theme.border }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.priceLabel, { color: theme.mutedForeground }]}>
                Then, after {trialDuration}
              </Text>
              <Text style={[styles.priceThen, { color: theme.foreground }]}>
                {priceString}/{period}
              </Text>
              {!!perMonth && (
                <Text style={[styles.priceSub, { color: theme.mutedForeground }]}>
                  {perMonth}
                </Text>
              )}
            </View>
          </Animated.View>

          <View style={styles.timeline}>
            {steps.map((s, i) => (
              <Animated.View
                key={s.title}
                entering={FadeInDown.duration(300).delay(140 + i * 90)}
                style={styles.step}
              >
                <View style={styles.stepRail}>
                  <View style={[styles.stepDot, { backgroundColor: s.tone }]}>
                    <s.Icon size={13} color="#ffffff" strokeWidth={2.6} />
                  </View>
                  {i < steps.length - 1 && (
                    <View style={[styles.stepLine, { backgroundColor: theme.border }]} />
                  )}
                </View>
                <View style={styles.stepBody}>
                  <Text style={[styles.stepTitle, { color: theme.foreground }]}>
                    {s.title}
                  </Text>
                  <Text style={[styles.stepText, { color: theme.mutedForeground }]}>
                    {s.body}
                  </Text>
                </View>
              </Animated.View>
            ))}
          </View>
        </View>

        <SafeAreaView edges={["bottom"]} style={styles.footer}>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              onConfirm();
            }}
            disabled={purchasing}
            activeOpacity={0.9}
            accessibilityRole="button"
            style={{ opacity: purchasing ? 0.6 : 1 }}
          >
            <LinearGradient
              colors={[colors.brand.traceRed, colors.brand.tracePink]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.cta}
            >
              {purchasing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Check size={17} color="#fff" strokeWidth={3} />
                  <Text style={styles.ctaText}>Start my free trial</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Names the next screen, so Face ID isn't a surprise either. */}
          <Text style={[styles.footnote, { color: theme.mutedForeground }]}>
            Apple will ask you to confirm. You won't be charged today.
          </Text>
        </SafeAreaView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    overflow: "hidden",
  },
  header: { paddingTop: 12, paddingHorizontal: 16, alignItems: "flex-end" },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { paddingHorizontal: 22, paddingTop: 2, gap: 18 },
  title: {
    fontSize: 25,
    fontWeight: "800",
    letterSpacing: -0.5,
    lineHeight: 31,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 16,
  },
  priceDivider: { width: StyleSheet.hairlineWidth, alignSelf: "stretch" },
  priceLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 0.3 },
  priceToday: { fontSize: 26, fontWeight: "800", letterSpacing: -0.6, marginTop: 2 },
  priceThen: { fontSize: 20, fontWeight: "800", letterSpacing: -0.4, marginTop: 2 },
  priceSub: { fontSize: 12, marginTop: 1 },
  timeline: { gap: 0 },
  step: { flexDirection: "row", gap: 13 },
  stepRail: { alignItems: "center", width: 26 },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  stepLine: { width: 2, flex: 1, marginVertical: 3, borderRadius: 1 },
  stepBody: { flex: 1, paddingBottom: 18 },
  stepTitle: { fontSize: 15.5, fontWeight: "700" },
  stepText: { fontSize: 13.5, lineHeight: 19, marginTop: 2 },
  footer: { paddingHorizontal: 22, paddingTop: 4, paddingBottom: 18, gap: 9 },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    paddingVertical: 17,
  },
  ctaText: { color: "#fff", fontSize: 17, fontWeight: "800" },
  footnote: { fontSize: 12.5, textAlign: "center", lineHeight: 17 },
});
