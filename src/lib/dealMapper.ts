import { Deal } from "../types/deal";

function mapApiTypeToOurType(apiTypeString: string | undefined): string | null {
  if (!apiTypeString) return null;
  const lower = apiTypeString.toLowerCase();
  if (lower.includes("family-friendly")) return "family";
  if (lower.includes("budget-friendly") || lower.includes("budget friendly trips") || lower.includes("budget")) return "budget";
  if (lower.includes("luxury")) return "luxury";
  if (lower.includes("adventure") || lower.includes("outdoor")) return "adventure";
  if (lower.includes("cultural") || lower.includes("historical")) return "cultural";
  if (lower.includes("relaxation") || lower.includes("resort")) return "relaxation";
  return null;
}

export function mapApiDealToLocal(deal: any): Deal {
  const price = parseFloat(
    deal.dealPriceUSD || deal.price || deal.currentPrice || deal.salePrice || deal.dealPrice || 0
  );
  const original_price = parseFloat(
    deal.normalPriceUSD || deal.originalPrice || deal.original_price || deal.regularPrice || deal.normalPrice || 0
  );
  let discount_pct = parseFloat(
    deal.discountPercent || deal.discount_pct || deal.savings || deal.discountPercentage || 0
  );
  if (original_price && price && !discount_pct) {
    discount_pct = Math.round(((original_price - price) / original_price) * 100);
  }

  return {
    id: deal.id || deal.dealId || deal._id,
    destination: deal.destination || deal.city || deal.destinationCity,
    destination_code: deal.destinationCode || deal.destination_code || deal.airportCode || deal.toAirport,
    origin: deal.origin,
    price,
    original_price,
    discount_pct,
    travel_window: deal.dateString,
    dateString: deal.dateString,
    deal_type: mapApiTypeToOurType(deal.type),
    image_url: deal.imageUrl || deal.image_url || deal.image || deal.photo || deal.picture,
    ai_insight: deal.aiInsight || deal.ai_insight || deal.insight || deal.description,
    vibe_description: deal.vibeDescription || deal.vibe_description || deal.vibe || deal.summary,
    continent: deal.continent || deal.region || deal.area,
    urgency: deal.urgency || deal.urgencyLevel || "medium",
    price_trend: deal.priceTrend || deal.price_trend || deal.trend || deal.priceDirection || "stable",
    itinerary_ideas:
      deal.thingsToDo?.map((t: any) => t.title || t.name) ||
      deal.itineraryIdeas ||
      deal.itinerary_ideas ||
      deal.activities ||
      deal.things_to_do ||
      [],
    neighborhood_previews:
      deal.neighborhoodPreviews || deal.neighborhood_previews || deal.neighborhoods || deal.areas || [],
    best_time_to_book: deal.bestTimeToBook || deal.best_time_to_book || deal.bookingWindow,
    experiences:
      deal.thingsToDo?.map((t: any) => ({
        title: t.title || t.name,
        description: t.paragraph || t.description,
      })) ||
      deal.experiences ||
      deal.curated_experiences ||
      [],
    travel_tips: deal.travel_tips || deal.travelTips || deal.tips || [],
    quick_tips: deal.quickTip ? [deal.quickTip] : deal.quick_tips || deal.quickTips || deal.bullet_tips || [],
    interesting_facts: deal.interesting_facts || deal.interestingFacts || deal.facts || [],
    weather_preview:
      deal.weatherMo || deal.temperature || deal.weatherPreview || deal.weather_preview || deal.weather || deal.climate,
    url: deal.url,
    airlines: deal.airlines,
    month_type: deal.monthType,
    layover_info: deal.layoverInfo,
    duration: deal.duration,
    domestic_or_international: deal.domesticOrInternational,
    price_will_last: deal.priceWillLastText,
    is_business_class: false,
  };
}

export function mapApiPremiumDealToLocal(deal: any): Deal {
  const mapped = mapApiDealToLocal(deal);
  mapped.is_business_class = true;
  // Use percentOff for premium if available
  if (!mapped.discount_pct) {
    const pctOff = parseFloat(deal.percentOff || 0);
    if (pctOff) mapped.discount_pct = pctOff;
  }
  return mapped;
}
