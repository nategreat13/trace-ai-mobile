"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { TraceEnv } from "@trace/shared";

/**
 * Two-button env toggle. Compact, lives in the header strip alongside
 * the tab nav and sign-out button. Posts to `/admin/api/set-env`
 * which sets a cookie and revalidates the admin layout so all server
 * components re-render against the new env.
 *
 * Active env is highlighted; staging gets a warning color so it's
 * visually unmissable when active.
 */
export default function EnvSwitch({ env }: { env: TraceEnv }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<TraceEnv>(env);

  function switchTo(next: TraceEnv) {
    if (next === optimistic || isPending) return;
    setOptimistic(next);
    fetch("/api/set-env", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ env: next }),
    })
      .then((r) => {
        if (!r.ok) throw new Error(`set-env failed: ${r.status}`);
        startTransition(() => router.refresh());
      })
      .catch((err) => {
        // Roll back optimistic state if the request failed
        setOptimistic(env);
        // eslint-disable-next-line no-alert
        alert(`Failed to switch env: ${err?.message ?? err}`);
      });
  }

  return (
    <div className="inline-flex items-center rounded-lg border border-gray-300 overflow-hidden shrink-0">
      <button
        type="button"
        onClick={() => switchTo("prod")}
        className={
          "px-3 py-1.5 text-xs font-semibold transition-colors " +
          (optimistic === "prod"
            ? "bg-blue-600 text-white"
            : "bg-white text-gray-600 hover:bg-gray-50")
        }
        disabled={isPending}
        aria-pressed={optimistic === "prod"}
      >
        PROD
      </button>
      <button
        type="button"
        onClick={() => switchTo("staging")}
        className={
          "px-3 py-1.5 text-xs font-semibold transition-colors border-l border-gray-300 " +
          (optimistic === "staging"
            ? "bg-amber-500 text-white"
            : "bg-white text-gray-600 hover:bg-gray-50")
        }
        disabled={isPending}
        aria-pressed={optimistic === "staging"}
      >
        STAGING
      </button>
    </div>
  );
}
