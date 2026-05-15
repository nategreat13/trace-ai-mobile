import { Router, Request, Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { colRef } from "../firebase";

export const destinationInfoRoutes = Router();

let client: Anthropic | null = null;
function getClient() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

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
      const docRef = colRef("destinationContent").doc(cacheKey);
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
      // AbortError comes back from the AbortController-driven timeout
      // inside generateDestinationInfo. Distinguishing it lets the
      // client decide between "retry me" (transient timeout) and a
      // real generation failure.
      const isTimeout =
        error instanceof Error && (error.name === "AbortError" || /aborted/i.test(msg));
      console.error(
        `[destination-info] ${isTimeout ? "TIMEOUT" : "ERROR"} for ${cacheKey}:`,
        msg
      );
      res.status(isTimeout ? 504 : 500).json({
        error: isTimeout
          ? "Generation timed out — please try again"
          : "Failed to generate destination info",
        detail: msg,
      });
    }
  }
);

// Hard cap for the Anthropic call. Cloud Functions defaults to a 60s
// request timeout — once we're past 60s the runtime kills the request
// abruptly and the client gets a 504 with no body. Aborting at 50s
// gives us 10s of headroom to log + return a clean 504 with a JSON
// error payload the mobile app can show + retry from. Real production
// case: Trevor's San Francisco request hung 59.99s, hit Cloud Run's
// kill, mobile fell back to generic MOCK_DATA, user saw the wrong city.
const ANTHROPIC_TIMEOUT_MS = 50_000;

async function generateDestinationInfo(
  destination: string,
  code: string,
  isDomestic: boolean,
  month: string
) {
  const prompt = isDomestic
    ? buildDomesticPrompt(destination, code, month)
    : buildInternationalPrompt(destination, code, month);

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ANTHROPIC_TIMEOUT_MS);

  let message;
  try {
    message = await getClient().messages.create(
      {
        model: "claude-sonnet-4-6",
        // Bumped from 3000. The guide has 3-4 neighborhoods + 5-6
        // things to do + 9 dining entries + 3 budget tiers + 2-3
        // transport + 2-4 day trips + 4-5 avoidance tips, all as
        // structured JSON. 3000 tokens was getting truncated mid-array
        // for content-dense cities like Las Vegas, producing
        // unparseable JSON. 6000 leaves comfortable headroom; cost per
        // request is still trivial.
        max_tokens: 6000,
        messages: [{ role: "user", content: prompt }],
      },
      { signal: ac.signal }
    );
  } finally {
    clearTimeout(timer);
  }

  // Catch truncation before we get a cryptic JSON.parse error 10k
  // characters in. If Claude hit the token cap, stop_reason will be
  // "max_tokens" and the JSON is almost certainly incomplete.
  if (message.stop_reason === "max_tokens") {
    throw new Error(
      `Claude response truncated at max_tokens; raise the cap (current ${6000})`
    );
  }

  const text = (message.content[0] as { type: string; text: string }).text.trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in Claude response");
  try {
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Log a window around the parse failure point so we can see the
    // malformed slice without dumping the whole 10k-char response.
    const posMatch = msg.match(/position (\d+)/);
    if (posMatch) {
      const pos = Number(posMatch[1]);
      const start = Math.max(0, pos - 80);
      const end = Math.min(jsonMatch[0].length, pos + 80);
      console.error(
        `[destination-info] JSON parse failed at pos ${pos}. Context:\n...${jsonMatch[0].slice(start, end)}...`
      );
    }
    throw err;
  }
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
