import { Router, Request, Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { getDb } from "../firebase";

export const destinationInfoRoutes = Router();

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MONTH_NAMES: Record<string, string> = {
  jan: "January", feb: "February", mar: "March", apr: "April",
  may: "May", jun: "June", jul: "July", aug: "August",
  sep: "September", oct: "October", nov: "November", dec: "December",
  january: "January", february: "February", march: "March", april: "April",
  june: "June", july: "July", august: "August", september: "September",
  october: "October", november: "November", december: "December",
};

function resolveMonth(month: string): string {
  return MONTH_NAMES[month.toLowerCase()] ?? month;
}

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
    max_tokens: 3000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = (message.content[0] as { type: string; text: string }).text.trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in Claude response");
  return JSON.parse(jsonMatch[0]);
}

function buildDomesticPrompt(destination: string, code: string, month: string): string {
  const monthLabel = resolveMonth(month);
  const monthContext = month !== "any" ? `The traveler is visiting in ${monthLabel}.` : "";

  return `You are a travel expert with deep local knowledge. Generate a destination guide for ${destination} (airport: ${code}) for US travelers flying domestically. ${monthContext}

Since this is domestic US travel, skip currency, language, timezone, and power plug — travelers already know those.

Return ONLY valid JSON with this exact structure (no markdown, no explanation):

{
  "weather": {
    "label": "short evocative label for the weather this month (e.g. 'Peak Summer', 'Karl's Back', 'Snowfall Season')",
    "temp": "low-high°F range for ${monthLabel !== "any" ? monthLabel : "a typical visit"}",
    "humidity": <average humidity % as integer>,
    "desc": "one short punchy line describing the weather vibe",
    "details": "one sentence with the most useful thing to know about the weather this month — specific, not generic",
    "icon": "one of: sun, rain, snow, cloud, partly",
    "packingTip": "one sentence on what to pack for the weather"
  },
  "neighborhoods": [
    {
      "name": "neighborhood name",
      "emoji": "single emoji",
      "vibe": "2-4 word vibe",
      "description": "2-3 sentences — specific, opinionated, what to actually do and when"
    }
  ],
  "thingsToDo": [
    {
      "name": "activity name",
      "emoji": "single emoji",
      "description": "one sentence — what makes it worth doing",
      "tags": ["one or more of: adventure, culture, food, relaxation, luxury, family, romantic"]
    }
  ],
  "dining": {
    "budget": [{ "name": "restaurant name", "type": "cuisine + one-line context" }],
    "moderate": [{ "name": "restaurant name", "type": "cuisine + one-line context" }],
    "premium": [{ "name": "restaurant name", "type": "cuisine + one-line context" }]
  },
  "dailyBudget": {
    "budget": { "amount": "$XX/day", "description": "what budget looks like: accommodation, food, transport" },
    "midRange": { "amount": "$XXX/day", "description": "what mid-range looks like" },
    "luxury": { "amount": "$XXX+/day", "description": "what luxury looks like" }
  },
  "gettingAround": [
    { "icon": "single emoji", "mode": "transport mode", "tip": "specific actionable tip", "cost": "rough cost or omit if not applicable" }
  ],
  "dayTrips": [
    { "name": "destination", "emoji": "single emoji", "time": "X hrs by car/train", "description": "one sentence on what makes it worth the trip and what to do there" }
  ],
  "whatToAvoid": [
    { "tip": "one specific thing to avoid — tourist trap, safety note, common mistake, or scam" }
  ]
}

Rules:
- 3-4 neighborhoods, 5-6 things to do, 2-3 dining per tier, 3 daily budget tiers, 2-3 getting around, 2-4 day trips, 4-5 things to avoid
- Weather must be accurate for ${destination} specifically in ${monthLabel !== "any" ? monthLabel : "a typical month"} — not generic regional data
- Things to do must be tagged accurately so we can personalize for different traveler types
- Be specific and opinionated. Name real places. No generic advice.`;
}

function buildInternationalPrompt(destination: string, code: string, month: string): string {
  const monthLabel = resolveMonth(month);
  const monthContext = month !== "any" ? `The traveler is visiting in ${monthLabel}.` : "";

  return `You are a travel expert with deep local knowledge. Generate a destination guide for ${destination} (airport: ${code}) for US travelers visiting internationally. ${monthContext}

Return ONLY valid JSON with this exact structure (no markdown, no explanation):

{
  "essentials": {
    "flag": "country flag emoji",
    "currency": "currency name and symbol, e.g. Euro (€)",
    "language": "primary language, note if English is widely spoken",
    "timezone": "timezone name and UTC offset, e.g. CET/CEST (UTC+1/+2)",
    "plug": "plug type, e.g. Type F (2-pin round)",
    "needsAdapter": true or false
  },
  "weather": {
    "label": "short evocative label for the weather this month",
    "temp": "low-high°F range for ${monthLabel !== "any" ? monthLabel : "a typical visit"}",
    "humidity": <average humidity % as integer>,
    "desc": "one short punchy line describing the weather vibe",
    "details": "one sentence with the most useful thing to know about the weather this month — specific, not generic",
    "icon": "one of: sun, rain, snow, cloud, partly",
    "packingTip": "one sentence on what to pack for the weather"
  },
  "neighborhoods": [
    {
      "name": "neighborhood name",
      "emoji": "single emoji",
      "vibe": "2-4 word vibe",
      "description": "2-3 sentences — specific, opinionated, what to actually do and when"
    }
  ],
  "thingsToDo": [
    {
      "name": "activity name",
      "emoji": "single emoji",
      "description": "one sentence — what makes it worth doing",
      "tags": ["one or more of: adventure, culture, food, relaxation, luxury, family, romantic"]
    }
  ],
  "dining": {
    "budget": [{ "name": "restaurant name", "type": "cuisine + one-line context" }],
    "moderate": [{ "name": "restaurant name", "type": "cuisine + one-line context" }],
    "premium": [{ "name": "restaurant name", "type": "cuisine + one-line context" }]
  },
  "dailyBudget": {
    "budget": { "amount": "$XX/day", "description": "what budget looks like: accommodation, food, transport" },
    "midRange": { "amount": "$XXX/day", "description": "what mid-range looks like" },
    "luxury": { "amount": "$XXX+/day", "description": "what luxury looks like" }
  },
  "gettingAround": [
    { "icon": "single emoji", "mode": "transport mode", "tip": "specific actionable tip", "cost": "rough cost in local currency or omit" }
  ],
  "dayTrips": [
    { "name": "destination", "emoji": "single emoji", "time": "X hrs by car/train/ferry" }
  ],
  "whatToAvoid": [
    { "tip": "one specific thing to avoid — tourist trap, safety note, common mistake, cultural faux pas, or scam" }
  ]
}

Rules:
- 3-4 neighborhoods, 5-6 things to do, 2-3 dining per tier, 3 daily budget tiers, 2-3 getting around, 2-4 day trips, 4-5 things to avoid
- Weather must be accurate for ${destination} specifically in ${monthLabel !== "any" ? monthLabel : "a typical month"} — not generic regional data
- Things to do must be tagged accurately so we can personalize for different traveler types
- Be specific and opinionated. Name real places. No generic advice.`;
}
