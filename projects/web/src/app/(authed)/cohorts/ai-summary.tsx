"use client";

import { useState, useTransition } from "react";
import { generateCohortSummary } from "./actions";

export default function CohortAiSummary() {
  const [isPending, startTransition] = useTransition();
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    startTransition(async () => {
      const result = await generateCohortSummary();
      if (result.ok) {
        setSummary(result.summary);
      } else {
        setSummary(null);
        setError(result.error);
      }
    });
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">AI summary</h2>
          <p className="text-xs text-gray-500">
            Have Claude read the table above and summarize what stands out.
          </p>
        </div>
        <button
          onClick={run}
          disabled={isPending}
          className={
            "shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors " +
            (isPending
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : "bg-rose-600 text-white hover:bg-rose-700")
          }
        >
          {isPending ? "Analyzing…" : summary ? "Regenerate" : "Generate AI summary"}
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {summary && (
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800 border-t border-gray-100 pt-3">
          {summary}
        </div>
      )}
    </div>
  );
}
