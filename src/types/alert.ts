export interface DealAlert {
  id?: string;
  userId: string;
  destination: string;
  month: string | null;
  status: "active" | "matched";
  createdAt: Date;
}
