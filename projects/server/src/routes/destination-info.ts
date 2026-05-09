import { Router, Request, Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { getDb } from "../firebase";

export const destinationInfoRoutes = Router();

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

destinationInfoRoutes.get(
  "/destination-info/:destinationCode",
  async (req: Request, res: Response) => {
    const destinationCode = req.params.destinationCode as string;
    const destination = req.query.destination as string;
    const isDomestic = req.query.domestic === "true";
    const month = (req.query.month as string) || "any";

    if (!destination) {
      res.status(400).json({ error: "destination query param required" });
      return;
    }

    const cacheKey = `${destinationCode.toUpperCase()}_${isDomestic ? "domestic" : "international"}_${month}`;

    try {
      const db = getDb();
      const docRef = db.collection("destinationContent").doc(cacheKey);
      const doc = await docRef.get();

      if (doc.exists) {
        res.json(doc.data());
        return;
      }

      const content = await generateDestinationInfo(destination, destinationCode, isDomestic, month);
      await docRef.set(content);
      res.json(content);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("destination-info error:", msg);
      res.status(500).json({ error: "Failed to generate destination info", detail: msg });
    }
  }
);

async function generateDestinationInfo(
  destination: string,
  code: string,
  isDomestic: boolean,
  month: string
) {
  const prompt = isDomestic
    ? buildDomesticPrompt(destination, code, month)
    : buildInternationalPrompt(destination, code, month);

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = (message.content[0] as { type: string; text: string }).text.trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in Claude response");
  return JSON.parse(jsonMatch[0]);
}

function buildDomesticPrompt(destination: string, code: string, month: string): string {
  const monthContext = month !== "any" ? `The traveler is visiting in ${month}.` : "";
  return `You are a travel content writer with deep local knowledge. Generate a destination guide for ${destination} (airport: ${code}) for US travelers flying domestically. ${monthContext}

Since they're traveling within the US, skip currency, language, timezone, and power plug info — they know those. Focus entirely on local knowledge.

Return ONLY a valid JSON object with this exact structure (no markdown, no explanation):

{
  "essentials": {
    "insiderNote": "one specific insider tip that locals know and tourists miss — concrete and actionable, not generic"
  },
  "neighborhoods": [
    {
      "name": "neighborhood name",
      "emoji": "single emoji",
      "vibe": "2-4 word vibe phrase",
      "description": "2-3 sentences — specific, opinionated, tells you what to actually do and when"
    }
  ],
  "attractions": [
    { "name": "attraction name", "emoji": "single emoji" }
  ],
  "dining": {
    "budget": [{ "name": "restaurant name", "type": "cuisine/style + short context" }],
    "moderate": [{ "name": "restaurant name", "type": "cuisine/style + short context" }],
    "premium": [{ "name": "restaurant name", "type": "cuisine/style + short context" }]
  },
  "dayTrips": [
    { "name": "destination name", "emoji": "single emoji", "time": "X hrs by car/train" }
  ],
  "gettingAround": [
    { "icon": "single emoji", "mode": "transport mode", "tip": "specific actionable tip", "cost": "rough cost or omit if not applicable" }
  ],
  "seasonalActivities": [
    { "title": "activity name", "description": "2-3 sentences — what it is, why it's worth doing, any practical tips (hours, cost, how to get there)" }
  ]
}

Include 3-4 neighborhoods, 5-6 attractions, 2-3 dining options per tier, 2-4 day trips, 2-3 getting around options, and 5-6 seasonal activities.
Seasonal activities must be specifically appropriate for ${month !== "any" ? month : "a general visit"} — no fall festivals in June, no beach days in January, etc. Name real events, parks, or experiences.
Be specific and opinionated. Name real places. Avoid generic tourist advice.`;
}

function buildInternationalPrompt(destination: string, code: string, month: string): string {
  const monthContext = month !== "any" ? `The traveler is visiting in ${month}.` : "";
  return `You are a travel content writer with deep local knowledge. Generate a destination guide for ${destination} (airport: ${code}) for US travelers visiting internationally. ${monthContext}

Return ONLY a valid JSON object with this exact structure (no markdown, no explanation):

{
  "essentials": {
    "flag": "country flag emoji",
    "currency": "currency name and symbol, e.g. Euro (€)",
    "language": "primary language (note if English is widely spoken)",
    "timezone": "timezone name and UTC offset, e.g. CET/CEST (UTC+1/UTC+2)",
    "plug": "plug type and brief description, e.g. Type F (2-pin round)",
    "needsAdapter": true or false,
    "insiderNote": "one specific insider tip that locals know and tourists miss — concrete and actionable"
  },
  "neighborhoods": [
    {
      "name": "neighborhood name",
      "emoji": "single emoji",
      "vibe": "2-4 word vibe phrase",
      "description": "2-3 sentences — specific, opinionated, tells you what to actually do and when"
    }
  ],
  "attractions": [
    { "name": "attraction name", "emoji": "single emoji" }
  ],
  "dining": {
    "budget": [{ "name": "restaurant name", "type": "cuisine/style + short context" }],
    "moderate": [{ "name": "restaurant name", "type": "cuisine/style + short context" }],
    "premium": [{ "name": "restaurant name", "type": "cuisine/style + short context" }]
  },
  "dayTrips": [
    { "name": "destination name", "emoji": "single emoji", "time": "X hrs by car/train/ferry" }
  ],
  "gettingAround": [
    { "icon": "single emoji", "mode": "transport mode", "tip": "specific actionable tip", "cost": "rough cost in local currency or omit if not applicable" }
  ],
  "seasonalActivities": [
    { "title": "activity name", "description": "2-3 sentences — what it is, why it's worth doing, any practical tips (hours, cost, how to get there)" }
  ]
}

Include 3-4 neighborhoods, 5-6 attractions, 2-3 dining options per tier, 2-4 day trips, 2-3 getting around options, and 5-6 seasonal activities.
Seasonal activities must be specifically appropriate for ${month !== "any" ? month : "a general visit"} — no fall festivals in June, no beach days in January, etc. Name real events, parks, or experiences.
Be specific and opinionated. Name real places. Avoid generic tourist advice.`;
}
