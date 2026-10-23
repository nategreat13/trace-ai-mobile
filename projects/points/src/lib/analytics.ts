import type { PointsEvent } from "./events";

export type { PointsEvent };

/**
 * Funnel analytics. Every event goes to `window.dataLayer` and to
 * /api/events, which stores it for the /admin page under an anonymous
 * visitor id. The key funnel steps also go to the Meta Pixel (loaded in
 * MetaPixel.tsx when NEXT_PUBLIC_META_PIXEL_ID is set). Trial starts are also
 * sent server-side from the Stripe webhook with the same event id.
 */

/** Meta standard events the brief maps onto our funnel. */
const META: Partial<Record<PointsEvent, string>> = {
  results_view: "ViewContent",
  // First time they finish the questions: the highest-volume step that shows real intent.
  funnel_complete: "Lead",
  email_captured: "CompleteRegistration",
  paywall_view: "InitiateCheckout",
  trial_started: "StartTrial",
  contact_sent: "Contact",
};

type Props = Record<string, string | number | boolean | undefined>;

/**
 * Mid-funnel events Meta also gets from our server (/api/meta) with the same
 * event id, so they still count when the browser pixel is blocked (iOS
 * privacy, ad blockers). StartTrial's server copy comes from checkout verify.
 */
const SERVER_TOO = new Set(["ViewContent", "Lead", "InitiateCheckout"]);

const newEventId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** A visit ends after 30 minutes without an event. */
const SESSION_GAP = 30 * 60 * 1000;

interface Attribution {
  source?: string;
  campaign?: string;
  content?: string;
  referrer?: string;
}

const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {}
};

/**
 * The anonymous ids and ad source attached to every stored event. The ad
 * source is read from the landing URL's utm tags at the start of each visit,
 * and again whenever a new ad click brings fresh tags mid-visit.
 */
function visit(): { vid: string; sid: string; attr: Attribution } {
  let vid = read("tp_vid");
  if (!vid) write("tp_vid", (vid = newEventId()));
  const now = Date.now();
  let sid = read("tp_sid");
  const fresh = !sid || now - Number(read("tp_seen") ?? 0) > SESSION_GAP;
  if (fresh) write("tp_sid", (sid = newEventId()));
  write("tp_seen", String(now));

  const q = new URLSearchParams(window.location.search);
  const tagged = q.get("utm_source") || q.get("utm_content");
  let attr: Attribution = {};
  if (fresh || tagged) {
    let referrer: string | undefined;
    try {
      referrer = document.referrer ? new URL(document.referrer).hostname : undefined;
    } catch {}
    attr = {
      source: q.get("utm_source") ?? undefined,
      campaign: q.get("utm_campaign") ?? undefined,
      content: q.get("utm_content") ?? undefined,
      referrer,
    };
    write("tp_attr", JSON.stringify(attr));
  } else {
    try {
      attr = JSON.parse(read("tp_attr") ?? "{}") as Attribution;
    } catch {}
  }
  return { vid, sid: sid!, attr };
}

export function track(event: PointsEvent, props: Props = {}, eventId?: string): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as { dataLayer?: unknown[]; fbq?: (...a: unknown[]) => void };
  (w.dataLayer ??= []).push({ event, ...props, at: Date.now() });

  const { vid, sid, attr } = visit();
  fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, props, vid, sid, attr, path: window.location.pathname, at: Date.now() }),
    keepalive: true,
  }).catch(() => {});

  const meta = META[event];
  if (meta && process.env.NEXT_PUBLIC_META_PIXEL_ID) {
    const id = eventId ?? (SERVER_TOO.has(meta) ? newEventId() : undefined);
    if (w.fbq) w.fbq("track", meta, props, id ? { eventID: id } : undefined);
    if (id && SERVER_TOO.has(meta)) {
      fetch("/api/meta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: meta, eventId: id, url: window.location.href }),
        keepalive: true,
      }).catch(() => {});
    }
  }
  if (process.env.NODE_ENV !== "production") console.debug("[track]", event, props);
}
