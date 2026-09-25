import React from "react";
import { View, Text, StyleSheet, useColorScheme } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Lock, Mail, CreditCard } from "lucide-react-native";
import { colors } from "../theme/colors";

/**
 * "How your free trial works", shown inline on the paywall.
 *
 * 26 people tapped "Try Free" in the 1.8.0 cohort and 6 finished. 77% quit
 * inside Apple's sheet — the one screen in the funnel Trace doesn't own. The
 * old monthly sheet lost 70%, so part of that is simply what StoreKit costs;
 * the rest is almost certainly surprise. Every screen in the flow says
 * $3.99/mo, and the sheet is the first place anyone meets $47.99, arriving
 * with a Face ID prompt that reads as a purchase rather than a trial.
 *
 * So the annual number gets said out loud first, next to a $0, with the
 * timeline underneath it.
 *
 * This was briefly a modal that appeared after the CTA was tapped. Inline is
 * better for a reason worth keeping: someone who has tapped "Try Free" has
 * already decided, and a screen in front of a decided user is an opportunity
 * to un-decide. Here the terms are absorbed during consideration instead, and
 * the paywall had ~200pt of dead space between the plan cards and the CTA
 * that this fills. The one line that genuinely belongs after the tap —
 * "Apple will ask you to confirm" — lives under the button.
 */
interface TrialTimelineProps {
  /** e.g. "7 days" */
  trialDuration: string;
  /** Localised renewal price, e.g. "$47.99" */
  priceString: string;
  /** "year" | "month" */
  period: string;
  /** Localised per-month equivalent for an annual plan, e.g. "$3.99/mo". */
  perMonth?: string | null;
  /** Drop the timeline and show only the price row, where space is tight. */
  compact?: boolean;
}

export default function TrialTimeline({
  trialDuration,
  priceString,
  period,
  perMonth,
  compact = false,
}: TrialTimelineProps) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;

  // Reminder lands two days out on a 7-day trial, one day out on a 3-day one.
  const days = parseInt(trialDuration, 10);
  const reminderDay =
    Number.isFinite(days) && days >= 5 ? days - 2 : Math.max(1, (days || 3) - 1);

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
      body: `${priceString} per ${period} unless you cancel. Cancel anytime in two taps.`,
    },
  ];

  return (
    <View style={styles.wrap}>
      <View style={[styles.priceRow, { backgroundColor: theme.muted }]}>
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
      </View>

      {!compact && (
        <View style={styles.timeline}>
          {steps.map((s, i) => (
            <Animated.View
              key={s.title}
              entering={FadeInDown.duration(280).delay(80 + i * 70)}
              style={styles.step}
            >
              <View style={styles.stepRail}>
                <View style={[styles.stepDot, { backgroundColor: s.tone }]}>
                  <s.Icon size={12} color="#ffffff" strokeWidth={2.6} />
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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 16,
    gap: 16,
  },
  priceDivider: { width: StyleSheet.hairlineWidth, alignSelf: "stretch" },
  priceLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 0.3 },
  priceToday: { fontSize: 24, fontWeight: "800", letterSpacing: -0.6, marginTop: 2 },
  priceThen: { fontSize: 19, fontWeight: "800", letterSpacing: -0.4, marginTop: 2 },
  priceSub: { fontSize: 12, marginTop: 1 },
  timeline: { gap: 0 },
  step: { flexDirection: "row", gap: 12 },
  stepRail: { alignItems: "center", width: 24 },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  stepLine: { width: 2, flex: 1, marginVertical: 3, borderRadius: 1 },
  stepBody: { flex: 1, paddingBottom: 14 },
  stepTitle: { fontSize: 15, fontWeight: "700" },
  stepText: { fontSize: 13, lineHeight: 18, marginTop: 2 },
});
