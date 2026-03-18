import { DEALS_API_BASE, DEALS_API_KEY } from "../lib/constants";
import { mapApiDealToLocal, mapApiPremiumDealToLocal } from "../lib/dealMapper";
import { Deal } from "@trace/shared";

export async function fetchDeals(airportCode: string): Promise<Deal[]> {
  const response = await fetch(
    `${DEALS_API_BASE}/deals/${airportCode}?limit=500`,
    { headers: { "x-api-key": DEALS_API_KEY } }
  );
  if (!response.ok) throw new Error("Failed to fetch deals");
  const json = await response.json();
  const apiDeals = Array.isArray(json) ? json : json.deals || [];
  return apiDeals.map(mapApiDealToLocal);
}

export async function fetchPremiumDeals(airportCode: string): Promise<Deal[]> {
  const response = await fetch(
    `${DEALS_API_BASE}/premium-deals/${airportCode}`,
    { headers: { "x-api-key": DEALS_API_KEY } }
  );
  if (!response.ok) throw new Error("Failed to fetch premium deals");
  const json = await response.json();
  const apiDeals = Array.isArray(json) ? json : json.deals || [];
  return apiDeals.map(mapApiPremiumDealToLocal);
}
