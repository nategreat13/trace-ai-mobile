import React, { useMemo, useRef } from "react";
import { View, Text, Pressable, StyleSheet, useColorScheme } from "react-native";
import Constants from "expo-constants";
import Mapbox, { MapView, Camera, MarkerView } from "@rnmapbox/maps";
import { colors } from "../../theme/colors";
import { coordsForDestination } from "../../lib/destinationCoords";
import type { Deal } from "@trace/shared";

/**
 * Public Mapbox token. Safe to ship — it lives inside the binary where any
 * user can extract it, which is how Mapbox is designed to work. The *secret*
 * download token is a separate thing and is injected at build time from the
 * MAPBOX_DOWNLOAD_TOKEN env var (see app.config.js).
 */
const MAPBOX_PUBLIC_TOKEN =
  (Constants.expoConfig?.extra as { mapboxPublicToken?: string } | undefined)
    ?.mapboxPublicToken ?? null;

// Module scope on purpose: setAccessToken is a global, one-time native
// call. Doing it in a component effect would re-fire on every mount.
if (MAPBOX_PUBLIC_TOKEN) {
  Mapbox.setAccessToken(MAPBOX_PUBLIC_TOKEN);
}

// Centred on the Atlantic at low zoom, so a US user sees home plus Europe
// and the Caribbean — where most deals are — without panning.
const INITIAL_CENTER: [number, number] = [-45, 30];
const INITIAL_ZOOM = 1.4;

export interface MapDeal {
  deal: Deal;
  /**
   * Free users only get a handful of unlocked deals in Explore; the rest
   * are blurred behind the paywall. Locked pins render as a lock rather
   * than a price — showing the price would hand over the exact thing the
   * paywall is selling, while still showing the pin keeps the map's "look
   * how much is out there" pull intact.
   */
  locked: boolean;
}

interface DealsMapProps {
  /**
   * Already filtered and deduped to one deal per destination by
   * ExploreScreen — the map deliberately does no filtering of its own so
   * the list and map always agree.
   */
  deals: MapDeal[];
  onSelectDeal: (deal: Deal) => void;
  onLockedPress: () => void;
}

interface Pin {
  deal: Deal;
  locked: boolean;
  lat: number;
  lng: number;
}

export default function DealsMap({ deals, onSelectDeal, onLockedPress }: DealsMapProps) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;
  const cameraRef = useRef<Camera>(null);

  const { pins, unmapped } = useMemo(() => {
    const out: Pin[] = [];
    let missing = 0;
    for (const { deal, locked } of deals) {
      const c = coordsForDestination(deal.destination);
      // No coordinates → no pin. Never fall back to a default position; a
      // deal pinned in the wrong place is worse than one that's absent.
      if (!c) {
        missing += 1;
        continue;
      }
      out.push({ deal, locked, lat: c.lat, lng: c.lng });
    }
    return { pins: out, unmapped: missing };
  }, [deals]);

  if (!MAPBOX_PUBLIC_TOKEN) {
    // Shouldn't happen in a real build, but a blank grey rectangle with no
    // explanation is a miserable thing to debug from a user report.
    return (
      <View style={[styles.fallback, { backgroundColor: theme.muted }]}>
        <Text style={[styles.fallbackText, { color: theme.mutedForeground }]}>
          Map unavailable — no Mapbox token configured for this build.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        style={StyleSheet.absoluteFillObject}
        styleURL={scheme === "dark" ? Mapbox.StyleURL.Dark : Mapbox.StyleURL.Light}
        // Mapbox's own chrome competes with the deal pins; attribution
        // stays on because Mapbox's terms require it.
        logoEnabled
        attributionEnabled
        scaleBarEnabled={false}
        compassEnabled={false}
      >
        <Camera
          ref={cameraRef}
          defaultSettings={{ centerCoordinate: INITIAL_CENTER, zoomLevel: INITIAL_ZOOM }}
        />

        {pins.map(({ deal, locked, lat, lng }) => (
          <MarkerView
            key={deal.id}
            coordinate={[lng, lat]}
            // Deals cluster tightly in Europe; without this only one pin per
            // neighbourhood would draw.
            allowOverlap
            anchor={{ x: 0.5, y: 1 }}
          >
            <Pressable
              onPress={() => (locked ? onLockedPress() : onSelectDeal(deal))}
              hitSlop={6}
              style={({ pressed }) => [
                styles.pin,
                locked
                  ? styles.pinLocked
                  : deal.is_business_class
                    ? styles.pinBusiness
                    : styles.pinStandard,
                pressed && styles.pinPressed,
              ]}
            >
              <Text style={locked ? styles.pinLockGlyph : styles.pinPrice} numberOfLines={1}>
                {locked ? "🔒" : `$${deal.price}`}
              </Text>
            </Pressable>
          </MarkerView>
        ))}
      </MapView>

      {unmapped > 0 && (
        // Surfaced rather than silent: a destination the coordinate table
        // doesn't know about is invisible on the map, and we'd otherwise
        // never find out. See destinationCoords.ts to add one.
        <View style={styles.unmappedNote} pointerEvents="none">
          <Text style={styles.unmappedText}>
            {unmapped} {unmapped === 1 ? "deal" : "deals"} not shown on map
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: "hidden",
  },
  pin: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.85)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  pinStandard: {
    backgroundColor: colors.brand.traceRed,
  },
  pinBusiness: {
    backgroundColor: colors.brand.amber500,
  },
  pinLocked: {
    // Deliberately recessive — locked pins should read as "there's more
    // here" without competing with the deals the user can actually open.
    backgroundColor: "rgba(30,30,38,0.82)",
    borderColor: "rgba(255,255,255,0.5)",
    paddingHorizontal: 7,
  },
  pinPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.94 }],
  },
  pinLockGlyph: {
    fontSize: 11,
  },
  pinPrice: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },
  fallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  fallbackText: {
    fontSize: 14,
    textAlign: "center",
  },
  unmappedNote: {
    position: "absolute",
    top: 12,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  unmappedText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
});
