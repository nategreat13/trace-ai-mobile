import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Deal } from "@trace/shared";
import { DestinationInfo } from "../lib/destinationData";
import { fetchDestinationInfo } from "../services/destinationApi";

// ─── In-memory cache (lives for the app session) ─────────────────────────────
const cache: Record<string, DestinationInfo> = {};
const inflight = new Set<string>();

// ─── AsyncStorage persistence (survives app restarts, 7-day TTL) ─────────────
const STORAGE_PREFIX = "trace_dest_v1_";
const STORAGE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type StoredEntry = { data: DestinationInfo; cachedAt: number };

async function readStorage(key: string): Promise<DestinationInfo | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const entry: StoredEntry = JSON.parse(raw);
    if (Date.now() - entry.cachedAt > STORAGE_TTL_MS) {
      AsyncStorage.removeItem(STORAGE_PREFIX + key).catch(() => {});
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

function writeStorage(key: string, data: DestinationInfo): void {
  const entry: StoredEntry = { data, cachedAt: Date.now() };
  AsyncStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(entry)).catch(() => {});
}

function clearStorage(key: string): void {
  AsyncStorage.removeItem(STORAGE_PREFIX + key).catch(() => {});
}

// ─── Cache key ────────────────────────────────────────────────────────────────
// Use destination NAME, not destination_code. The current deals API doesn't
// return airport codes for most flight deals, so building the key off
// `destination_code` produced "undefined_domestic_any" for nearly every deal.
function cacheKey(deal: Deal): string {
  const dest = (deal.destination ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";
  return `${dest}_${deal.domestic_or_international ?? "unknown"}_${deal.travel_window ?? "any"}`;
}

// ─── Prefetch ─────────────────────────────────────────────────────────────────
// Fire-and-forget: checks memory → AsyncStorage → network in order.
// Called from SwipeDeckScreen on card advance and from DashboardScreen on load.
export function prefetchDestinationInfo(deal: Deal | null): void {
  if (!deal) return;
  const key = cacheKey(deal);
  if (cache[key] || inflight.has(key)) return;
  inflight.add(key);

  readStorage(key)
    .then((stored) => {
      if (stored) {
        cache[key] = stored;
        inflight.delete(key);
        return;
      }
      return fetchDestinationInfo(deal)
        .then((data) => {
          cache[key] = data;
          writeStorage(key, data);
        })
        .catch(() => {})
        .finally(() => { inflight.delete(key); });
    })
    .catch(() => { inflight.delete(key); });
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useDestinationInfo(deal: Deal | null) {
  const key = deal ? cacheKey(deal) : null;

  const [info, setInfo] = useState<DestinationInfo | null>(
    key && cache[key] ? cache[key] : null
  );
  const [loading, setLoading] = useState(!!(key && !cache[key]));
  const [error, setError] = useState(false);
  // Bump to force a retry — keeps all fetch logic in one place.
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    if (!deal || !key) return;

    // 1. Memory hit → instant render, no async work needed.
    if (cache[key]) {
      setInfo(cache[key]);
      setLoading(false);
      setError(false);
      return;
    }

    let cancelled = false;
    setInfo(null);
    setLoading(true);
    setError(false);

    (async () => {
      try {
        // 2. AsyncStorage hit → populate memory cache, render immediately.
        //    Typical for destinations the user has opened before across sessions.
        const stored = await readStorage(key);
        if (cancelled) return;
        if (stored) {
          cache[key] = stored;
          setInfo(stored);
          setLoading(false);
          return;
        }

        // 3. Network fetch → write to both caches.
        const data = await fetchDestinationInfo(deal);
        if (cancelled) return;
        cache[key] = data;
        writeStorage(key, data);
        setInfo(data);
        setLoading(false);
      } catch {
        if (cancelled) return;
        setError(true);
        setLoading(false);
      } finally {
        inflight.delete(key);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, retryTick]);

  const refetch = useCallback(() => {
    if (key) {
      delete cache[key];
      clearStorage(key);
    }
    setRetryTick((t) => t + 1);
  }, [key]);

  return { info, loading, error, refetch };
}
