import { NextResponse } from "next/server";
import { isPointsEvent } from "@/lib/events";
import { isAdmin } from "@/lib/server/admin";
import { colRef, FieldValue } from "@/lib/server/firebase";

/**
 * Stores one analytics event for the /admin page. Anonymous: a random
 * visitor id and visit id from the browser, the ad tags it arrived with and
 * the device type. No email, no IP. Unknown event names and bots are dropped,
 * and events from a browser signed in to /admin are marked internal so our
 * own testing stays out of the numbers.
 */
const BOT = /bot|crawler|spider|crawling|facebookexternalhit|headless|lighthouse|preview/i;

const id = (v: unknown) => (typeof v === "string" && /^[\w-]{8,64}$/.test(v) ? v : null);
const short = (v: unknown, max = 100) => (typeof v === "string" && v ? v.slice(0, max) : null);

function props(raw: unknown): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw).slice(0, 12)) {
    if (!/^\w{1,40}$/.test(k)) continue;
    if (typeof v === "string") out[k] = v.slice(0, 100);
    else if (typeof v === "boolean" || (typeof v === "number" && Number.isFinite(v))) out[k] = v;
  }
  return out;
}

function device(ua: string) {
  const os = /iPhone|iPad|iPod/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "Other";
  const mobile = /Mobi|iPhone|iPod|Android/.test(ua) || (os === "iOS" && /iPad/.test(ua));
  return { device: mobile ? "mobile" : "desktop", os };
}

export async function POST(req: Request) {
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  const origin = req.headers.get("origin");
  if (site && origin && origin !== new URL(site).origin) return NextResponse.json({ ok: false }, { status: 403 });

  const ua = req.headers.get("user-agent") ?? "";
  if (!ua || BOT.test(ua)) return NextResponse.json({ ok: true, skipped: true });

  const body = (await req.json().catch(() => null)) as null | Record<string, unknown>;
  const vid = id(body?.vid);
  const sid = id(body?.sid);
  if (!body || !isPointsEvent(body.event) || !vid || !sid) return NextResponse.json({ ok: false }, { status: 400 });

  const attr = (body.attr && typeof body.attr === "object" ? body.attr : {}) as Record<string, unknown>;
  try {
    await colRef("pointsEvents").add({
      event: body.event,
      props: props(body.props),
      vid,
      sid,
      at: FieldValue.serverTimestamp(),
      clientAt: typeof body.at === "number" ? body.at : null,
      path: short(body.path, 200),
      utm: { source: short(attr.source), campaign: short(attr.campaign), content: short(attr.content) },
      referrer: short(attr.referrer),
      ...device(ua),
      internal: await isAdmin(),
    });
  } catch (e) {
    console.error("[events] couldn't store event", e);
    return NextResponse.json({ ok: false }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
