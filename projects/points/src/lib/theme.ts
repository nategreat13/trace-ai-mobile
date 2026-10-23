"use client";

import { useCallback, useEffect, useState } from "react";

export type ThemePref = "system" | "light" | "dark";
import { THEME_KEY as KEY } from "./themeScript";

function apply(pref: ThemePref) {
  const dark = pref === "dark" || (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

export function useTheme(): [ThemePref, (p: ThemePref) => void] {
  const [pref, setPref] = useState<ThemePref>("system");
  useEffect(() => {
    try {
      setPref((localStorage.getItem(KEY) as ThemePref) || "system");
    } catch {
      // Storage blocked: stay on the system setting.
    }
  }, []);
  const set = useCallback((p: ThemePref) => {
    setPref(p);
    try {
      localStorage.setItem(KEY, p);
    } catch {
      // Still applies for this visit.
    }
    apply(p);
  }, []);
  return [pref, set];
}
