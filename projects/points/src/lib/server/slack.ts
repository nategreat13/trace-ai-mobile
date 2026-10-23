import "server-only";

/**
 * Posts to the Trace Points Slack channel through an incoming webhook
 * (POINTS_SLACK_WEBHOOK_URL). Without one, messages go to the server log so
 * nothing is lost locally. Returns false only when Slack refused it.
 */
export async function postSlack(text: string): Promise<boolean> {
  const hook = process.env.POINTS_SLACK_WEBHOOK_URL;
  if (!hook) {
    console.log("[slack]", text);
    return true;
  }
  try {
    const res = await fetch(hook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
    if (!res.ok) throw new Error(`Slack ${res.status}`);
    return true;
  } catch (e) {
    console.error("[slack] send failed", e);
    return false;
  }
}
