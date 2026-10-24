/**
 * Server-only (route handlers): minimal Stripe client over fetch, so the app needs no SDK dependency.
 * Keys come from the environment (see example.env); with no secret key the
 * app runs in test mode.
 */
const API = "https://api.stripe.com/v1";

/** Real payments need both keys: the secret one here and the publishable one for the card fields. */
export const stripeEnabled = () => !!(process.env.STRIPE_SECRET_KEY && process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

/** The exit gift is yearly at $49.99 (its own Stripe price), still with the 3-day trial. */
export const priceFor = (plan: "annual" | "monthly", offer?: string) =>
  plan === "monthly"
    ? process.env.STRIPE_PRICE_MONTHLY
    : offer === "gift"
      ? process.env.STRIPE_PRICE_ANNUAL_GIFT
      : process.env.STRIPE_PRICE_ANNUAL;

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

interface PortalConfig {
  id: string;
  metadata: Record<string, string>;
}
interface Price {
  id: string;
  product: string;
}
let portalConfigId: string | null = null;

/**
 * A customer-portal configuration just for Points, so the account-wide
 * default (shared with Trace's other Stripe products) stays untouched.
 * Members can cancel at the end of the period, update their card, and
 * switch between the regular yearly and monthly prices (never onto the
 * gift price). Found by metadata, created the first time it's needed.
 */
export async function portalConfiguration(origin: string): Promise<string> {
  if (portalConfigId) return portalConfigId;
  const list = await stripe<{ data: PortalConfig[] }>("GET", "/billing_portal/configurations", { active: true, limit: 100 });
  const found = list.data.find((c) => c.metadata?.app === "points");
  if (found) return (portalConfigId = found.id);

  const annual = priceFor("annual");
  const monthly = priceFor("monthly");
  if (!annual || !monthly) throw new Error("Stripe prices aren't configured");
  const { product } = await stripe<Price>("GET", `/prices/${annual}`);
  const created = await stripe<PortalConfig>("POST", "/billing_portal/configurations", {
    "metadata[app]": "points",
    "business_profile[headline]": "Trace Points membership",
    "business_profile[privacy_policy_url]": `${origin}/privacy`,
    "business_profile[terms_of_service_url]": `${origin}/terms`,
    default_return_url: `${origin}/account`,
    "features[invoice_history][enabled]": true,
    "features[payment_method_update][enabled]": true,
    "features[subscription_cancel][enabled]": true,
    "features[subscription_cancel][mode]": "at_period_end",
    "features[subscription_cancel][cancellation_reason][enabled]": true,
    "features[subscription_cancel][cancellation_reason][options][0]": "too_expensive",
    "features[subscription_cancel][cancellation_reason][options][1]": "unused",
    "features[subscription_cancel][cancellation_reason][options][2]": "missing_features",
    "features[subscription_cancel][cancellation_reason][options][3]": "other",
    "features[subscription_update][enabled]": true,
    "features[subscription_update][default_allowed_updates][0]": "price",
    "features[subscription_update][proration_behavior]": "none",
    "features[subscription_update][products][0][product]": product,
    "features[subscription_update][products][0][prices][0]": annual,
    "features[subscription_update][products][0][prices][1]": monthly,
  });
  return (portalConfigId = created.id);
}
