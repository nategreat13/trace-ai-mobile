"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { track } from "@/lib/analytics";
import { usePoints } from "@/lib/store";

/**
 * Records a page_view on every page and a step_view each time the funnel on
 * "/" shows a new step, so /admin can see where people stop: a step someone
 * opened but never finished. Nothing is recorded on /admin itself.
 */
export function AnalyticsBeacon() {
  const path = usePathname();
  const { state, ready } = usePoints();

  useEffect(() => {
    if (!path.startsWith("/admin")) track("page_view");
  }, [path]);

  useEffect(() => {
    if (ready && path === "/" && !state.member) track("step_view", { step: state.step });
  }, [ready, path, state.step, state.member]);

  return null;
}
