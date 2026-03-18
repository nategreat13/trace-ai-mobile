import { API_BASE_URL } from "../lib/constants";
import { mapApiDealToLocal, mapApiPremiumDealToLocal } from "../lib/dealMapper";
import { Deal } from "@trace/shared";

export async function fetchDeals(airportCode: string): Promise<Deal[]> {
  const response = await fetch(
    `${API_BASE_URL}/deals/${airportCode}?limit=500`,
  );
  if (!response.ok) throw new Error("Failed to fetch deals");
  const json = await response.json();
  const apiDeals = Array.isArray(json) ? json : json.deals || [];
  return apiDeals.map(mapApiDealToLocal);
}

export async function fetchPremiumDeals(airportCode: string): Promise<Deal[]> {
  const response = await fetch(
    `${API_BASE_URL}/premium-deals/${airportCode}`,
  );
  if (!response.ok) throw new Error("Failed to fetch premium deals");
  const json = await response.json();
  const apiDeals = Array.isArray(json) ? json : json.deals || [];
  return apiDeals.map(mapApiPremiumDealToLocal);
}
