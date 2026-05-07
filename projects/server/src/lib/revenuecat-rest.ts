/**
 * Server-side RevenueCat V2 REST helpers.
 *
 * The web/admin project has its own RC client at projects/web/src/lib/revenuecat.ts.
 * This module mirrors the same patterns (Bearer auth, V2 endpoints,
 * project-id auto-discovery with cache) but lives inside the Cloud
 * Function so we don't pull web-only deps into the server build.
 *
 * Requires REVENUECAT_REST_API_KEY in process.env (bound via defineSecret
 * in projects/server/src/index.ts).
 */

const RC_API_BASE = "https://api.revenuecat.com/v2";

let _cachedProjectId: string | null = null;

function authHeaders(): Record<string, string> {
  const apiKey = process.env.REVENUECAT_REST_API_KEY;
  if (!apiKey) {
    throw new Error(
      "REVENUECAT_REST_API_KEY is not set. Cannot call the RevenueCat API."
    );
  }
  return {
    Authorization: `Bearer ${apiKey}`,
    Accept: "application/json",
  };
}

/**
 * RC V2 requires the project_id in the path. Auto-discovered from
 * /v2/projects on first call and cached for the function's lifetime.
 * REVENUECAT_PROJECT_ID env is honored if set.
 */
export async function getRcProjectId(): Promise<string> {
  if (process.env.REVENUECAT_PROJECT_ID) return process.env.REVENUECAT_PROJECT_ID;
  if (_cachedProjectId) return _cachedProjectId;

  const res = await fetch(`${RC_API_BASE}/projects?limit=10`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "(unreadable)");
    throw new Error(
      `Failed to list RC projects (${res.status}): ${body.slice(0, 300)}`
    );
  }
  const data = (await res.json()) as { items?: Array<{ id: string }> };
  if (!data.items?.length) {
    throw new Error("No RC projects visible to this API key");
  }
  _cachedProjectId = data.items[0].id;
  return _cachedProjectId;
}

/**
 * Grant a promotional entitlement until the given absolute end time.
 *   POST /v2/projects/{project_id}/customers/{customer_id}/actions/grant_entitlement
 *   body: { entitlement_id, expires_at }   // expires_at = ms since epoch
 */
export async function grantPromotionalEntitlement(opts: {
  appUserId: string;
  entitlementId: string;
  endTimeMs: number;
}): Promise<unknown> {
  if (!opts.entitlementId) {
    throw new Error("entitlementId is required");
  }
  if (!opts.endTimeMs || opts.endTimeMs <= Date.now()) {
    throw new Error(`endTimeMs must be in the future, got ${opts.endTimeMs}`);
  }

  const projectId = await getRcProjectId();
  const url = `${RC_API_BASE}/projects/${encodeURIComponent(
    projectId
  )}/customers/${encodeURIComponent(opts.appUserId)}/actions/grant_entitlement`;

  const res = await fetch(url, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      entitlement_id: opts.entitlementId,
      expires_at: opts.endTimeMs,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "(unreadable)");
    throw new Error(
      `RevenueCat grant_entitlement returned ${res.status}: ${body.slice(0, 500)}`
    );
  }
  return res.json().catch(() => ({}));
}

export interface ActiveEntitlement {
  entitlement_id: string;
  /** Milliseconds since epoch. null = lifetime grant. */
  expires_at: number | null;
}

/**
 * List the customer's currently-active entitlements (i.e. those that
 * haven't yet expired). Used by the EXPIRATION webhook handler to
 * decide whether the user should drop to free or fall back to a still-
 * valid lower-tier entitlement.
 *
 * Returns an empty array if the customer has no record on RC (e.g.
 * never had a paid sub or grant).
 */
export async function listActiveEntitlements(
  appUserId: string
): Promise<ActiveEntitlement[]> {
  const projectId = await getRcProjectId();
  const url = `${RC_API_BASE}/projects/${encodeURIComponent(
    projectId
  )}/customers/${encodeURIComponent(appUserId)}/active_entitlements?limit=20`;

  const res = await fetch(url, { headers: authHeaders() });
  if (res.status === 404) return [];
  if (!res.ok) {
    const body = await res.text().catch(() => "(unreadable)");
    throw new Error(
      `RevenueCat active_entitlements returned ${res.status}: ${body.slice(0, 500)}`
    );
  }
  const data = (await res.json()) as { items?: ActiveEntitlement[] };
  return data.items ?? [];
}
