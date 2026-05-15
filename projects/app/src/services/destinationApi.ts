import { Deal } from "@trace/shared";
import { API_BASE_URL } from "../lib/constants";
import { DestinationInfo } from "../lib/destinationData";

const MONTH_NAMES: Record<string, string> = {
  jan: "january", feb: "february", mar: "march", apr: "april",
  may: "may", jun: "june", jul: "july", aug: "august",
  sep: "september", oct: "october", nov: "november", dec: "december",
  january: "january", february: "february", march: "march", april: "april",
  june: "june", july: "july", august: "august", september: "september",
  october: "october", november: "november", december: "december",
};

function extractMonth(travelWindow: string | undefined): string {
  if (!travelWindow) return "any";
  const lower = travelWindow.toLowerCase().trim();
  const firstWord = lower.split(/[\s\-\/]/)[0].replace(/\./g, "").trim();
  return MONTH_NAMES[firstWord] ?? "any";
}

/**
 * Slugify a destination name for use as a stable cache-key path segment
 * when the deal has no `destination_code`. The server reads `destination`
 * from the query string for the actual prompt; the path is only used to
 * key the Firestore cache. So as long as the slug is deterministic per
 * city, it produces correct unique caches.
 *
 * Without this fallback, code-less deals pass the literal string
 * "undefined" as the path segment, which collapses every such deal into
 * the same cache entry (UNDEFINED_*) — every destination tab would show
 * the same guide. Most deals from the current API don't carry an airport
 * code at all, so this is the common case, not the edge case.
 */
function destinationKey(deal: Deal): string {
  if (deal.destination_code) return deal.destination_code;
  const slug = (deal.destination ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "unknown";
}

/**
 * Fetch destination info from the Cloud Function. Throws on any failure
 * so the caller's error state actually triggers.
 *
 * History: this used to silently fall back to a hardcoded MOCK_DATA
 * object on any error, which meant every destination guide failure
 * looked like a successful response showing identical generic content.
 * Trevor saw this for San Francisco — the server timed out at 60s on
 * the Anthropic call (Cloud Run killed the request), the catch
 * swallowed the network error, and the user saw a generic guide that
 * was actually written about a fictional city. Worse than a clean
 * error: the user has no idea anything went wrong.
 *
 * Now: any non-2xx response or network failure throws. The hook
 * (`useDestinationInfo`) sets `error: true` and the UI shows a retry
 * button. If we want a real fallback later, it should be intentional
 * AND distinguishable from real content (e.g. a banner saying "We
 * couldn't load specific tips for this destination").
 */
export async function fetchDestinationInfo(deal: Deal): Promise<DestinationInfo> {
  const isDomestic = deal.domestic_or_international?.toLowerCase() === "domestic";
  const month = extractMonth(deal.travel_window || deal.dateString);
  const params = new URLSearchParams({
    destination: deal.destination,
    domestic: String(isDomestic),
    month,
  });
  const url = `${API_BASE_URL}/destination-info/${encodeURIComponent(destinationKey(deal))}?${params}`;

  const response = await fetch(url);
  if (!response.ok) {
    // Server returns 504 specifically for AbortController timeouts
    // (see projects/server/src/routes/destination-info.ts). Surface
    // the distinction in the error message in case the caller wants
    // to render different copy for retryable timeouts vs. real
    // generation failures.
    const kind = response.status === 504 ? "timeout" : `http_${response.status}`;
    throw new Error(`destination-info ${kind} for ${deal.destination}`);
  }
  return response.json();
}
