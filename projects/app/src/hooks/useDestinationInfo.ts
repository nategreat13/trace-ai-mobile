import { useState, useEffect } from "react";
import { Deal } from "@trace/shared";
import { DestinationInfo } from "../lib/destinationData";
import { fetchDestinationInfo } from "../services/destinationApi";

const cache: Record<string, DestinationInfo> = {};
const inflight = new Set<string>();

function cacheKey(deal: Deal): string {
  return `${deal.destination_code}_${deal.domestic_or_international}_${deal.travel_window ?? "any"}`;
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

  useEffect(() => {
    if (!deal || !key) return;
    if (cache[key]) {
      setInfo(cache[key]);
      setLoading(false);
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
        inflight.delete(key);
        setInfo(data);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [key]);

  return { info, loading, error };
}
