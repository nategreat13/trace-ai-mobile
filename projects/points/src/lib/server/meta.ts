import "server-only";
import { createHash } from "node:crypto";

export interface MetaEvent {
  name: string;
  eventId: string;
  email?: string;
  fbp?: string;
  fbc?: string;
  value?: number;
  /** Page the event happened on. */
  url?: string;
  /** The visitor's IP and browser, which Meta uses to match the event to an ad click. */
  ip?: string;
  userAgent?: string;
}

/**
 * Meta Conversions API, so key funnel events count even when the browser
 * pixel is blocked. Needs NEXT_PUBLIC_META_PIXEL_ID and META_CAPI_TOKEN; does
 * nothing without them. The browser sends the same event with the same
 * eventId, and Meta keeps one.
 */
export async function sendMetaEvent(e: MetaEvent) {
  const pixel = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const token = process.env.META_CAPI_TOKEN;
  if (!pixel || !token) return;
  const sha = (v: string) => createHash("sha256").update(v.trim().toLowerCase()).digest("hex");
  const body = {
    data: [
      {
        event_name: e.name,
        event_time: Math.floor(Date.now() / 1000),
        event_id: e.eventId,
        action_source: "website",
        event_source_url: e.url,
        user_data: {
          em: e.email ? [sha(e.email)] : undefined,
          fbp: e.fbp,
          fbc: e.fbc,
          client_ip_address: e.ip,
          client_user_agent: e.userAgent,
        },
        custom_data: e.value ? { currency: "USD", value: e.value, predicted_ltv: e.value } : undefined,
      },
    ],
  };
  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${pixel}/events?access_token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) console.error("[meta capi]", e.name, r.status, await r.text());
  } catch (err) {
    console.error("[meta capi]", err);
  }
}
