import { Router, Request, Response } from "express";

export const supportRoutes = Router();

supportRoutes.post("/support", async (req: Request, res: Response) => {
  const { name, email, subject, message } = req.body;

  if (!message?.trim()) {
    res.status(400).json({ error: "message is required" });
    return;
  }

  const webhookUrl = process.env.SLACK_SUPPORT_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error("[support] SLACK_SUPPORT_WEBHOOK_URL is not set");
    res.status(500).json({ error: "Support is not configured" });
    return;
  }

  const slackBody = {
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "🆘 New Support Request", emoji: true },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Name:*\n${name?.trim() || "Not provided"}` },
          { type: "mrkdwn", text: `*Email:*\n${email?.trim() || "Unknown"}` },
        ],
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: `*Subject:*\n${subject?.trim() || "No subject"}` },
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: `*Message:*\n${message.trim()}` },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Reply in Gmail", emoji: true },
            url: `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(email?.trim() || "")}&su=${encodeURIComponent(`Re: ${subject?.trim() || "Support Request"}`)}`,
            style: "primary",
          },
        ],
      },
      {
        type: "context",
        elements: [
          { type: "mrkdwn", text: `Sent from Trace app · ${new Date().toLocaleString("en-US", { timeZone: "America/Denver" })} MT` },
        ],
      },
    ],
  };

  try {
    const slackRes = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(slackBody),
    });

    if (!slackRes.ok) {
      const text = await slackRes.text();
      console.error("[support] Slack webhook failed:", slackRes.status, text);
      res.status(500).json({ error: "Failed to send support message" });
      return;
    }

    res.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[support] fetch error:", msg);
    res.status(500).json({ error: "Failed to send support message" });
  }
});
