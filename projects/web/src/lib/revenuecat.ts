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

/**
 * Live renewal state for a customer's active subscription, straight from
 * RevenueCat — used on the user detail page to show "Free trial" / "Canceled".
 * `isCanceled` = auto-renew is off (won't renew); `isTrialing` = still in the
 * free-trial period. Resilient: returns null on any failure / no customer, so
 * the page renders without the badges rather than erroring.
 */
export async function getCustomerRenewalState(
  appUserId: string
): Promise<{ isTrialing: boolean; isCanceled: boolean } | null> {
  try {
    const pid = await getProjectId();
    const data = await rcFetch<{
      items?: Array<{
        status?: string;
        auto_renewal_status?: string;
        gives_access?: boolean;
      }>;
    }>(
      `/projects/${pid}/customers/${encodeURIComponent(appUserId)}/subscriptions`
    );
    const items = data.items ?? [];
    // Prefer an access-granting subscription; else the first one present.
    const sub = items.find((s) => s.gives_access) ?? items[0];
    if (!sub) return { isTrialing: false, isCanceled: false };
    return {
      isTrialing: sub.status === "trialing",
      isCanceled: sub.auto_renewal_status === "will_not_renew",
    };
  } catch {
    return null;
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

/**
 * @deprecated Implementation broken — RC v2 changed `/projects/{pid}/subscriptions`
 * from a list endpoint to a single-item search endpoint that requires a
 * `store_subscription_identifier` query parameter. The aggregation strategy
 * here (enumerate all subs, compute summary client-side) is no longer
 * viable.
 *
 * Migration path (separate task): switch to RC's dedicated metrics + charts
 * endpoints, which return the aggregates we want directly:
 *   - GET /projects/{pid}/metrics/overview      → activeSubscribers, activeTrialing
 *   - GET /projects/{pid}/metrics/revenue       → MRR / ARR / revenue over range
 *   - GET /projects/{pid}/charts/actives        → active count by tier/billing
 *   - GET /projects/{pid}/charts/mrr            → MRR over time
 *   - Trial cohort / churn need /customers iteration or chart endpoints
 *
 * Until migrated, return null so the dashboard renders "—" gracefully
 * (page.tsx already .catches errors → null). The console.warn replaces the
 * thrown error so the preview stays clean.
 */
export async function getSubscriptionSummary(): Promise<SubscriptionSummary | null> {
  console.warn(
    "[RC summary] disabled — needs migration from deprecated /subscriptions endpoint to /metrics + /charts endpoints"
  );
  return null;
}
