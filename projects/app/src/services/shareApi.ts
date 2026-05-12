import { API_BASE_URL } from "../lib/constants";
import type { Deal } from "@trace/shared";

export interface ShareRecord {
  shareId: string;
  dealSnapshot: Deal;
  sharerId: string;
  sharerName: string;
  openedAt: string | null;
  openedByUserId: string | null;
}

export async function createShare(
  deal: Deal,
  sharerId: string,
  sharerName: string
): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/share-deal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dealSnapshot: deal, sharerId, sharerName }),
  });
  if (!res.ok) throw new Error("Failed to create share");
  const { shareId } = await res.json();
  return shareId;
}

export async function fetchShare(shareId: string): Promise<ShareRecord> {
  const res = await fetch(`${API_BASE_URL}/share-deal/${shareId}`);
  if (!res.ok) throw new Error("Share not found");
  return res.json();
}

export async function markShareOpened(
  shareId: string,
  openedByUserId: string,
  openerName: string
): Promise<void> {
  await fetch(`${API_BASE_URL}/share-deal/${shareId}/opened`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ openedByUserId, openerName }),
  });
}
