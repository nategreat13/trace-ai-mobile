import { NextResponse } from "next/server";
import { CONTACT_TOPICS } from "@/lib/contact";

const MAX_MESSAGE = 4000;

/**
 * Contact form. Sends each message to Slack when CONTACT_SLACK_WEBHOOK_URL is
 * set (an incoming webhook for the channel). Without it, the message is only
 * logged, so the form works locally before the channel exists. Email delivery
 * can be added here later the same way.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  // Bots fill every field; people never see this one.
  if (str(body.website, 200)) return NextResponse.json({ ok: true });

  const email = str(body.email, 200);
  const message = str(body.message, MAX_MESSAGE);
  const topic = (CONTACT_TOPICS as readonly string[]).includes(String(body.topic)) ? String(body.topic) : "Question";
  if (!/.+@.+\..+/.test(email)) return NextResponse.json({ error: "Add an email we can reply to." }, { status: 400 });
  if (message.length < 2) return NextResponse.json({ error: "Add a message." }, { status: 400 });

  const ctx = (body.context ?? {}) as Record<string, unknown>;
  const details = [
    ctx.member ? `member (${str(ctx.plan, 20) || "plan unknown"})` : "free",
    str(ctx.airport, 10) && `from ${str(ctx.airport, 10)}`,
    typeof ctx.points === "number" && `${ctx.points.toLocaleString("en-US")} pts`,
    str(ctx.page, 200) && `on ${str(ctx.page, 200)}`,
  ].filter(Boolean).join(" · ");

  const hook = process.env.CONTACT_SLACK_WEBHOOK_URL;
  if (!hook) {
    console.log("[contact]", { email, topic, details, message });
    return NextResponse.json({ ok: true, delivered: false });
  }

  const text = `*Trace Points contact: ${topic}*\nFrom ${email}${details ? ` · ${details}` : ""}\n>>> ${message}`;
  try {
    const res = await fetch(hook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
    if (!res.ok) throw new Error(`Slack ${res.status}`);
  } catch (e) {
    console.error("[contact] Slack send failed", e);
    return NextResponse.json({ error: "We couldn't send that. Try again in a minute." }, { status: 502 });
  }
  return NextResponse.json({ ok: true, delivered: true });
}
