import type { SavedDeal } from "./deal";

export interface TripGroupMember {
  userId: string;
  displayName: string;
  profilePictureUrl: string | null;
  joinedAt: Date;
  isIn: boolean;
}

export interface TripGroupComment {
  id: string;
  userId: string;
  displayName: string;
  text: string;
  createdAt: Date;
}

export interface TripGroup {
  id?: string;
  deal: SavedDeal;
  createdBy: string;
  createdByName: string;
  members: TripGroupMember[];
  comments: TripGroupComment[];
  createdAt: Date;
}
