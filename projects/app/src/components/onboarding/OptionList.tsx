import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
} from "react-native";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Check } from "lucide-react-native";
import { colors } from "../../theme/colors";

interface Option {
  value: string;
  icon: string;
  label: string;
  sub?: string;
}

interface OptionListProps {
  options: readonly Option[];
  selected: string | string[];
  onSelect: (value: string | string[]) => void;
  multi?: boolean;
}

/**
 * Full-width single-column option rows — icon chip, label, selection dot.
 *
 * Sits alongside `OptionGrid` rather than replacing it: the grid's 2-up cards
 * still suit the multi-select preference steps where the sub-labels earn their
 * space, while this list is for the one-tap questions where a taller, calmer
 * row scans faster and reads as a survey rather than a form.
 *
 * Rows stagger in on mount (40ms apart). It's a small thing, but it's most of
 * the difference between a screen that appears and a screen that arrives.
 */
export default function OptionList({
  options,
  selected,
  onSelect,
  multi = false,
}: OptionListProps) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;

  const isSelected = (value: string): boolean =>
    multi && Array.isArray(selected)
      ? selected.includes(value)
      : selected === value;

  const handleSelect = (value: string) => {
    Haptics.selectionAsync().catch(() => {});
    if (multi) {
      const arr = Array.isArray(selected) ? selected : [];
      onSelect(
        arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value],
      );
    } else {
      onSelect(value);
    }
  };

  return (
    <View style={styles.list}>
      {options.map((opt, i) => {
        const active = isSelected(opt.value);
        return (
          <Animated.View
            key={opt.value}
            entering={FadeInDown.duration(300).delay(i * 40)}
          >
            <TouchableOpacity
              onPress={() => handleSelect(opt.value)}
              activeOpacity={0.75}
              accessibilityRole={multi ? "checkbox" : "radio"}
              accessibilityState={{ checked: active }}
              accessibilityLabel={opt.label}
              style={[
                styles.row,
                {
                  backgroundColor: active
                    ? colors.brand.traceRed + "12"
                    : theme.card,
                  borderColor: active ? colors.brand.traceRed : theme.border,
                },
              ]}
            >
              <View style={[styles.iconChip, { backgroundColor: theme.muted }]}>
                <Text style={styles.icon}>{opt.icon}</Text>
              </View>
              <View style={styles.labelWrap}>
                <Text style={[styles.label, { color: theme.foreground }]}>
                  {opt.label}
                </Text>
                {!!opt.sub && (
                  <Text style={[styles.sub, { color: theme.mutedForeground }]}>
                    {opt.sub}
                  </Text>
                )}
              </View>
              {/* Square + tick for multi-select, circle + dot for single —
                  the shape is the affordance, and a row of circles on a
                  "pick all that apply" question reads as pick-one. */}
              <View
                style={[
                  styles.indicator,
                  multi ? styles.indicatorSquare : styles.indicatorRound,
                  {
                    borderColor: active ? colors.brand.traceRed : theme.border,
                    backgroundColor: active
                      ? colors.brand.traceRed
                      : "transparent",
                  },
                ]}
              >
                {active &&
                  (multi ? (
                    <Check size={15} color="#ffffff" strokeWidth={3.5} />
                  ) : (
                    <View style={styles.radioDot} />
                  ))}
              </View>
            </TouchableOpacity>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 14,
  },
  iconChip: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: { fontSize: 21 },
  labelWrap: { flex: 1 },
  label: { fontSize: 17, fontWeight: "600" },
  sub: { fontSize: 13, marginTop: 2 },
  indicator: {
    width: 26,
    height: 26,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  indicatorRound: { borderRadius: 13 },
  indicatorSquare: { borderRadius: 8 },
  radioDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#ffffff",
  },
});
