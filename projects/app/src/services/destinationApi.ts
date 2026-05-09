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

export async function fetchDestinationInfo(deal: Deal): Promise<DestinationInfo> {
  const isDomestic = deal.domestic_or_international?.toLowerCase() === "domestic";
  const month = extractMonth(deal.travel_window || deal.dateString);
  const params = new URLSearchParams({
    destination: deal.destination,
    domestic: String(isDomestic),
    month,
  });
  const response = await fetch(
    `${API_BASE_URL}/destination-info/${deal.destination_code}?${params}`
  );
  if (!response.ok) throw new Error("Failed to fetch destination info");
  return response.json();
}
