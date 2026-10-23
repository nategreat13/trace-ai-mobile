import "server-only";
import { createHash } from "node:crypto";

/**
 * Meta Conversions API, so trial starts count even when the browser pixel is
 * blocked. Needs NEXT_PUBLIC_META_PIXEL_ID and META_CAPI_TOKEN; does nothing
 * without them. The browser sends the same event with the same eventId, and
 * Meta keeps one.
 */
export async function sendMetaEvent(e: { name: string; eventId: string; email?: string; fbp?: string; fbc?: string; value?: number }) {
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
        user_data: { em: e.email ? [sha(e.email)] : undefined, fbp: e.fbp, fbc: e.fbc },
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
    if (!r.ok) console.error("[meta capi]", r.status, await r.text());
  } catch (err) {
    console.error("[meta capi]", err);
  }
}
