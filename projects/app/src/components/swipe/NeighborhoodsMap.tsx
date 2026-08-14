import React, { useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, useColorScheme } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import Mapbox, { MapView, Camera, MarkerView } from "@rnmapbox/maps";
import { MapPin, Sparkles } from "lucide-react-native";
import { colors } from "../../theme/colors";
import { extraString } from "../../lib/expoExtra";
import { DestinationInfo } from "../../lib/destinationData";

// Same guarded setAccessToken pattern as DealsMap.tsx — idempotent, so this
// is harmless if that module has already run it earlier in the session.
const MAPBOX_PUBLIC_TOKEN = extraString("mapboxPublicToken");
if (MAPBOX_PUBLIC_TOKEN) {
  Mapbox.setAccessToken(MAPBOX_PUBLIC_TOKEN);
}

const MAP_STYLE = "mapbox://styles/mapbox/streets-v12";
const MAP_HEIGHT = 220;
// Only used when there's nothing to fit bounds to (a single point, or all
// points essentially coincide) — otherwise the camera fits every pin into
// view instead of sitting at a fixed zoom that may crop half the city out.
const FALLBACK_ZOOM = 12.2;
const BOUNDS_PADDING = { paddingTop: 40, paddingBottom: 40, paddingLeft: 32, paddingRight: 32 };

type Point = {
  id: string;
  kind: "neighborhood" | "thingToDo";
  name: string;
  emoji: string;
  description: string;
  lat: number;
  lng: number;
};

interface Props {
  neighborhoods: DestinationInfo["neighborhoods"];
  thingsToDo: DestinationInfo["thingsToDo"];
}

// Self-contained: hides itself when there's nothing to plot, so callers can
// render it unconditionally. Content generated before the lat/lng schema
// bump (pre-_v2 cache docs) simply won't have coordinates yet — this map
// disappears rather than showing an empty frame until the cache expires.
export default function NeighborhoodsMap({ neighborhoods, thingsToDo }: Props) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const points = useMemo<Point[]>(() => {
    const hoods = neighborhoods
      .filter((n) => typeof n.lat === "number" && typeof n.lng === "number")
      .map((n) => ({
        id: `hood_${n.name}`,
        kind: "neighborhood" as const,
        name: n.name,
        emoji: n.emoji,
        description: n.description,
        lat: n.lat as number,
        lng: n.lng as number,
      }));
    const todo = thingsToDo
      .filter((t) => typeof t.lat === "number" && typeof t.lng === "number")
      .map((t) => ({
        id: `todo_${t.name}`,
        kind: "thingToDo" as const,
        name: t.name,
        emoji: t.emoji,
        description: t.description,
        lat: t.lat as number,
        lng: t.lng as number,
      }));
    return [...hoods, ...todo];
  }, [neighborhoods, thingsToDo]);

  const center = useMemo<[number, number] | null>(() => {
    if (!points.length) return null;
    const lat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
    const lng = points.reduce((sum, p) => sum + p.lng, 0) / points.length;
    return [lng, lat];
  }, [points]);

  // Fit the camera to every pin instead of a fixed zoom, so the whole city
  // (and every neighborhood/thing to do in it) is visible in one view.
  const bounds = useMemo(() => {
    if (points.length < 2) return null;
    const lats = points.map((p) => p.lat);
    const lngs = points.map((p) => p.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    // Points all essentially coincide — a near-zero-size box would just
    // zoom the camera in to its max level. Fall back to a fixed zoom.
    if (maxLat - minLat < 0.0005 && maxLng - minLng < 0.0005) return null;
    return {
      ne: [maxLng, maxLat] as [number, number],
      sw: [minLng, minLat] as [number, number],
      ...BOUNDS_PADDING,
    };
  }, [points]);

  if (!MAPBOX_PUBLIC_TOKEN || !center) return null;

  const selected = points.find((p) => p.id === selectedId) ?? null;
  // Same colors as the pins themselves, so the card visibly ties back to
  // whichever pin was just tapped instead of reading as generic/unrelated.
  const accent = selected?.kind === "thingToDo" ? colors.brand.amber500 : colors.brand.traceRed;

  return (
    <View style={{ gap: 10 }}>
      <View style={[styles.mapCard, { borderColor: theme.border }]}>
        <MapView
          style={StyleSheet.absoluteFillObject}
          styleURL={MAP_STYLE}
          scaleBarEnabled={false}
          compassEnabled={false}
          logoEnabled={false}
          attributionEnabled={false}
          onPress={() => setSelectedId(null)}
        >
          <Camera
            defaultSettings={
              bounds ? { bounds } : { centerCoordinate: center, zoomLevel: FALLBACK_ZOOM }
            }
          />
          {points.map((p) => (
            <MarkerView key={p.id} coordinate={[p.lng, p.lat]} allowOverlap anchor={{ x: 0.5, y: 0.5 }}>
              <Pressable
                onPress={() => setSelectedId(p.id === selectedId ? null : p.id)}
                hitSlop={8}
                style={[
                  styles.pin,
                  p.kind === "neighborhood" ? styles.pinNeighborhood : styles.pinTodo,
                  p.id === selectedId && styles.pinSelected,
                ]}
              >
                {p.kind === "neighborhood" ? (
                  <MapPin color="#fff" size={13} strokeWidth={2.5} />
                ) : (
                  <Sparkles color="#fff" size={12} strokeWidth={2.5} />
                )}
              </Pressable>
            </MarkerView>
          ))}
        </MapView>
      </View>
      {selected && (
        <Animated.View
          key={selected.id}
          entering={FadeIn.duration(180)}
          style={[
            styles.callout,
            { backgroundColor: accent + "14", borderColor: accent + "40", borderLeftColor: accent },
          ]}
        >
          <View style={styles.calloutHeader}>
            <View style={[styles.calloutIcon, { backgroundColor: accent }]}>
              {selected.kind === "neighborhood" ? (
                <MapPin color="#fff" size={12} strokeWidth={2.5} />
              ) : (
                <Sparkles color="#fff" size={12} strokeWidth={2.5} />
              )}
            </View>
            <Text style={[styles.calloutTitle, { color: accent }]}>
              {selected.emoji} {selected.name}
            </Text>
          </View>
          <Text style={[styles.calloutDesc, { color: theme.foreground }]}>
            {selected.description}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mapCard: {
    height: MAP_HEIGHT,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  pin: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  pinNeighborhood: { backgroundColor: colors.brand.traceRed },
  pinTodo: { backgroundColor: colors.brand.amber500 },
  // Meaningfully bigger + a bright halo ring, not just a subtle scale bump —
  // needs to read as "selected" at a glance on a small map, not just look
  // like a slightly-larger pin among many others.
  pinSelected: {
    transform: [{ scale: 1.45 }],
    borderWidth: 3,
    borderColor: "#ffffff",
    shadowOpacity: 0.55,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
    elevation: 10,
  },
  callout: {
    borderRadius: 14,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: 14,
    gap: 6,
  },
  calloutHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  calloutIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  calloutTitle: { fontSize: 14, fontWeight: "800", flex: 1 },
  calloutDesc: { fontSize: 13, lineHeight: 19 },
});
