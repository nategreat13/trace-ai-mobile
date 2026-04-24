/**
 * RevenueCat V2 REST API client.
 * Docs: https://www.revenuecat.com/docs/api-v2
 *
 * All functions require REVENUECAT_REST_KEY (starting with `sk_`) in env.
 * The RC project ID is derived from the key's owning project — pass it
 * explicitly where required.
 */

const BASE_URL = "https://api.revenuecat.com/v2";

function authHeaders() {
  const key = process.env.REVENUECAT_REST_KEY;
  if (!key) {
    throw new Error("REVENUECAT_REST_KEY is not set in env");
  }
  return {
    Authorization: `Bearer ${key}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

async function rcFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      ...authHeaders(),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`RevenueCat ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

// RC V2 API requires project_id in the path. Users can set it via env,
// otherwise we auto-discover on first use and cache in-process.
let _cachedProjectId: string | null = null;

async function getProjectId(): Promise<string> {
  if (process.env.REVENUECAT_PROJECT_ID) {
    return process.env.REVENUECAT_PROJECT_ID;
  }
  if (_cachedProjectId) return _cachedProjectId;

  const res = await fetch(`${BASE_URL}/projects?limit=10`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to list RC projects: ${res.status}`);
  }
  const data = (await res.json()) as { items: Array<{ id: string; name?: string }> };
  if (!data.items?.length) {
    throw new Error("No RC projects found for this API key");
  }
  _cachedProjectId = data.items[0].id;
  return _cachedProjectId;
}

// -- Types -----------------------------------------------------------------

export interface RCCustomer {
  id: string;
  object: "customer";
  project_id: string;
  first_seen_at: number;
  last_seen_at: number;
  active_entitlements?: {
    items: Array<{
      entitlement_id: string;
      expires_at: number | null;
    }>;
  };
  experiment?: unknown;
  attributes?: Record<string, unknown>;
}

export interface RCCustomersListResponse {
  object: "list";
  items: RCCustomer[];
  next_page?: string | null;
}

export interface RCSubscription {
  id: string;
  object: "subscription";
  customer_id: string;
  original_app_user_id: string;
  product_id: string;
  store: string;
  starts_at: number;
  current_period_starts_at: number;
  current_period_ends_at: number;
  gives_access: boolean;
  status: "active" | "expired" | "in_grace_period" | "in_billing_retry" | "paused" | string;
  auto_renewal_status: "will_renew" | "will_not_renew" | "will_change_product" | string;
  is_trial: boolean;
  country_code?: string;
  store_subscription_identifier?: string;
}

export interface RCSubscriptionsListResponse {
  object: "list";
  items: RCSubscription[];
  next_page?: string | null;
}

// -- API calls -------------------------------------------------------------

/**
 * List subscriptions with pagination. By default lists most-recently-updated
 * first; we page until we've consumed `limit` results or there's no next page.
 */
export async function listAllSubscriptions(limit = 500): Promise<RCSubscription[]> {
  const pid = await getProjectId();
  const all: RCSubscription[] = [];
  let nextPage: string | null | undefined = null;

  do {
    const qs = new URLSearchParams();
    qs.set("limit", "50");
    if (nextPage) qs.set("starting_after", nextPage);

    const resp: RCSubscriptionsListResponse = await rcFetch(
      `/projects/${pid}/subscriptions?${qs.toString()}`
    );
    all.push(...resp.items);
    nextPage = resp.next_page ?? null;
  } while (nextPage && all.length < limit);

  return all.slice(0, limit);
}

/**
 * Fetch a single customer by app_user_id (your Firebase UID).
 */
export async function getCustomer(appUserId: string): Promise<RCCustomer | null> {
  const pid = await getProjectId();
  try {
    return await rcFetch<RCCustomer>(
      `/projects/${pid}/customers/${encodeURIComponent(appUserId)}`
    );
  } catch (err: any) {
    if (String(err.message).includes("404")) return null;
    throw err;
  }
}

// -- Derived aggregates used by the dashboard ------------------------------

export interface SubscriptionSummary {
  activeSubscribers: number;
  activeByTier: { premium: number; business: number };
  activeByBilling: { monthly: number; annual: number };
  activeTrialing: number;
  mrrCents: number;
  arrCents: number;
  churnedLast30Days: number;
  trialStartedLast30Days: number;
  trialConvertedLast30Days: number;
}

const PRODUCT_PRICES_CENTS: Record<string, number> = {
  trace_premium_monthly: 999,
  trace_premium_annual: 5999,
  trace_business_monthly: 1799,
  trace_business_annual: 17999,
};

function productMonthlyCents(productId: string): number {
  const raw = productId.split(":")[0]; // Android format "id:base_plan"
  const total = PRODUCT_PRICES_CENTS[raw];
  if (total == null) return 0;
  if (raw.endsWith("_annual")) return Math.round(total / 12);
  return total;
}

function productTier(productId: string): "premium" | "business" | null {
  if (productId.includes("business")) return "business";
  if (productId.includes("premium")) return "premium";
  return null;
}

function productBilling(productId: string): "monthly" | "annual" | null {
  if (productId.includes("annual")) return "annual";
  if (productId.includes("monthly")) return "monthly";
  return null;
}

export async function getSubscriptionSummary(): Promise<SubscriptionSummary> {
  const subs = await listAllSubscriptions(2000);

  const summary: SubscriptionSummary = {
    activeSubscribers: 0,
    activeByTier: { premium: 0, business: 0 },
    activeByBilling: { monthly: 0, annual: 0 },
    activeTrialing: 0,
    mrrCents: 0,
    arrCents: 0,
    churnedLast30Days: 0,
    trialStartedLast30Days: 0,
    trialConvertedLast30Days: 0,
  };

  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  for (const sub of subs) {
    const isActive =
      sub.gives_access &&
      (sub.status === "active" || sub.status === "in_grace_period");

    if (isActive) {
      summary.activeSubscribers++;
      const tier = productTier(sub.product_id);
      const billing = productBilling(sub.product_id);
      if (tier) summary.activeByTier[tier]++;
      if (billing) summary.activeByBilling[billing]++;
      if (sub.is_trial) summary.activeTrialing++;
      summary.mrrCents += productMonthlyCents(sub.product_id);
    }

    // Churn in last 30d = subscriptions that ended within 30d and are not active
    if (
      !isActive &&
      sub.current_period_ends_at &&
      sub.current_period_ends_at >= thirtyDaysAgo &&
      sub.current_period_ends_at <= now
    ) {
      summary.churnedLast30Days++;
    }

    // Trial starts/conversions in last 30d
    if (sub.starts_at >= thirtyDaysAgo && sub.is_trial) {
      summary.trialStartedLast30Days++;
    }
    if (
      sub.starts_at >= thirtyDaysAgo &&
      !sub.is_trial &&
      sub.auto_renewal_status === "will_renew"
    ) {
      // Approximate: a non-trial active subscription that started in last 30d
      // counts as either a new subscribe or a trial-to-paid conversion.
      // RC doesn't cleanly expose which — we'll refine once we have the
      // data shape from our own webhook logs.
      summary.trialConvertedLast30Days++;
    }
  }

  summary.arrCents = summary.mrrCents * 12;
  return summary;
}
