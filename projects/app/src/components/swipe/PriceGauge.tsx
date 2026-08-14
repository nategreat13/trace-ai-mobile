import React, { useState } from "react";
import { View, Text, StyleSheet, LayoutChangeEvent } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

interface PriceGaugeProps {
  price: number;
  originalPrice: number;
  discountPct: number;
  foreground: string;
  mutedForeground: string;
}

// Reference ("typical") price sits at a fixed point near the pricier end of
// the bar; the deal-price marker slides left toward green the bigger the
// discount is. There's no independent "typical market price" in the data —
// original_price (this deal's own pre-discount price) is the only reference
// point available, so it doubles as the typical-price anchor.
const TYPICAL_POSITION = 0.85;
// Discount size beyond which the deal marker is pinned at the far-green end.
// Matches the existing "Hot Deal" tier (>=40%) landing solidly in the green,
// "Good Deal" (>=20%) landing in the amber, and anything under that reading
// close to typical.
const MAX_SCALE_DISCOUNT = 80;

export default function PriceGauge({
  price,
  originalPrice,
  discountPct,
  foreground,
  mutedForeground,
}: PriceGaugeProps) {
  const hasDiscount = originalPrice > price && discountPct > 0;
  const clampedDiscount = Math.max(0, Math.min(discountPct, MAX_SCALE_DISCOUNT));
  const dealPosition = hasDiscount
    ? TYPICAL_POSITION * (1 - clampedDiscount / MAX_SCALE_DISCOUNT)
    : TYPICAL_POSITION;

  // React Native's `transform` doesn't support percentage values (no
  // translateX(-50%) like CSS), so centering a label under an X% marker
  // needs actual measured widths, not a flex-ratio approximation — flex
  // shares only line up with dealPosition when the label has ~zero width,
  // and get worse the closer dealPosition is to the middle/right of the bar.
  const [rowWidth, setRowWidth] = useState(0);
  const [labelWidth, setLabelWidth] = useState(0);
  const measured = rowWidth > 0 && labelWidth > 0;
  const labelLeft = measured ? dealPosition * rowWidth - labelWidth / 2 : 0;

  return (
    <View style={styles.container}>
      <View style={styles.track}>
        <LinearGradient
          colors={["#22c55e", "#f59e0b", "#ef4444"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFillObject}
        />
        {hasDiscount && (
          <View
            style={[
              styles.marker,
              styles.markerMuted,
              { left: `${TYPICAL_POSITION * 100}%`, backgroundColor: mutedForeground },
            ]}
          />
        )}
        <View style={[styles.marker, { left: `${dealPosition * 100}%`, backgroundColor: foreground }]} />
      </View>
      <View style={styles.labelRow} onLayout={(e: LayoutChangeEvent) => setRowWidth(e.nativeEvent.layout.width)}>
        <Text
          style={[
            styles.labelText,
            { color: foreground, left: labelLeft, opacity: measured ? 1 : 0 },
          ]}
          numberOfLines={1}
          onLayout={(e: LayoutChangeEvent) => setLabelWidth(e.nativeEvent.layout.width)}
        >
          This deal · ${price}
        </Text>
        {hasDiscount && (
          <Text style={[styles.labelTextMuted, { color: mutedForeground }]} numberOfLines={1}>
            Typical · ${originalPrice}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  track: {
    height: 6,
    borderRadius: 3,
    overflow: "visible",
  },
  marker: {
    position: "absolute",
    top: -3,
    width: 3,
    height: 12,
    borderRadius: 1.5,
    marginLeft: -1.5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
  },
  markerMuted: {
    height: 6,
    top: 0,
  },
  labelRow: {
    // `labelText` is absolutely positioned so it can land at an exact
    // pixel offset — a plain flex row would collapse to 0 height with only
    // absolutely-positioned children, so this needs an explicit height.
    height: 15,
    marginTop: 6,
  },
  labelText: {
    position: "absolute",
    top: 0,
    fontSize: 11,
    fontWeight: "700",
  },
  labelTextMuted: {
    position: "absolute",
    top: 0,
    right: 0,
    fontSize: 11,
    fontWeight: "600",
  },
});
