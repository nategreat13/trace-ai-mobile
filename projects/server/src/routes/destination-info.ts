import { Router, Request, Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { colRef } from "../firebase";

export const destinationInfoRoutes = Router();

let client: Anthropic | null = null;
function getClient() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

/**
 * Structured log helper. Cloud Run / Cloud Logging recognize the
 * `severity` + `message` JSON shape and surface fields searchable in
 * the log explorer (e.g. `jsonPayload.phase="anthropic_call"`).
 *
 * Plain `console.log("...", obj)` lands in `textPayload` as a flat
 * string and you can't filter or alert on the obj's fields. The
 * structured form is the difference between "grep through logs and
 * eyeball" and "filter by destination, sum by error_type."
 */
type LogSev = "INFO" | "WARN" | "ERROR";
function log(severity: LogSev, message: string, fields: Record<string, unknown> = {}) {
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      severity,
      message: `[destination-info] ${message}`,
      ...fields,
    })
  );
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
    const t0 = Date.now();
    // `phase` carries through the catch so we know which step failed
    // without parsing the message string. Updated as the request
    // progresses; whatever value it holds when an exception fires is
    // attributed in the error log.
    let phase: "cache_read" | "anthropic_call" | "json_parse" | "cache_write" =
      "cache_read";

    try {
      const docRef = colRef("destinationContent").doc(cacheKey);
      const doc = await docRef.get();

      if (doc.exists) {
        log("INFO", "cache hit", {
          phase: "cache_hit",
          cacheKey,
          destination,
          elapsed_ms: Date.now() - t0,
        });
        res.json(doc.data());
        return;
      }

      log("INFO", "cache miss; calling Anthropic", {
        phase: "anthropic_call",
        cacheKey,
        destination,
        code: destinationCode,
        domestic: isDomestic,
        month,
      });
      phase = "anthropic_call";
      const anthropicStart = Date.now();
      const { text, stopReason, inputTokens, outputTokens } =
        await callAnthropicForDestination(destination, destinationCode, isDomestic, month);
      log("INFO", "anthropic ok", {
        phase: "anthropic_ok",
        cacheKey,
        anthropic_ms: Date.now() - anthropicStart,
        stop_reason: stopReason,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
      });

      phase = "json_parse";
      const content = parseDestinationJson(text, stopReason);

      phase = "cache_write";
      await docRef.set(content);
      log("INFO", "served + cached", {
        phase: "served",
        cacheKey,
        total_ms: Date.now() - t0,
      });
      res.json(content);
    } catch (error: any) {
      const msg = error instanceof Error ? error.message : String(error);
      // AbortError comes back from the AbortController-driven timeout
      // inside generateDestinationInfo. Distinguishing it lets the
      // client decide between "retry me" (transient timeout) and a
      // real generation failure.
      const isTimeout =
        error instanceof Error && (error.name === "AbortError" || /aborted/i.test(msg));
      const errorKind = isTimeout
        ? "timeout"
        : phase === "json_parse"
        ? "parse_error"
        : phase === "cache_read"
        ? "firestore_read"
        : phase === "cache_write"
        ? "firestore_write"
        : "anthropic_api";

      // Anthropic SDK errors carry a structured shape — surface what's
      // useful (status code, error.type) so we can filter logs by
      // failure mode without grepping. Other errors just dump message.
      const anthropicStatus =
        typeof error?.status === "number" ? error.status : undefined;
      const anthropicErrorType =
        typeof error?.error?.type === "string" ? error.error.type : undefined;
      const anthropicRequestId =
        typeof error?.requestID === "string" ? error.requestID : undefined;

      log("ERROR", `${errorKind} during ${phase}`, {
        phase,
        error_kind: errorKind,
        cacheKey,
        destination,
        code: destinationCode,
        domestic: isDomestic,
        month,
        elapsed_ms: Date.now() - t0,
        message: msg,
        anthropic_status: anthropicStatus,
        anthropic_error_type: anthropicErrorType,
        anthropic_request_id: anthropicRequestId,
        stack:
          error instanceof Error && error.stack
            ? error.stack.split("\n").slice(0, 8).join("\n")
            : undefined,
      });

      res.status(isTimeout ? 504 : 500).json({
        error: isTimeout
          ? "Generation timed out — please try again"
          : "Failed to generate destination info",
        detail: msg,
        kind: errorKind,
      });
    }
  }
);

// Hard cap for the Anthropic call. The function's `timeoutSeconds` is
// set to 300 in index.ts (5 min) — Anthropic regularly takes 60-90s
// for this prompt shape because it generates ~4000 tokens of dense
// structured JSON serially. We cap our own abort 20s under the
// function timeout so we can log + return a clean 504 with a JSON
// error payload the mobile app can show + retry from, instead of
// letting Cloud Run kill the request abruptly with an empty 504.
//
// History:
//   - The very first version had no cap; Cloud Run's default 60s
//     timeout killed slow requests with empty 504s.
//   - Then 50s — too tight; legitimate Anthropic responses for
//     popular destinations regularly took 60-80s and ALL were
//     timing out. Trevor's Madrid + Mexico City were the canary.
//   - Now 280s — covers the 99th percentile of real Anthropic
//     latencies for this prompt shape with 20s of headroom under
//     the 300s function timeout.
const ANTHROPIC_TIMEOUT_MS = 280_000;

/**
 * Returns the parsed destination JSON plus the metadata the route
 * wants for structured logging (token usage, stop_reason, elapsed
 * time at each step is tracked by the caller).
 *
 * Throws on any failure. The route's catch tags the error with the
 * `phase` it was in when the throw happened — that requires the
 * Anthropic call and the JSON parse to be at the call site, not
 * buried inside this function. Keeping this single-purpose: build
 * prompt, call Anthropic, return raw text + metadata.
 */
async function callAnthropicForDestination(
  destination: string,
  code: string,
  isDomestic: boolean,
  month: string
): Promise<{ text: string; stopReason: string | null; inputTokens: number; outputTokens: number }> {
  const prompt = isDomestic
    ? buildDomesticPrompt(destination, code, month)
    : buildInternationalPrompt(destination, code, month);

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ANTHROPIC_TIMEOUT_MS);

  let message;
  try {
    message = await getClient().messages.create(
      {
        model: "claude-haiku-3-5",
        // Haiku is ~4-5x faster than Sonnet for this use case and
        // produces equivalent quality for structured destination guides
        // (neighborhood lists, restaurant picks, travel tips). Sonnet
        // was taking 8-15s on cold cache; Haiku is typically 2-4s.
        // 6000 tokens retained — Haiku is cheaper so no reason to cut.
        max_tokens: 6000,
        messages: [{ role: "user", content: prompt }],
      },
      { signal: ac.signal }
    );
  } finally {
    clearTimeout(timer);
  }

  const text = (message.content[0] as { type: string; text: string }).text.trim();
  return {
    text,
    stopReason: message.stop_reason ?? null,
    inputTokens: message.usage?.input_tokens ?? 0,
    outputTokens: message.usage?.output_tokens ?? 0,
  };
}

/**
 * Parse Claude's response into the destination guide JSON.
 *
 * Throws if Claude hit the token cap (output is almost certainly
 * incomplete) or if no JSON object can be located in the text. Logs
 * a window around any parse failure so we can see the malformed
 * slice without dumping the whole 10k-char response.
 */
function parseDestinationJson(text: string, stopReason: string | null): Record<string, unknown> {
  // Catch truncation before we get a cryptic JSON.parse error 10k
  // characters in. If Claude hit the token cap, stop_reason will be
  // "max_tokens" and the JSON is almost certainly incomplete.
  if (stopReason === "max_tokens") {
    throw new Error(
      `Claude response truncated at max_tokens; raise the cap (current ${6000})`
    );
  }

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in Claude response");
  try {
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const posMatch = msg.match(/position (\d+)/);
    if (posMatch) {
      const pos = Number(posMatch[1]);
      const start = Math.max(0, pos - 80);
      const end = Math.min(jsonMatch[0].length, pos + 80);
      log("ERROR", "JSON parse window", {
        phase: "json_parse_window",
        parse_position: pos,
        snippet: jsonMatch[0].slice(start, end),
      });
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
