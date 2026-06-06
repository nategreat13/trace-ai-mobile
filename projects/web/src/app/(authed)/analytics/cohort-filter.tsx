"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

type Option = { key: string; label: string; count: number };

/**
 * Multiselect of signup-version cohorts. Toggling chips narrows ALL analytics
 * on the page to the selected cohorts (event numerators + user-count
 * denominators). Selection lives in the URL (`?cohorts=k1,k2`); "all selected"
 * clears the param. Defaults to all.
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

  // null selection = every cohort included.
  const included = selected ?? options.map((o) => o.key);
  const allIncluded = included.length === options.length;

  function apply(keys: string[]) {
    // All (or none → snaps back to all) clears the param for a clean URL.
    const isAll = keys.length === options.length || keys.length === 0;
    const qs = isAll ? "" : `?cohorts=${encodeURIComponent(keys.join(","))}`;
    startTransition(() => router.push(`/analytics${qs}`));
  }

  function toggle(key: string) {
    const set = new Set(included);
    if (set.has(key)) set.delete(key);
    else set.add(key);
    apply([...set]);
  }

  if (options.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
          Signup-version cohorts
        </div>
        <button
          type="button"
          onClick={() => apply(options.map((o) => o.key))}
          disabled={allIncluded || isPending}
          className="text-xs text-gray-500 hover:text-gray-900 disabled:opacity-40"
        >
          Reset (all)
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = included.includes(o.key);
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => toggle(o.key)}
              disabled={isPending}
              aria-pressed={on}
              className={
                "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors disabled:opacity-60 " +
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
      {!allIncluded && (
        <div className="text-xs text-gray-400 mt-2">
          All analytics below are filtered to {included.length} of{" "}
          {options.length} cohorts.
        </div>
      )}
    </div>
  );
}
