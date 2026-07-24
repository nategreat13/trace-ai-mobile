import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, useColorScheme } from "react-native";
import { Image } from "expo-image";
import Constants from "expo-constants";
import Mapbox, { MapView, Camera, MarkerView } from "@rnmapbox/maps";
import { Lock, ArrowRight, Bell, Bookmark, BookmarkCheck } from "lucide-react-native";
import { colors } from "../../theme/colors";
import { coordsForDestination, lookupKey } from "../../lib/destinationCoords";
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

if (MAPBOX_PUBLIC_TOKEN) {
  Mapbox.setAccessToken(MAPBOX_PUBLIC_TOKEN);
}

// A colourful vector style, deliberately NOT the monochrome Light/Dark base
// styles — this is a "look at the whole world" travel map.
const MAP_STYLE = "mapbox://styles/mapbox/streets-v12";

// Default view: anchored on the Americas but zoomed out enough to catch
// the Atlantic and western Europe, so both the unlocked domestic pins and
// some aspirational international/locked ones are visible without panning —
// which is exactly what makes the upsell land. Not the full disorienting
// globe, not just the US.
const INITIAL_CENTER: [number, number] = [-55, 30];
const INITIAL_ZOOM = 2.2;
const SEARCH_ZOOM = 4.4;

// How many locked deals to pin as lock-badge teasers. Not all of them (a
// wall of locks was "too much"), but enough to make the upsell visible.
// Tunable — purely a visual-density knob.
const LOCKED_PREVIEW_COUNT = 30;

// Sentinel selectedId meaning "the alert pin is open", not a deal.
const ALERT_ID = "__alert__";

export interface MapDeal {
  deal: Deal;
  /**
   * Whether this deal is locked for the current (free) user. Locked deals
   * still pin and still open a preview — but the preview hides the price
   * and shows an unlock CTA. Only a capped sample is pinned; the rest are
   * summarised in the banner.
   */
  locked: boolean;
}

interface DealsMapProps {
  deals: MapDeal[];
  /** Open the full detail sheet — unlocked deals only. */
  onSelectDeal: (deal: Deal) => void;
  /** Save an unlocked deal (handles the free save-limit paywall itself). */
  onSaveDeal: (deal: Deal) => void;
  /** Deal ids already saved, for the bookmark toggle state. */
  savedDealIds: Set<string>;
  /** Go to the paywall — from a locked preview's unlock CTA or the banner. */
  onLockedPress: () => void;
  /**
   * Destination the user searched/selected in Explore. The map flies there;
   * if a deal exists it's selected, otherwise an alert pin is dropped.
   */
  searchTarget: string | null;
  /** Create (or upsell) a deal alert for a destination we don't serve yet. */
  onRequestAlert: (destination: string) => void;
}

interface Pin {
  deal: Deal;
  locked: boolean;
  lat: number;
  lng: number;
}

/** Forward-geocode an arbitrary place name to [lng, lat] via Mapbox. */
async function geocode(query: string): Promise<[number, number] | null> {
  if (!MAPBOX_PUBLIC_TOKEN) return null;
  try {
    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
      `?access_token=${MAPBOX_PUBLIC_TOKEN}&limit=1&types=place,locality,region,country`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const c = json?.features?.[0]?.center;
    return Array.isArray(c) && c.length === 2 ? [c[0], c[1]] : null;
  } catch {
    return null;
  }
}

export default function DealsMap({
  deals,
  onSelectDeal,
  onSaveDeal,
  savedDealIds,
  onLockedPress,
  searchTarget,
  onRequestAlert,
}: DealsMapProps) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;
  const cameraRef = useRef<Camera>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [alertPin, setAlertPin] = useState<{ name: string; lng: number; lat: number } | null>(null);

  const { unlocked, locked, unmapped } = useMemo(() => {
    const u: Pin[] = [];
    const l: Pin[] = [];
    let missing = 0;
    for (const { deal, locked } of deals) {
      const c = coordsForDestination(deal.destination);
      if (!c) {
        missing += 1;
        continue;
      }
      (locked ? l : u).push({ deal, locked, lat: c.lat, lng: c.lng });
    }
    return { unlocked: u, locked: l, unmapped: missing };
  }, [deals]);

  // Capped, geographically-spread sample of locked deals to pin.
  const lockedSample = useMemo(() => {
    const half = Math.ceil(LOCKED_PREVIEW_COUNT / 2);
    const isDomestic = (p: Pin) =>
      p.deal.domestic_or_international?.toLowerCase().includes("domestic");
    const domestic = locked.filter(isDomestic);
    const international = locked.filter((p) => !isDomestic(p));
    const picks = [...domestic.slice(0, half), ...international.slice(0, half)];
    if (picks.length < LOCKED_PREVIEW_COUNT) {
      const chosen = new Set(picks.map((p) => p.deal.id));
      picks.push(...locked.filter((p) => !chosen.has(p.deal.id)));
    }
    return picks.slice(0, LOCKED_PREVIEW_COUNT);
  }, [locked]);

  // Ensure a selected locked deal is always rendered even if it fell outside
  // the sample (e.g. selected via search).
  const lockedToRender = useMemo(() => {
    if (!selectedId || lockedSample.some((p) => p.deal.id === selectedId)) return lockedSample;
    const extra = locked.find((p) => p.deal.id === selectedId);
    return extra ? [...lockedSample, extra] : lockedSample;
  }, [lockedSample, locked, selectedId]);

  const selectedPin = useMemo(
    () => [...unlocked, ...locked].find((p) => p.deal.id === selectedId) ?? null,
    [unlocked, locked, selectedId]
  );

  // Search → fly the camera, and either select the matching deal or drop an
  // alert pin where we have nothing to offer yet.
  useEffect(() => {
    if (!searchTarget) {
      setAlertPin(null);
      return;
    }
    let cancelled = false;
    const key = lookupKey(searchTarget);
    const match = [...unlocked, ...locked].find((p) => lookupKey(p.deal.destination) === key);
    if (match) {
      cameraRef.current?.setCamera({
        centerCoordinate: [match.lng, match.lat],
        zoomLevel: SEARCH_ZOOM,
        animationDuration: 1200,
      });
      setAlertPin(null);
      setSelectedId(match.deal.id);
      return;
    }
    // No deal for this place — resolve coords (local table, else geocode)
    // and drop an alert pin the user can tap to request alerts.
    (async () => {
      const local = coordsForDestination(searchTarget);
      const lnglat: [number, number] | null = local
        ? [local.lng, local.lat]
        : await geocode(searchTarget);
      if (cancelled || !lnglat) return;
      cameraRef.current?.setCamera({
        centerCoordinate: lnglat,
        zoomLevel: SEARCH_ZOOM,
        animationDuration: 1200,
      });
      setAlertPin({ name: searchTarget, lng: lnglat[0], lat: lnglat[1] });
      setSelectedId(ALERT_ID);
    })();
    return () => {
      cancelled = true;
    };
  }, [searchTarget, unlocked, locked]);

  if (!MAPBOX_PUBLIC_TOKEN) {
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
        styleURL={MAP_STYLE}
        scaleBarEnabled={false}
        compassEnabled={false}
        logoEnabled={false}
        attributionEnabled={false}
        onPress={() => setSelectedId(null)}
      >
        <Camera
          ref={cameraRef}
          defaultSettings={{ centerCoordinate: INITIAL_CENTER, zoomLevel: INITIAL_ZOOM }}
        />

        {/* Locked teaser pins (drawn under the price tags). */}
        {lockedToRender.map(({ deal, lat, lng }) => {
          const selected = deal.id === selectedId;
          return (
            <MarkerView key={deal.id} coordinate={[lng, lat]} allowOverlap anchor={{ x: 0.5, y: 0.5 }}>
              <Pressable
                onPress={() => setSelectedId(selected ? null : deal.id)}
                hitSlop={8}
                style={[styles.lockedPin, selected && styles.lockedPinSelected]}
              >
                <Lock size={11} color="#fff" strokeWidth={2.5} />
              </Pressable>
            </MarkerView>
          );
        })}

        {/* Unlocked deals: vibrant price tags. */}
        {unlocked.map(({ deal, lat, lng }) => {
          const selected = deal.id === selectedId;
          const business = deal.is_business_class;
          return (
            <MarkerView
              key={deal.id}
              coordinate={[lng, lat]}
              allowOverlap
              anchor={{ x: 0.5, y: 1 }}
              isSelected={selected}
            >
              <Pressable
                onPress={() => setSelectedId(selected ? null : deal.id)}
                hitSlop={4}
                style={styles.tagWrap}
              >
                <View
                  style={[
                    styles.priceTag,
                    business ? styles.priceTagBusiness : styles.priceTagStandard,
                    selected && styles.priceTagSelected,
                  ]}
                >
                  <Text style={styles.priceText}>${deal.price}</Text>
                </View>
                <View
                  style={[
                    styles.tail,
                    { borderTopColor: business ? colors.brand.amber500 : colors.brand.traceRed },
                  ]}
                />
              </Pressable>
            </MarkerView>
          );
        })}

        {/* Alert pin — a searched place we don't serve yet. */}
        {alertPin && (
          <MarkerView coordinate={[alertPin.lng, alertPin.lat]} allowOverlap anchor={{ x: 0.5, y: 1 }}>
            <Pressable onPress={() => setSelectedId(ALERT_ID)} hitSlop={6} style={styles.tagWrap}>
              <View style={styles.alertPin}>
                <Bell size={14} color="#fff" strokeWidth={2.5} />
              </View>
              <View style={[styles.tail, { borderTopColor: colors.brand.tracePink }]} />
            </Pressable>
          </MarkerView>
        )}
      </MapView>

      {/* Locked-count upsell banner. */}
      {locked.length > 0 && (
        <Pressable onPress={onLockedPress} style={[styles.lockedBanner, { top: 12 }]}>
          <Lock size={13} color="#fff" />
          <Text style={styles.lockedBannerText}>
            {locked.length} more {locked.length === 1 ? "deal" : "deals"} with Premium
          </Text>
          <ArrowRight size={14} color="#fff" />
        </Pressable>
      )}

      {unmapped > 0 && (
        <View style={[styles.unmappedNote, { top: locked.length > 0 ? 54 : 12 }]} pointerEvents="none">
          <Text style={styles.unmappedText}>{unmapped} not shown</Text>
        </View>
      )}

      {/* Alert card — offer to get notified for a place we don't serve. */}
      {selectedId === ALERT_ID && alertPin && (
        <View style={[styles.previewCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.alertIconWrap}>
            <Bell size={22} color="#fff" strokeWidth={2.5} />
          </View>
          <View style={styles.previewBody}>
            <Text style={[styles.previewDest, { color: theme.foreground }]} numberOfLines={1}>
              No deals to {alertPin.name} yet
            </Text>
            <Text style={[styles.alertSub, { color: theme.mutedForeground }]} numberOfLines={2}>
              Get alerted the moment one drops.
            </Text>
          </View>
          <Pressable
            onPress={() => onRequestAlert(alertPin.name)}
            style={styles.previewCta}
            accessibilityRole="button"
            accessibilityLabel={`Get alerts for ${alertPin.name}`}
          >
            <Bell size={18} color="#fff" />
          </Pressable>
        </View>
      )}

      {/* Deal preview card — locked variant hides the price. For unlocked
          deals, tapping the card opens the full deal; the bookmark saves it. */}
      {selectedPin && (
        <View style={[styles.previewCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Pressable
            style={styles.previewMain}
            onPress={() => !selectedPin.locked && onSelectDeal(selectedPin.deal)}
            disabled={selectedPin.locked}
            accessibilityRole="button"
            accessibilityLabel={`View ${selectedPin.deal.destination} deal`}
          >
            <Image
              source={{ uri: selectedPin.deal.image_url }}
              style={styles.previewImage}
              contentFit="cover"
            />
            <View style={styles.previewBody}>
              <Text style={[styles.previewDest, { color: theme.foreground }]} numberOfLines={1}>
                {selectedPin.deal.destination}
              </Text>
              {selectedPin.locked ? (
                <View style={styles.previewPriceRow}>
                  <Lock size={13} color={theme.mutedForeground} />
                  <Text style={[styles.lockedPriceText, { color: theme.mutedForeground }]}>
                    Price locked
                  </Text>
                </View>
              ) : (
                <View style={styles.previewPriceRow}>
                  <Text style={[styles.previewPrice, { color: theme.foreground }]}>
                    ${selectedPin.deal.price}
                  </Text>
                  {selectedPin.deal.discount_pct ? (
                    <View style={styles.previewDiscount}>
                      <Text style={styles.previewDiscountText}>
                        {selectedPin.deal.discount_pct}% off
                      </Text>
                    </View>
                  ) : null}
                </View>
              )}
            </View>
          </Pressable>
          {selectedPin.locked ? (
            <Pressable
              onPress={onLockedPress}
              style={styles.previewCtaLocked}
              accessibilityRole="button"
              accessibilityLabel={`Unlock ${selectedPin.deal.destination}`}
            >
              <Lock size={16} color="#fff" />
              <Text style={styles.previewCtaLockedText}>Unlock</Text>
            </Pressable>
          ) : (
            <View style={styles.previewActions}>
              <Pressable
                onPress={() => onSaveDeal(selectedPin.deal)}
                style={[styles.previewIconBtn, { borderColor: theme.border }]}
                accessibilityRole="button"
                accessibilityLabel={
                  savedDealIds.has(selectedPin.deal.id)
                    ? `${selectedPin.deal.destination} saved`
                    : `Save ${selectedPin.deal.destination}`
                }
              >
                {savedDealIds.has(selectedPin.deal.id) ? (
                  <BookmarkCheck size={20} color={colors.brand.traceRed} />
                ) : (
                  <Bookmark size={20} color={theme.foreground} />
                )}
              </Pressable>
              <Pressable
                onPress={() => onSelectDeal(selectedPin.deal)}
                style={styles.previewCta}
                accessibilityRole="button"
                accessibilityLabel={`View ${selectedPin.deal.destination} deal`}
              >
                <ArrowRight size={18} color="#fff" />
              </Pressable>
            </View>
          )}
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
  // — locked teaser pins —
  lockedPin: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(20,20,26,0.78)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  lockedPinSelected: {
    backgroundColor: colors.brand.traceRed,
    transform: [{ scale: 1.15 }],
  },
  // — unlocked price tags —
  tagWrap: {
    alignItems: "center",
  },
  priceTag: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 5,
  },
  priceTagStandard: {
    backgroundColor: colors.brand.traceRed,
  },
  priceTagBusiness: {
    backgroundColor: colors.brand.amber500,
  },
  priceTagSelected: {
    transform: [{ scale: 1.15 }],
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  priceText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
  },
  tail: {
    width: 0,
    height: 0,
    marginTop: -1,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 6,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
  // — alert pin —
  alertPin: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.brand.tracePink,
    borderWidth: 2,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
  },
  // — banner + notes —
  lockedBanner: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(20,20,26,0.9)",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  lockedBannerText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  unmappedNote: {
    position: "absolute",
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  unmappedText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
  },
  // — preview / alert cards —
  previewCard: {
    position: "absolute",
    left: 12,
    right: 12,
    // Sits above the "swipe up for list" handle that ExploreScreen overlays
    // at the very bottom in map mode, so the two never collide.
    bottom: 72,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    padding: 10,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 10,
  },
  previewMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  previewImage: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.06)",
  },
  previewActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  previewIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  alertIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.brand.tracePink,
    alignItems: "center",
    justifyContent: "center",
  },
  previewBody: {
    flex: 1,
  },
  previewDest: {
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 4,
  },
  alertSub: {
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 16,
  },
  previewPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  previewPrice: {
    fontSize: 16,
    fontWeight: "900",
  },
  lockedPriceText: {
    fontSize: 13,
    fontWeight: "700",
  },
  previewDiscount: {
    backgroundColor: "rgba(34,197,94,0.15)",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  previewDiscountText: {
    color: "#16a34a",
    fontSize: 11,
    fontWeight: "800",
  },
  previewCta: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brand.traceRed,
    alignItems: "center",
    justifyContent: "center",
  },
  previewCtaLocked: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    backgroundColor: colors.brand.traceRed,
  },
  previewCtaLockedText: {
    color: "#fff",
    fontSize: 14,
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
});
