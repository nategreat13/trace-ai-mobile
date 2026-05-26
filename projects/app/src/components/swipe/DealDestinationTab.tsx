import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  Animated,
  Easing,
} from "react-native";
import { MapPin, Sparkles, UtensilsCrossed, Compass, Plane } from "lucide-react-native";
import { Deal } from "@trace/shared";
import { colors } from "../../theme/colors";
import { useDestinationInfo } from "../../hooks/useDestinationInfo";
import { DestinationInfo } from "../../lib/destinationData";

// ── Tag → travel style mapping for For You personalization ──────────────────
const TAG_MAP: Record<string, string[]> = {
  adventure:   ["adventure"],
  culture:     ["culture"],
  food:        ["food"],
  relaxation:  ["relaxation"],
  luxury:      ["luxury"],
  family:      ["family"],
  romantic:    ["romantic"],
  // dealTypes aliases
  budget:      ["food", "relaxation"],
  surprise:    ["adventure", "culture"],
};

function getForYouItems(
  info: DestinationInfo,
  dealTypes: string[]
): Array<{ emoji: string; name: string; description: string; reason: string }> {
  if (!dealTypes.length) return [];

  const wantedTags = new Set(
    dealTypes.flatMap((dt) => TAG_MAP[dt.toLowerCase()] ?? [dt.toLowerCase()])
  );

  const scored = info.thingsToDo
    .map((item) => ({
      ...item,
      score: item.tags.filter((t) => wantedTags.has(t)).length,
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const reasonMap: Record<string, string> = {
    adventure: "adventure traveler",
    culture: "culture lover",
    food: "food enthusiast",
    relaxation: "relaxation seeker",
    luxury: "luxury traveler",
    family: "family trip",
    romantic: "romantic getaway",
  };

  return scored.map((item) => {
    const matchedTag = item.tags.find((t) => wantedTags.has(t)) ?? item.tags[0];
    return {
      emoji: item.emoji,
      name: item.name,
      description: item.description,
      reason: reasonMap[matchedTag] ?? matchedTag,
    };
  });
}

const LOADING_STEPS = [
  { Icon: MapPin,          title: "Scouting neighborhoods",   subtitle: "Finding where locals actually hang out…" },
  { Icon: Sparkles,        title: "Uncovering hidden gems",   subtitle: "Digging past the tourist traps…" },
  { Icon: UtensilsCrossed, title: "Checking the dining scene", subtitle: "From street food to splurge-worthy spots…" },
  { Icon: Compass,         title: "Mapping your trip",        subtitle: "Day trips, getting around, what to skip…" },
  { Icon: Plane,           title: "Almost there",             subtitle: "Putting your personalized guide together…" },
];

function LoadingState({ scheme }: { scheme: "dark" | "light" | null | undefined }) {
  const [stepIdx, setStepIdx] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const iconFade = useRef(new Animated.Value(1)).current;
  const iconScale = useRef(new Animated.Value(1)).current;
  const rippleScale = useRef(new Animated.Value(1)).current;
  const rippleOpacity = useRef(new Animated.Value(0.5)).current;

  // Continuous bounce on the icon circle
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(iconScale, { toValue: 1.12, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(iconScale, { toValue: 1,    duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Ripple that expands and fades on repeat
  useEffect(() => {
    const fireRipple = () => {
      rippleScale.setValue(1);
      rippleOpacity.setValue(0.45);
      Animated.parallel([
        Animated.timing(rippleScale,   { toValue: 2.0, duration: 1100, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(rippleOpacity, { toValue: 0,   duration: 1100, useNativeDriver: true }),
      ]).start();
    };
    fireRipple();
    const id = setInterval(fireRipple, 1600);
    return () => clearInterval(id);
  }, []);

  // Step cycling with crossfade
  useEffect(() => {
    const interval = setInterval(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
        Animated.timing(iconFade, { toValue: 0, duration: 280, useNativeDriver: true }),
      ]).start(() => {
        setStepIdx((i) => (i + 1) % LOADING_STEPS.length);
        Animated.parallel([
          Animated.timing(fadeAnim, { toValue: 1, duration: 380, useNativeDriver: true }),
          Animated.timing(iconFade, { toValue: 1, duration: 380, useNativeDriver: true }),
        ]).start();
      });
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  const step = LOADING_STEPS[stepIdx];
  const { Icon } = step;
  const textColor = scheme === "dark" ? "#ffffff" : "#111111";
  const subtitleColor = scheme === "dark" ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.4)";

  return (
    <View style={loadingStyles.container}>
      {/* Icon + ripple stack */}
      <View style={loadingStyles.iconOuter}>
        {/* Ripple ring */}
        <Animated.View
          style={[
            loadingStyles.ripple,
            { opacity: rippleOpacity, transform: [{ scale: rippleScale }] },
          ]}
        />
        {/* Bouncing icon circle */}
        <Animated.View
          style={[
            loadingStyles.iconWrap,
            { opacity: iconFade, transform: [{ scale: iconScale }] },
          ]}
        >
          <Icon color={colors.brand.traceRed} size={38} strokeWidth={1.5} />
        </Animated.View>
      </View>

      <Animated.View style={{ alignItems: "center", gap: 8, opacity: fadeAnim }}>
        <Text style={[loadingStyles.title, { color: textColor }]}>{step.title}</Text>
        <Text style={[loadingStyles.subtitle, { color: subtitleColor }]}>{step.subtitle}</Text>
      </Animated.View>
    </View>
  );
}

const loadingStyles = StyleSheet.create({
  container: {
    paddingTop: 60,
    paddingBottom: 80,
    paddingHorizontal: 32,
    alignItems: "center",
    gap: 28,
  },
  iconOuter: {
    width: 88,
    height: 88,
    alignItems: "center",
    justifyContent: "center",
  },
  ripple: {
    position: "absolute",
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "rgba(239,68,68,0.18)",
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "rgba(239,68,68,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.3,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
});

// ── Section wrapper ──────────────────────────────────────────────────────────
function Section({ title, children, theme }: {
  title: string;
  children: React.ReactNode;
  theme: any;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.mutedForeground }]}>{title.toUpperCase()}</Text>
      {children}
    </View>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
interface Props {
  deal: Deal;
  userProfile?: any;
}

export default function DealDestinationTab({ deal, userProfile }: Props) {
  // ALL hooks must be declared before any conditional return. React
  // requires the same hook count + order on every render — adding a
  // useState below an `if (loading) return` would crash with
  // "Rendered more hooks than during the previous render" the moment
  // the loading state flips.
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;
  const { info, loading, error, refetch } = useDestinationInfo(deal);
  const [expandedNeighborhood, setExpandedNeighborhood] = useState<string | null>(null);
  const [showAllTodo, setShowAllTodo] = useState(false);
  const [expandedDining, setExpandedDining] = useState<Record<string, boolean>>({});
  const [expandedDayTrip, setExpandedDayTrip] = useState<string | null>(null);

  if (loading) return <LoadingState scheme={scheme} />;

  if (error || !info) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorEmoji}>🌐</Text>
        <Text style={[styles.errorTitle, { color: theme.foreground }]}>
          Couldn't load destination info
        </Text>
        <Text style={[styles.errorText, { color: theme.mutedForeground }]}>
          The guide is generated on demand and sometimes takes a moment.
          Tap retry to try again.
        </Text>
        <TouchableOpacity
          onPress={refetch}
          activeOpacity={0.85}
          style={[styles.retryButton, { backgroundColor: colors.brand.traceRed }]}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const dealTypes: string[] = userProfile?.dealTypes ?? [];
  const forYouItems = getForYouItems(info, dealTypes);
  const isInternational = !!(info.essentials);

  return (
    <View style={styles.root}>

      {/* ── For You ─────────────────────────────────────────────────── */}
      {forYouItems.length > 0 && (
        <Section title="For You" theme={theme}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow}>
            {forYouItems.map((item, i) => (
              <View key={i} style={[styles.forYouCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <View style={styles.forYouTop}>
                  <Text style={styles.forYouEmoji}>{item.emoji}</Text>
                  <View style={[styles.forYouBadge, { backgroundColor: scheme === "dark" ? "rgba(139,92,246,0.18)" : "rgba(139,92,246,0.10)" }]}>
                    <Text style={[styles.forYouBadgeText, { color: scheme === "dark" ? "#c4b5fd" : "#7c3aed" }]}>{item.reason}</Text>
                  </View>
                </View>
                <Text style={[styles.forYouName, { color: theme.foreground }]}>{item.name}</Text>
                <Text style={[styles.forYouDesc, { color: theme.mutedForeground }]}>{item.description}</Text>
              </View>
            ))}
          </ScrollView>
        </Section>
      )}

      {/* ── Essentials (international only) ─────────────────────────── */}
      {isInternational && info.essentials && (
        <Section title="Essentials" theme={theme}>
          <View style={[styles.listCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <EssRow label={`${info.essentials.flag}  Country`} value="" theme={theme} />
            <EssRow label="Currency" value={info.essentials.currency} theme={theme} />
            <EssRow label="Language" value={info.essentials.language} theme={theme} />
            <EssRow label="Timezone" value={info.essentials.timezone} theme={theme} />
            <EssRow
              label="Power Plug"
              value={`${info.essentials.plug} · ${info.essentials.needsAdapter ? "Adapter needed" : "No adapter needed"}`}
              theme={theme}
              last
            />
          </View>
        </Section>
      )}

      {/* ── Neighborhoods ───────────────────────────────────────────── */}
      <Section title="Neighborhoods" theme={theme}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow}>
          {info.neighborhoods.map((n) => (
            <TouchableOpacity
              key={n.name}
              activeOpacity={0.8}
              onPress={() => setExpandedNeighborhood(expandedNeighborhood === n.name ? null : n.name)}
              style={[
                styles.hoodCard,
                { backgroundColor: theme.card, borderColor: expandedNeighborhood === n.name ? colors.brand.traceRed : theme.border },
              ]}
            >
              <Text style={styles.hoodEmoji}>{n.emoji}</Text>
              <Text style={[styles.hoodName, { color: theme.foreground }]}>{n.name}</Text>
              <Text style={[styles.hoodVibe, { color: theme.mutedForeground }]}>{n.vibe}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {expandedNeighborhood && (() => {
          const n = info.neighborhoods.find((x) => x.name === expandedNeighborhood);
          if (!n) return null;
          return (
            <View style={[styles.hoodExpanded, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.hoodExpandedTitle, { color: theme.foreground }]}>{n.emoji} {n.name}</Text>
              <Text style={[styles.hoodExpandedDesc, { color: theme.mutedForeground }]}>{n.description}</Text>
            </View>
          );
        })()}
      </Section>

      {/* ── Things To Do ────────────────────────────────────────────── */}
      <Section title="Things To Do" theme={theme}>
        <View style={[styles.listCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {(showAllTodo ? info.thingsToDo : info.thingsToDo.slice(0, 3)).map((item, i, arr) => (
            <View
              key={item.name}
              style={[styles.todoRow, { borderBottomColor: theme.border }, i === arr.length - 1 && !showAllTodo && info.thingsToDo.length > 3 ? {} : i === arr.length - 1 ? { borderBottomWidth: 0 } : {}]}
            >
              <Text style={styles.todoEmoji}>{item.emoji}</Text>
              <View style={styles.todoText}>
                <Text style={[styles.todoName, { color: theme.foreground }]}>{item.name}</Text>
                <Text style={[styles.todoDesc, { color: theme.mutedForeground }]}>{item.description}</Text>
              </View>
            </View>
          ))}
          {info.thingsToDo.length > 3 && (
            <TouchableOpacity
              onPress={() => setShowAllTodo((v) => !v)}
              style={[styles.showMoreRow, { borderTopColor: theme.border }]}
            >
              <Text style={[styles.showMoreText, { color: theme.mutedForeground }]}>
                {showAllTodo ? "Show less" : `Show ${info.thingsToDo.length - 3} more`}
              </Text>
              <Text style={[styles.showMoreChevron, { color: theme.mutedForeground }]}>{showAllTodo ? "↑" : "↓"}</Text>
            </TouchableOpacity>
          )}
        </View>
      </Section>

      {/* ── Dining ──────────────────────────────────────────────────── */}
      <Section title="Where to Eat" theme={theme}>
        <View style={[styles.listCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {(["budget", "moderate", "premium"] as const).map((tier, tierIdx) => {
            const places = info.dining[tier];
            if (!places?.length) return null;
            const isExpanded = !!expandedDining[tier];
            const tierConfig = {
              budget:   { symbol: "$",   label: "Budget",    color: "#16a34a" },
              moderate: { symbol: "$$",  label: "Mid-Range", color: "#b45309" },
              premium:  { symbol: "$$$", label: "Splurge",   color: colors.brand.traceRed },
            }[tier];
            return (
              <View key={tier}>
                <TouchableOpacity
                  onPress={() => setExpandedDining((prev) => ({ ...prev, [tier]: !prev[tier] }))}
                  activeOpacity={0.7}
                  style={[
                    styles.diningTierHeader,
                    { borderTopColor: theme.border },
                    tierIdx === 0 && { borderTopWidth: 0 },
                  ]}
                >
                  <Text style={[styles.diningSymbol, { color: tierConfig.color }]}>{tierConfig.symbol}</Text>
                  <Text style={[styles.diningTierLabel, { color: theme.mutedForeground }]}>{tierConfig.label}</Text>
                  <Text style={[styles.diningCount, { color: theme.mutedForeground }]}>{places.length} spots</Text>
                  <Text style={[styles.showMoreChevron, { color: theme.mutedForeground }]}>{isExpanded ? "↑" : "↓"}</Text>
                </TouchableOpacity>
                {isExpanded && places.map((p, i) => (
                  <View
                    key={p.name}
                    style={[styles.diningRow, { borderTopColor: theme.border }]}
                  >
                    <Text style={[styles.diningName, { color: theme.foreground }]}>{p.name}</Text>
                    <Text style={[styles.diningType, { color: theme.mutedForeground }]}>{p.type}</Text>
                  </View>
                ))}
              </View>
            );
          })}
        </View>
      </Section>

      {/* ── Daily Budget ─────────────────────────────────────────────── */}
      <Section title="Daily Budget" theme={theme}>
        <View style={styles.budgetRow}>
          {(["budget", "midRange", "luxury"] as const).map((tier) => {
            const b = info.dailyBudget[tier];
            const config = {
              budget:   { label: "Budget",   emoji: "🟢" },
              midRange: { label: "Mid-Range", emoji: "🟡" },
              luxury:   { label: "Luxury",   emoji: "🔴" },
            }[tier];
            return (
              <View key={tier} style={[styles.budgetCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text style={styles.budgetEmoji}>{config.emoji}</Text>
                <Text style={[styles.budgetLabel, { color: theme.mutedForeground }]}>{config.label}</Text>
                <Text style={[styles.budgetAmount, { color: theme.foreground }]}>{b.amount}</Text>
                <Text style={[styles.budgetDesc, { color: theme.mutedForeground }]}>{b.description}</Text>
              </View>
            );
          })}
        </View>
      </Section>

      {/* ── Getting Around ───────────────────────────────────────────── */}
      <Section title="Getting Around" theme={theme}>
        {info.gettingAround.map((g, i) => (
          <View key={i} style={[styles.aroundCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.aroundHeader}>
              <Text style={styles.aroundIcon}>{g.icon}</Text>
              <Text style={[styles.aroundMode, { color: theme.foreground }]}>{g.mode}</Text>
              {!!g.cost && (
                <View style={[styles.costBadge, { backgroundColor: scheme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)" }]}>
                  <Text style={[styles.costText, { color: theme.mutedForeground }]}>{g.cost}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.aroundTip, { color: theme.mutedForeground }]}>{g.tip}</Text>
          </View>
        ))}
      </Section>

      {/* ── Day Trips ────────────────────────────────────────────────── */}
      <Section title="Day Trips" theme={theme}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow}>
          {info.dayTrips.map((d) => (
            <TouchableOpacity
              key={d.name}
              activeOpacity={0.8}
              onPress={() => setExpandedDayTrip(expandedDayTrip === d.name ? null : d.name)}
              style={[
                styles.dayTripCard,
                { backgroundColor: theme.card, borderColor: expandedDayTrip === d.name ? colors.brand.traceRed : theme.border },
              ]}
            >
              <Text style={styles.dayTripEmoji}>{d.emoji}</Text>
              <Text style={[styles.dayTripName, { color: theme.foreground }]}>{d.name}</Text>
              <Text style={[styles.dayTripTime, { color: theme.mutedForeground }]}>{d.time}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {expandedDayTrip && (() => {
          const d = info.dayTrips.find((x) => x.name === expandedDayTrip);
          if (!d?.description) return null;
          return (
            <View style={[styles.dayTripExpanded, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.dayTripExpandedTitle, { color: theme.foreground }]}>{d.emoji} {d.name}</Text>
              <Text style={[styles.dayTripExpandedTime, { color: colors.brand.traceRed }]}>{d.time}</Text>
              <Text style={[styles.dayTripExpandedDesc, { color: theme.mutedForeground }]}>{d.description}</Text>
            </View>
          );
        })()}
      </Section>

      {/* ── What to Avoid ────────────────────────────────────────────── */}
      <Section title="What to Avoid" theme={theme}>
        <View style={styles.avoidGrid}>
          {info.whatToAvoid.map((item, i) => (
            <View
              key={i}
              style={[
                styles.avoidPill,
                {
                  backgroundColor: scheme === "dark" ? "rgba(239,68,68,0.08)" : "rgba(239,68,68,0.05)",
                  borderColor: scheme === "dark" ? "rgba(239,68,68,0.20)" : "rgba(239,68,68,0.14)",
                },
              ]}
            >
              <Text style={[styles.avoidTip, { color: theme.foreground }]}>{item.tip}</Text>
            </View>
          ))}
        </View>
      </Section>

    </View>
  );
}

function EssRow({ label, value, theme, last }: { label: string; value: string; theme: any; last?: boolean }) {
  return (
    <View style={[styles.essRow, { borderBottomColor: theme.border }, last && { borderBottomWidth: 0 }]}>
      <Text style={[styles.essLabel, { color: theme.mutedForeground }]}>{label}</Text>
      {!!value && <Text style={[styles.essValue, { color: theme.foreground }]}>{value}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingTop: 8, paddingBottom: 40 },

  errorContainer: { padding: 40, alignItems: "center", gap: 10 },
  errorEmoji: { fontSize: 40, marginBottom: 4 },
  errorTitle: { fontSize: 17, fontWeight: "700", textAlign: "center" },
  errorText: { fontSize: 14, textAlign: "center", lineHeight: 21, maxWidth: 300 },
  retryButton: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  retryButtonText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  section: { paddingHorizontal: 20, marginBottom: 28 },
  sectionTitle: { fontSize: 10, fontWeight: "700", letterSpacing: 1.4, marginBottom: 10 },

  hRow: { paddingRight: 20, gap: 10 },

  // For You
  forYouCard: {
    width: 200,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  forYouTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  forYouEmoji: { fontSize: 24 },
  forYouBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  forYouBadgeText: { fontSize: 10, fontWeight: "700" },
  forYouName: { fontSize: 14, fontWeight: "700" },
  forYouDesc: { fontSize: 12, lineHeight: 18 },

  // Essentials
  essRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  essLabel: { fontSize: 13, fontWeight: "500" },
  essValue: { fontSize: 13, fontWeight: "600", flex: 1, textAlign: "right" },

  // Neighborhoods
  hoodCard: { width: 130, borderRadius: 14, borderWidth: 1, padding: 14, gap: 4 },
  hoodEmoji: { fontSize: 24, marginBottom: 4 },
  hoodName: { fontSize: 13, fontWeight: "700" },
  hoodVibe: { fontSize: 11, fontWeight: "500" },
  hoodExpanded: { marginTop: 10, borderRadius: 14, borderWidth: 1, padding: 16, gap: 6 },
  hoodExpandedTitle: { fontSize: 15, fontWeight: "700" },
  hoodExpandedDesc: { fontSize: 13, lineHeight: 20 },

  // Generic list card
  listCard: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },

  // Things to Do
  todoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  todoEmoji: { fontSize: 18, width: 26, textAlign: "center", marginTop: 1 },
  todoText: { flex: 1, gap: 2 },
  todoName: { fontSize: 14, fontWeight: "600" },
  todoDesc: { fontSize: 12, lineHeight: 18 },

  // Dining
  diningTierHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  diningSymbol: { fontSize: 13, fontWeight: "800", width: 32 },
  diningTierLabel: { fontSize: 13, fontWeight: "600", flex: 1 },
  diningCount: { fontSize: 11, fontWeight: "500" },
  diningRow: { paddingHorizontal: 16, paddingVertical: 11, borderTopWidth: StyleSheet.hairlineWidth, gap: 2 },
  diningName: { fontSize: 14, fontWeight: "600" },
  diningType: { fontSize: 12 },

  // Daily Budget
  budgetRow: { flexDirection: "row", gap: 10 },
  budgetCard: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 12, gap: 4 },
  budgetEmoji: { fontSize: 16, marginBottom: 2 },
  budgetLabel: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  budgetAmount: { fontSize: 15, fontWeight: "800" },
  budgetDesc: { fontSize: 11, lineHeight: 16 },

  // Getting Around
  aroundCard: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 10, gap: 8 },
  aroundHeader: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  aroundIcon: { fontSize: 20 },
  aroundMode: { fontSize: 14, fontWeight: "700", flex: 1 },
  costBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  costText: { fontSize: 11, fontWeight: "600" },
  aroundTip: { fontSize: 13, lineHeight: 19 },

  // Day Trips
  dayTripCard: { width: 140, borderRadius: 14, borderWidth: 1, padding: 14, gap: 4 },
  dayTripEmoji: { fontSize: 24, marginBottom: 4 },
  dayTripName: { fontSize: 13, fontWeight: "700" },
  dayTripTime: { fontSize: 11, fontWeight: "500" },
  dayTripExpanded: { marginTop: 10, borderRadius: 14, borderWidth: 1, padding: 16, gap: 4 },
  dayTripExpandedTitle: { fontSize: 15, fontWeight: "700" },
  dayTripExpandedTime: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  dayTripExpandedDesc: { fontSize: 13, lineHeight: 20, marginTop: 4 },

  // Things To Do show-more / Dining expand
  showMoreRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  showMoreText: { fontSize: 13, fontWeight: "600" },
  showMoreChevron: { fontSize: 12, fontWeight: "700" },

  // What to Avoid
  avoidGrid: { gap: 8 },
  avoidPill: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 11 },
  avoidTip: { fontSize: 13, lineHeight: 19 },
});
