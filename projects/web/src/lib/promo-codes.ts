import { getDb } from "./firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export type Tier = "premium" | "business";

export interface PromoCode {
  code: string;
  tier: Tier;
  durationDays: number;
  maxRedemptions: number | null;
  redemptionCount: number;
  expiresAt: Date | null;
  active: boolean;
  note: string | null;
  createdAt: Date | null;
}

export interface PromoRedemption {
  id: string;
  code: string;
  userId: string;
  email: string | null;
  tier: string;
  durationDays: number;
  redeemedAt: Date | null;
  grantExpiresAt: Date | null;
}

/**
 * Generate a random promo code: TRACE-XXXX-XXXX-XXXX where X is an
 * unambiguous alphanumeric (no 0/O/1/I to avoid hand-typing mistakes).
 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function generateRandomCode(): string {
  const seg = (n: number) =>
    Array.from({ length: n }, () =>
      ALPHABET.charAt(Math.floor(Math.random() * ALPHABET.length))
    ).join("");
  return `TRACE-${seg(4)}-${seg(4)}-${seg(4)}`;
}

export async function listPromoCodes(): Promise<PromoCode[]> {
  const db = getDb();
  const snap = await db
    .collection("promoCodes")
    .orderBy("createdAt", "desc")
    .get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      code: d.id,
      tier: (data.tier as Tier) ?? "premium",
      durationDays: (data.durationDays as number | undefined) ?? 0,
      maxRedemptions: (data.maxRedemptions as number | null | undefined) ?? null,
      redemptionCount: (data.redemptionCount as number | undefined) ?? 0,
      expiresAt: (data.expiresAt as any)?.toDate?.() ?? null,
      active: Boolean(data.active),
      note: (data.note as string | null | undefined) ?? null,
      createdAt: (data.createdAt as any)?.toDate?.() ?? null,
    };
  });
}

export async function listRedemptionsForCode(
  code: string
): Promise<PromoRedemption[]> {
  const db = getDb();
  const snap = await db
    .collection("promoRedemptions")
    .where("code", "==", code.toUpperCase())
    .orderBy("redeemedAt", "desc")
    .get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      code: (data.code as string | undefined) ?? code,
      userId: (data.userId as string | undefined) ?? "",
      email: (data.email as string | null | undefined) ?? null,
      tier: (data.tier as string | undefined) ?? "",
      durationDays: (data.durationDays as number | undefined) ?? 0,
      redeemedAt: (data.redeemedAt as any)?.toDate?.() ?? null,
      grantExpiresAt: (data.grantExpiresAt as any)?.toDate?.() ?? null,
    };
  });
}

export interface CreatePromoCodeInput {
  /** Optional vanity code; auto-generated if omitted */
  code?: string;
  tier: Tier;
  durationDays: number;
  /** null or undefined = unlimited */
  maxRedemptions?: number | null;
  /** ISO date string; null/undefined = no code-level expiry */
  expiresAt?: string | null;
  note?: string | null;
}

/**
 * Creates a new promo code. Returns the final code (handy when
 * auto-generated). Throws if the code already exists.
 */
export async function createPromoCode(
  input: CreatePromoCodeInput
): Promise<string> {
  const db = getDb();
  const tier = input.tier;
  if (tier !== "premium" && tier !== "business") {
    throw new Error("tier must be 'premium' or 'business'");
  }
  if (!input.durationDays || input.durationDays < 1) {
    throw new Error("durationDays must be at least 1");
  }
  const max =
    input.maxRedemptions == null || input.maxRedemptions === 0
      ? null
      : Math.floor(input.maxRedemptions);
  const expiresAt =
    input.expiresAt && input.expiresAt.trim().length > 0
      ? new Date(input.expiresAt)
      : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime())) {
    throw new Error("expiresAt is not a valid date");
  }

  const code = (input.code?.trim() || generateRandomCode()).toUpperCase();
  const ref = db.collection("promoCodes").doc(code);
  const existing = await ref.get();
  if (existing.exists) {
    throw new Error(`Code ${code} already exists`);
  }
  await ref.set({
    tier,
    durationDays: Math.floor(input.durationDays),
    maxRedemptions: max,
    redemptionCount: 0,
    expiresAt,
    active: true,
    note: input.note?.trim() || null,
    createdAt: FieldValue.serverTimestamp(),
  });
  return code;
}

export async function setPromoCodeActive(
  code: string,
  active: boolean
): Promise<void> {
  const db = getDb();
  await db.collection("promoCodes").doc(code.toUpperCase()).update({ active });
}

export async function deletePromoCode(code: string): Promise<void> {
  const db = getDb();
  await db.collection("promoCodes").doc(code.toUpperCase()).delete();
}
