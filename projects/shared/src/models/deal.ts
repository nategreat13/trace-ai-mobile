export interface Deal {
  id: string;
  destination: string;
  destination_code: string;
  origin: string;
  price: number;
  original_price: number;
  discount_pct: number;
  travel_window: string;
  dateString: string;
  deal_type: string | null;
  image_url: string;
  ai_insight: string;
  vibe_description: string;
  continent: string;
  urgency: string;
  price_trend: string;
  itinerary_ideas: string[];
  neighborhood_previews: string[];
  best_time_to_book: string;
  experiences: { title: string; description: string }[];
  travel_tips: string[];
  quick_tips: string[];
  interesting_facts: string[];
  weather_preview: string;
  url: string;
  airlines: string;
  month_type: string;
  layover_info: string;
  duration: string;
  domestic_or_international: string;
  price_will_last: string;
  is_business_class?: boolean;
  allMonthVariants?: Deal[];
}

export type SwipeAction = "left" | "right" | "super";

export interface SwipeRecord {
  id?: string;
  userId: string;
  dealId: string;
  action: SwipeAction;
  dealType: string | null;
  destination: string;
  continent: string | null;
  price: number;
  domesticOrInternational: string | null;
  createdAt: Date;
}

export interface SavedDeal {
  id?: string;
  userId: string;
  originalDealId: string;
  destination: string;
  destinationCode: string;
  origin: string;
  price: number;
  originalPrice: number;
  discountPct: number;
  travelWindow: string;
  dealType: string;
  imageUrl: string;
  aiInsight: string;
  vibeDescription: string;
  weatherPreview: string;
  continent: string;
  urgency: string;
  priceTrend: string;
  url: string;
  airlines: string;
  duration: string;
  layoverInfo: string;
  isBusinessClass: boolean;
  createdAt: Date;
}
