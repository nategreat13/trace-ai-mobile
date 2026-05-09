import { useState, useEffect } from "react";
import { Deal } from "@trace/shared";
import { DestinationInfo } from "../lib/destinationData";
import { fetchDestinationInfo } from "../services/destinationApi";

const cache: Record<string, DestinationInfo> = {};

export function useDestinationInfo(deal: Deal | null) {
  const cacheKey = deal
    ? `${deal.destination_code}_${deal.domestic_or_international}_${deal.travel_window ?? "any"}`
    : null;

  const [info, setInfo] = useState<DestinationInfo | null>(
    cacheKey && cache[cacheKey] ? cache[cacheKey] : null
  );
  const [loading, setLoading] = useState(!!(cacheKey && !cache[cacheKey]));
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!deal || !cacheKey) return;
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
