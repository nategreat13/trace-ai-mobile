export interface MatchedDealSnapshot {
  destination: string;
  price: number;
  originalPrice?: number;
  discount: number;
  url?: string;
  imageUrl?: string;
  airlines?: string;
  travelWindow?: string;
  origin?: string;
  destinationCode?: string;
}

export interface DealAlert {
  id?: string;
  userId: string;
  destination: string;
  month: string | null;
  status: "active" | "matched";
  createdAt: Date;
  matchedDeal?: MatchedDealSnapshot;
  matchedAt?: Date;
}
