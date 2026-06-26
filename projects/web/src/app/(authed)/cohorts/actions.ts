"use server";

import Anthropic from "@anthropic-ai/sdk";
import { getAdminEnv } from "@/lib/env";
import { getExcludedSets } from "@/lib/exclusions";
import {
  getCohortEventMatrix,
  type CohortEventMatrix,
} from "@/lib/analytics-queries";

/**
 * Renders the cohort matrix as a compact text table the model can read, with
 * each cell as "users (pct%)". Stages are grouped so the funnel order is
 * obvious. Kept terse to control input tokens.
 */
function matrixToText(m: CohortEventMatrix): string {
  const header = ["Step", ...m.cohorts.map((c) => `${c.label} (n=${c.size})`)].join(" | ");
  const lines = [header, "---"];
  let stage = "";
  for (const row of m.rows) {
    if (row.stage !== stage) {
      stage = row.stage;
      lines.push(`# ${stage}`);
    }
    const cells = m.cohorts.map((c) => {
      const users = row.byCohort[c.key] ?? 0;
      const pct = c.size ? Math.round((users / c.size) * 1000) / 10 : 0;
      return `${users} (${pct}%)`;
    });
    lines.push([row.label, ...cells].join(" | "));
  }
  return lines.join("\n");
}

const SYSTEM = `You are a product analytics assistant for Trace, a flight-deal mobile app. You are given a per-cohort event funnel: rows are user-journey steps (in funnel order, grouped by stage), columns are signup-version cohorts (newest first). Each cell is the count of distinct users from that cohort who fired that event, with that count as a percentage of the cohort's signups.

Write a tight, skimmable summary for the founder. Cover:
- The headline story: where conversion/engagement is improving or regressing across versions.
- The biggest drop-off points in the funnel.
- Anything notable per stage (activation, engagement, paywall/purchase, notifications).

Rules:
- Use ONLY the numbers given. Do not invent metrics or external context.
- Newer cohorts are younger and still maturing — call this out when their later-stage numbers look low; do not treat an immature cohort's low purchase/retention as a regression.
- Flag small sample sizes (single-digit counts) as directional, not conclusive.
- Be concrete: cite the actual numbers. Lead with the takeaway. Use short bullets, no preamble.`;

export async function generateCohortSummary(): Promise<
  { ok: true; summary: string } | { ok: false; error: string }
> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      ok: false,
      error:
        "ANTHROPIC_API_KEY is not set on this deployment. Add it in Vercel env to enable AI summaries.",
    };
  }

  try {
    const env = await getAdminEnv();
    const excluded = await getExcludedSets(env).catch(() => ({
      userIds: new Set<string>(),
      emails: new Set<string>(),
    }));
    const matrix = await getCohortEventMatrix(env, excluded);
    if (matrix.cohorts.length === 0) {
      return { ok: false, error: "No cohort data available to summarize." };
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1500,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Environment: ${env}. Cohort event funnel:\n\n${matrixToText(matrix)}`,
        },
      ],
    });

    const summary = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    if (!summary) return { ok: false, error: "Model returned no text." };
    return { ok: true, summary };
  } catch (err) {
    const message =
      err instanceof Anthropic.APIError
        ? `Claude API error ${err.status ?? ""}: ${err.message}`
        : err instanceof Error
          ? err.message
          : "Unknown error generating summary.";
    console.error("[cohorts] generateCohortSummary failed:", err);
    return { ok: false, error: message };
  }
}
