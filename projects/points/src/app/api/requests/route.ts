import { NextResponse } from "next/server";
import { colRef, FieldValue } from "@/lib/server/firebase";
import { sessionEmail } from "@/lib/server/session";
import { postSlack } from "@/lib/server/slack";

const KINDS = { seats: "Find my seats", trip: "Trip request", watch: "Watch dates" } as const;
type Kind = keyof typeof KINDS;

/**
 * Work for the team: seat checks, trips we don't price, and dated watches.
 * Saved to pointsRequests and posted to Slack with everything needed to
 * answer by email: who, from where, what points, which dates.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as null | {
    kind?: string;
    email?: string;
    title?: string;
    lines?: unknown;
    context?: { airport?: string; travelers?: number; balances?: Record<string, number> };
  };
  if (!body || !(body.kind && body.kind in KINDS)) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const kind = body.kind as Kind;
  const email = (await sessionEmail()) ?? (typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 200) : "");
  if (!/.+@.+\..+/.test(email)) return NextResponse.json({ error: "Add your email in Account so we can reply." }, { status: 400 });

  const title = String(body.title ?? "").slice(0, 200);
  const lines = (Array.isArray(body.lines) ? body.lines : []).map((l) => String(l).slice(0, 300)).slice(0, 8);
  const ctx = body.context ?? {};
  const balances = Object.entries(ctx.balances ?? {})
    .filter(([, v]) => typeof v === "number" && v > 0)
    .map(([k, v]) => `${k} ${Number(v).toLocaleString("en-US")}`)
    .join(", ");

  // Slack is the team's queue; the Firestore copy is the record. A failed
  // write must not lose the request, so Slack goes out either way.
  let id = "";
  try {
    const doc = await colRef("pointsRequests").add({
      kind,
      email,
      title,
      lines,
      airport: String(ctx.airport ?? "").slice(0, 10),
      travelers: Number(ctx.travelers) || 1,
      balances: ctx.balances ?? {},
      status: "new",
      createdAt: FieldValue.serverTimestamp(),
    });
    id = doc.id;
  } catch (e) {
    console.error("[requests] Firestore write failed", e);
  }

  const text = [
    `*${KINDS[kind]}: ${title}*`,
    ...lines.map((l) => `• ${l}`),
    `From ${email}${ctx.airport ? ` · flies from ${ctx.airport}` : ""}${ctx.travelers ? ` · ${ctx.travelers} traveler${ctx.travelers === 1 ? "" : "s"}` : ""}`,
    balances && `Points: ${balances}`,
    `_Reply to them by email within 24 hours.${id ? ` Request ${id}` : ""}_`,
  ]
    .filter(Boolean)
    .join("\n");
  if (!(await postSlack(text)) && !id) return NextResponse.json({ error: "We couldn't send that. Try again in a minute." }, { status: 502 });
  return NextResponse.json({ ok: true, id });
}
