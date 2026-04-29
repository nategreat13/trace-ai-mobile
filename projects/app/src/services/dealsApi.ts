import { API_BASE_URL } from "../lib/constants";
import { mapApiDealToLocal, mapApiPremiumDealToLocal } from "../lib/dealMapper";
import { Deal } from "@trace/shared";

// Images that override whatever the API returns (e.g. hotlink-blocked URLs)
const IMAGE_OVERRIDES: Record<string, string> = {
  "phoenix": "https://edgeplumbingllc.com/wp-content/uploads/2025/09/683a4e53cca84f4da811a40b_Phoenix-cityscape_b2b0b89039603b931027eb2900b66531.jpg",
};

function patchImages(deals: Deal[]): Deal[] {
  return deals.map((d) => {
    const override = IMAGE_OVERRIDES[d.destination?.toLowerCase()];
    if (override) return { ...d, image_url: override };
    return d;
  });
}

export async function fetchDeals(airportCode: string): Promise<Deal[]> {
  const response = await fetch(
    `${API_BASE_URL}/deals/${airportCode}?limit=500`,
  );
  if (!response.ok) throw new Error("Failed to fetch deals");
  const json = await response.json();
  const apiDeals = Array.isArray(json) ? json : json.deals || [];
  return patchImages(apiDeals.map(mapApiDealToLocal));
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
