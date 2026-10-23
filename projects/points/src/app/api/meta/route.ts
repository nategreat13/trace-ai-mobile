import { NextResponse } from "next/server";
import { sendMetaEvent } from "@/lib/server/meta";
import { sessionEmail } from "@/lib/server/session";

/**
 * The server half of the browser's key funnel events. Only these names are
 * accepted, so the endpoint can't be used to send arbitrary events to the
 * pixel. StartTrial isn't here: it's sent from checkout verify, where the
 * trial is confirmed with Stripe.
 */
const ALLOWED = new Set(["ViewContent", "Lead", "InitiateCheckout"]);

export async function POST(req: Request) {
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  const origin = req.headers.get("origin");
  if (site && origin && origin !== new URL(site).origin) return NextResponse.json({ ok: false }, { status: 403 });

  const body = (await req.json().catch(() => null)) as null | { name?: string; eventId?: string; url?: string };
  if (!body?.name || !ALLOWED.has(body.name) || !body.eventId || body.eventId.length > 80) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const cookie = req.headers.get("cookie") ?? "";
  const metaId = (name: string) => cookie.match(new RegExp(`(?:^|; )${name}=([^;]+)`))?.[1];

  await sendMetaEvent({
    name: body.name,
    eventId: body.eventId,
    url: typeof body.url === "string" ? body.url.slice(0, 500) : undefined,
    // Signed-in members only; the browser never sends an email here.
    email: (await sessionEmail()) ?? undefined,
    fbp: metaId("_fbp"),
    fbc: metaId("_fbc"),
    ip: (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
  return NextResponse.json({ ok: true });
}
