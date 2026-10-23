/**
 * Server-only (route handlers): minimal Stripe client over fetch, so the app needs no SDK dependency.
 * Keys come from the environment (see example.env); with no secret key the
 * app runs in test mode.
 */
const API = "https://api.stripe.com/v1";

export const stripeEnabled = () => !!process.env.STRIPE_SECRET_KEY;

export const priceFor = (plan: "annual" | "monthly") =>
  plan === "annual" ? process.env.STRIPE_PRICE_ANNUAL : process.env.STRIPE_PRICE_MONTHLY;

/** Stripe wants form encoding with bracketed keys for nested fields. */
function form(params: Record<string, string | number | boolean | undefined>): string {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined) body.append(k, String(v));
  return body.toString();
}

export async function stripe<T>(
  method: "GET" | "POST",
  path: string,
  params: Record<string, string | number | boolean | undefined> = {},
): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe is not configured");
  const url = method === "GET" ? `${API}${path}?${form(params)}` : `${API}${path}`;
  const r = await fetch(url, {
    method,
    headers: { authorization: `Bearer ${key}`, "content-type": "application/x-www-form-urlencoded" },
    body: method === "POST" ? form(params) : undefined,
    cache: "no-store",
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message ?? `Stripe ${r.status}`);
  return j as T;
}

/** Checks a webhook's Stripe-Signature header (HMAC-SHA256 of "t.payload"). */
export async function verifyWebhook(payload: string, header: string | null): Promise<boolean> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !header) return false;
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=") as [string, string]));
  const t = parts.t;
  const sig = header.split(",").filter((kv) => kv.startsWith("v1=")).map((kv) => kv.slice(3));
  if (!t || !sig.length) return false;
  // Reject anything older than five minutes to block replays.
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${payload}`));
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return sig.includes(hex);
}
