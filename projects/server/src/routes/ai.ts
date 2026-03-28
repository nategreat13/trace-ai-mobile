import { Router, Request, Response } from "express";
import Anthropic from "@anthropic-ai/sdk";

export const aiRoutes = Router();

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

aiRoutes.post("/ai/deal-fit", async (req: Request, res: Response) => {
  try {
    const { deal, profile } = req.body;

    if (!deal || !profile) {
      res.status(400).json({ error: "Missing deal or profile" });
      return;
    }

    const firstName = (profile.displayName || "Traveler").split(" ")[0];
    const personality = (() => {
      try { return JSON.parse(profile.travelPersonality || "{}"); } catch { return {}; }
    })();

    const prompt = `You are a witty, human-sounding travel advisor writing a 2-sentence personalized deal summary for ${firstName}.

Their travel profile:
- Personality: ${personality.title || "Explorer"} — "${personality.description || "loves to travel"}"
- Travel style: ${(profile.dealTypes || []).join(", ") || "flexible"}
- Prefers: ${profile.destinationPreference || "both domestic and international"}
- Timeframe: ${(profile.travelTimeframe || []).join(", ") || "flexible"}

The deal:
- Destination: ${deal.destination}
- Price: $${deal.price} (${deal.discount_pct > 0 ? `${deal.discount_pct}% off` : "great value"})
- Vibe: ${deal.vibe_description || deal.ai_insight || ""}
- Type: ${deal.deal_type || "general"}
- Travel window: ${deal.travel_window || "flexible"}

Write exactly 2 short sentences that feel personal and human — like a knowledgeable friend texting them. Start with how well this fits them (not so good / good / great / perfect fit), explain why in plain conversational language. Be specific to their personality. No bullet points, no markdown, no emojis. Under 60 words total.`;

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 120,
      messages: [{ role: "user", content: prompt }],
    });

    const summary = (message.content[0] as { type: string; text: string }).text.trim();
    res.json({ summary, firstName });
  } catch (error) {
    console.error("AI deal-fit error:", error);
    res.status(500).json({ error: "Failed to generate summary" });
  }
});
