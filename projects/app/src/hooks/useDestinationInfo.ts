import { useCallback, useEffect, useState } from "react";
import { Deal } from "@trace/shared";
import { DestinationInfo } from "../lib/destinationData";
import { fetchDestinationInfo } from "../services/destinationApi";

const cache: Record<string, DestinationInfo> = {};
const inflight = new Set<string>();

function cacheKey(deal: Deal): string {
  // Use destination NAME, not destination_code. The current deals API
  // doesn't return airport codes for most flight deals (the field is
  // declared in the Deal type but the data is missing), so building
  // the cache key off `deal.destination_code` produced
  // "undefined_domestic_any" for nearly every deal. First city
  // opened got cached under that key; every subsequent open returned
  // the first city's content — visible especially in Explore where
  // users flip between many destinations quickly.
  //
  // Slugifying the city name (matching destinationApi's destinationKey)
  // gives a stable, unique key per destination + travel window.
  const dest = (deal.destination ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";
  return `${dest}_${deal.domestic_or_international ?? "unknown"}_${deal.travel_window ?? "any"}`;
}

export function prefetchDestinationInfo(deal: Deal | null): void {
  if (!deal) return;
  const key = cacheKey(deal);
  if (cache[key] || inflight.has(key)) return;
  inflight.add(key);
  fetchDestinationInfo(deal)
    .then((data) => { cache[key] = data; })
    .catch(() => {})
    .finally(() => { inflight.delete(key); });
}

export function useDestinationInfo(deal: Deal | null) {
  const key = deal ? cacheKey(deal) : null;

  const [info, setInfo] = useState<DestinationInfo | null>(
    key && cache[key] ? cache[key] : null
  );
  const [loading, setLoading] = useState(!!(key && !cache[key]));
  const [error, setError] = useState(false);
  // Bump this to force the effect to re-run for a manual retry. Done
  // via a counter rather than calling fetch directly so the rest of
  // the hook (cache lookup, cancellation, loading state) stays in
  // one place.
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    if (!deal || !key) return;
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

    fetchDestinationInfo(deal)
      .then((data) => {
        if (cancelled) return;
        cache[key] = data;
        setInfo(data);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setLoading(false);
      })
      .finally(() => {
        // Always release the inflight guard so a retry isn't blocked
        // by a previous failed prefetch leaving its key set.
        inflight.delete(key);
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, retryTick]);

  /**
   * Drop any cached value for this key and re-trigger the fetch.
   * Used by the destination tab's Retry button when a previous
   * attempt errored.
   */
  const refetch = useCallback(() => {
    if (key) delete cache[key];
    setRetryTick((t) => t + 1);
  }, [key]);

  return { info, loading, error, refetch };
}
