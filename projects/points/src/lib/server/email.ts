import "server-only";

/**
 * Transactional email through Resend (RESEND_API_KEY, from POINTS_EMAIL_FROM,
 * e.g. "Trace Points <points@tracetravel.co>" on a verified domain).
 * Returns false when email isn't set up or the send failed, so callers can
 * fall back to asking the team in Slack.
 */
export async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.POINTS_EMAIL_FROM;
  if (!key || !from) return false;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to, subject, text }),
    });
    if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
    return true;
  } catch (e) {
    console.error("[email]", e);
    return false;
  }
}
