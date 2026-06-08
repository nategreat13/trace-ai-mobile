"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Option = { key: string; label: string; count: number };

/**
 * Multiselect of signup-version cohorts, narrowing ALL analytics on the page.
 *
 * Toggling chips edits a LOCAL draft (instant) — it does NOT re-fetch. The
 * server round-trip (which re-runs every dashboard query) happens once, when
 * the admin clicks "Apply". Selection is persisted in a cookie via
 * `/api/set-cohorts` (survives navigation + sessions, like the env switch);
 * "all selected" clears it. Defaults to all.
 *
 * Primary use: exclude pre-instrumentation cohorts (e.g. "No version") so
 * deal-view / URL-click rates have a fair, cohort-matched denominator.
 */
export default function CohortFilter({
  options,
  selected,
}: {
  options: Option[];
  selected: string[] | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const allKeys = useMemo(() => options.map((o) => o.key), [options]);
  // The selection currently IN EFFECT (from the cookie via props). null = all.
  const applied = useMemo(() => selected ?? allKeys, [selected, allKeys]);
  const appliedKey = applied.join(",");

  // Local draft the chips edit. Re-synced whenever the applied selection
  // changes (e.g. after Apply re-fetches, or env switch).
  const [draft, setDraft] = useState<string[]>(applied);
  useEffect(() => {
    setDraft(appliedKey ? appliedKey.split(",") : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedKey]);

  const draftSet = useMemo(() => new Set(draft), [draft]);
  const dirty = useMemo(() => {
    if (draft.length !== applied.length) return true;
    const a = new Set(applied);
    return draft.some((k) => !a.has(k));
  }, [draft, applied]);
  const allSelected = draft.length === options.length;

  function toggle(key: string) {
    setDraft((d) =>
      d.includes(key) ? d.filter((k) => k !== key) : [...d, key]
    );
  }

  function apply() {
    // "All" (or accidentally none) clears the cookie → no filter. A real
    // subset persists the keys. Apply is disabled for an empty draft, so we
    // never apply "show nothing".
    const isAll = draft.length === options.length;
    fetch("/api/set-cohorts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cohorts: isAll ? [] : draft }),
    })
      .then((r) => {
        if (!r.ok) throw new Error(`set-cohorts failed: ${r.status}`);
        startTransition(() => router.refresh());
      })
      .catch((err) => {
        // eslint-disable-next-line no-alert
        alert(`Failed to update cohorts: ${err?.message ?? err}`);
      });
  }

  if (options.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
      <div className="flex items-center justify-between mb-3 gap-3">
        <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
          Signup-version cohorts
        </div>
        <div className="flex items-center gap-3 text-xs">
          <button
            type="button"
            onClick={() => setDraft(allKeys)}
            disabled={allSelected}
            className="text-gray-500 hover:text-gray-900 disabled:opacity-40"
          >
            Select all
          </button>
          <span className="text-gray-300">·</span>
          <button
            type="button"
            onClick={() => setDraft([])}
            disabled={draft.length === 0}
            className="text-gray-500 hover:text-gray-900 disabled:opacity-40"
          >
            Deselect all
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = draftSet.has(o.key);
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => toggle(o.key)}
              aria-pressed={on}
              className={
                "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors " +
                (on
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-500 border-gray-300 hover:border-gray-400")
              }
            >
              {o.label}{" "}
              <span className={on ? "text-blue-100" : "text-gray-400"}>
                ({o.count.toLocaleString()})
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between mt-3">
        <div className="text-xs text-gray-400">
          {draft.length === 0
            ? "Select at least one cohort, then Apply."
            : allSelected
              ? "All cohorts included."
              : `${draft.length} of ${options.length} cohorts selected.`}
        </div>
        <button
          type="button"
          onClick={apply}
          disabled={!dirty || draft.length === 0 || isPending}
          className={
            "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors " +
            (dirty && draft.length > 0 && !isPending
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "bg-gray-100 text-gray-400 cursor-not-allowed")
          }
        >
          {isPending ? "Applying…" : dirty ? "Apply" : "Applied"}
        </button>
      </div>
    </div>
  );
}
