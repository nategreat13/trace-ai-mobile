import React, { useCallback, useState } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  runOnJS,
  FadeInDown,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Compass, ArrowRight, Lock } from "lucide-react-native";
import { colors } from "../../theme/colors";
import { useAuth } from "../../context/AuthContext";

/**
 * "Anywhere specific in mind?" card — a break in the swipe rhythm that asks
 * the user to name a destination instead of reacting to one.
 *
 * Why it exists: the deck is entirely reactive, and a user with a specific
 * trip in mind has no way to say so without leaving for the Explore tab. This
 * card catches that intent in place. It's shown at most once per session —
 * intent is per-visit, so a user opening the app on Tuesday may well have a
 * different trip in mind than on Monday, but repeating it within one session
 * would turn a helpful moment into another interruption.
 *
 * Free users get the same working input. Letting them type first is the
 * point: the paywall that follows names the place they just chose, so it
 * reads as an answer rather than a wall. Naming a destination we then watch
 * for you IS the paid feature (deal alerts).
 *
 * Gesture mechanics mirror SwipeCard/UpsellSwipeCard rather than sharing code,
 * for the same reason those two don't share: the deal-swiping gesture is
 * proven and nobody wants to refactor it under a monetization deadline.
 */

const SWIPE_X_THRESHOLD = 80;
const VELOCITY_THRESHOLD = 300;
const EXIT_X = 500;
const EXIT_X_DURATION = 300;
const ROTATION_INPUT = [-300, 0, 300];
const ROTATION_OUTPUT = [-30, 0, 30];
const SCALE_INPUT = [-300, 0, 300];
const SCALE_OUTPUT = [0.95, 1, 0.95];

interface AssistantSwipeCardProps {
  /** Dismissed without acting (swiped away). */
  onDismiss: () => void;
  /** Premium user submitted a destination. */
  onSubmit: (destination: string) => void;
  /** Free user submitted; carries whatever they typed, if anything. */
  onUpgrade: (destination: string | null) => void;
  triggerSwipe: "left" | "right" | null;
}

export default function AssistantSwipeCard({
  onDismiss,
  onSubmit,
  onUpgrade,
  triggerSwipe,
}: AssistantSwipeCardProps) {
  const { isPremium, profile } = useAuth();
  const firstName = profile?.firstName?.trim() || null;
  const [value, setValue] = useState("");

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const handled = React.useRef(false);
  const handleDismiss = useCallback(() => {
    if (handled.current) return;
    handled.current = true;
    onDismiss();
  }, [onDismiss]);

  React.useEffect(() => {
    if (!triggerSwipe) return;
    const exitX = triggerSwipe === "left" ? -EXIT_X : EXIT_X;
    translateX.value = withTiming(exitX, { duration: EXIT_X_DURATION }, () => {
      runOnJS(handleDismiss)();
    });
  }, [triggerSwipe, translateX, handleDismiss]);

  // Pan only — no tap-to-advance. The card holds a text input, and a tap
  // gesture over it would steal focus taps and make the field feel broken.
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY;
    })
    .onEnd((event) => {
      const { translationX, velocityX } = event;
      if (
        Math.abs(translationX) > SWIPE_X_THRESHOLD ||
        Math.abs(velocityX) > VELOCITY_THRESHOLD
      ) {
        const dir = translationX < 0 ? -EXIT_X : EXIT_X;
        translateX.value = withTiming(dir, { duration: EXIT_X_DURATION }, () => {
          runOnJS(handleDismiss)();
        });
        return;
      }
      translateX.value = withTiming(0, { duration: 200 });
      translateY.value = withTiming(0, { duration: 200 });
    });

  const cardAnimatedStyle = useAnimatedStyle(() => {
    const rotation = interpolate(translateX.value, ROTATION_INPUT, ROTATION_OUTPUT);
    const scale = interpolate(translateX.value, SCALE_INPUT, SCALE_OUTPUT);
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotation}deg` },
        { scale },
      ],
    };
  });

  const canSubmit = value.trim().length > 1;

  /**
   * One submit path for both tiers. Premium goes to Explore with the term
   * pre-filled; free goes to the paywall carrying the same term, so the
   * offer can say "we'll watch Lisbon for you" instead of pitching alerts in
   * the abstract. Free users with nothing typed still reach the paywall — the
   * button is a valid way to express interest even without a destination.
   */
  const submit = useCallback(() => {
    const dest = value.trim();
    if (isPremium) {
      if (dest.length > 1) onSubmit(dest);
      return;
    }
    onUpgrade(dest.length > 1 ? dest : null);
  }, [value, isPremium, onSubmit, onUpgrade]);

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.card, cardAnimatedStyle]}>
        <LinearGradient
          colors={["#0f2a4a", "#1d4e73"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.content}>
          <Animated.View entering={FadeInDown.delay(80).duration(400)} style={styles.iconWrap}>
            <Compass color="#fff" size={26} />
          </Animated.View>

          <Text style={styles.eyebrow}>TRAVEL ASSISTANT</Text>
          <Text style={styles.headline}>
            {firstName ? `${firstName}, anywhere` : "Anywhere"}
            {"\n"}specific in mind?
          </Text>
          <Text style={styles.sub}>
            Name a place and we'll watch it for you — you'll hear the moment a
            fare drops.
          </Text>

          {/* Free users get a real, working input too.
              Letting them type first is the point: the upsell that follows
              names the place they just chose, so it reads as an answer to
              what they asked rather than a wall thrown up in front of them.
              A locked, untypeable field would have blocked exactly the moment
              of intent this card exists to capture. */}
          <View style={styles.inputRow}>
            <TextInput
              value={value}
              onChangeText={setValue}
              placeholder="Tokyo, Lisbon, anywhere…"
              placeholderTextColor="rgba(255,255,255,0.5)"
              style={styles.input}
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={() => canSubmit && submit()}
            />
            <TouchableOpacity
              onPress={submit}
              disabled={!canSubmit}
              style={[styles.goBtn, { opacity: canSubmit ? 1 : 0.4 }]}
              activeOpacity={0.85}
            >
              <ArrowRight color="#0f2a4a" size={18} />
            </TouchableOpacity>
          </View>

          {!isPremium && (
            <TouchableOpacity
              onPress={submit}
              activeOpacity={0.85}
              style={[styles.ctaRow, { opacity: canSubmit ? 1 : 0.75 }]}
            >
              <Lock color="#fff" size={15} />
              <Text style={styles.ctaText}>
                {canSubmit ? `Watch ${value.trim()} for me` : "Watch a destination for me"}
              </Text>
            </TouchableOpacity>
          )}

          <Text style={styles.hint}>Swipe to skip</Text>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: {
    position: "absolute",
    top: 0,
    left: 4,
    right: 4,
    bottom: 0,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    padding: 26,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: "rgba(255,255,255,0.7)",
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  headline: {
    fontSize: 30,
    fontWeight: "900",
    color: "#fff",
    lineHeight: 34,
    marginBottom: 12,
  },
  sub: {
    fontSize: 14,
    fontWeight: "500",
    color: "rgba(255,255,255,0.82)",
    lineHeight: 20,
    marginBottom: 22,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    borderRadius: 14,
    paddingLeft: 14,
    paddingRight: 8,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
    paddingVertical: 6,
  },
  goBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  lockBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  ctaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.brand.traceRed,
    borderRadius: 14,
    paddingVertical: 15,
    marginTop: 14,
  },
  ctaText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#fff",
  },
  hint: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    marginTop: 16,
  },
});
