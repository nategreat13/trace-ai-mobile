import { useState, useEffect } from "react";
import { Deal } from "@trace/shared";
import { DestinationInfo } from "../lib/destinationData";
import { fetchDestinationInfo } from "../services/destinationApi";

// In-memory cache so re-opening the same deal doesn't re-fetch
const cache: Record<string, DestinationInfo> = {};

export function useDestinationInfo(deal: Deal) {
  const cacheKey = `${deal.destination_code}_${deal.domestic_or_international}`;

  const [info, setInfo] = useState<DestinationInfo | null>(cache[cacheKey] ?? null);
  const [loading, setLoading] = useState(!cache[cacheKey]);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (cache[cacheKey]) return;

    let cancelled = false;
    setLoading(true);
    setError(false);

    fetchDestinationInfo(deal)
      .then((data) => {
        if (cancelled) return;
        cache[cacheKey] = data;
        setInfo(data);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [cacheKey]);

  return { info, loading, error };
}
