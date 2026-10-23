"use client";

import { useEffect, useRef } from "react";

/**
 * Makes the phone's Back (Android button, iOS swipe) close an overlay, like a
 * trip page or the swipe deck, instead of leaving the results. While `open`,
 * the overlay owns a history entry; Back pops it and calls `close`.
 *
 * Closed some other way (its own button), the entry is dropped again so Back
 * isn't needed twice, unless the close also moved somewhere else (the paywall,
 * an earlier question), whose own entry is on top by then.
 */
export function useBackClose(open: boolean, close: () => void) {
  const closeRef = useRef(close);
  closeRef.current = close;

  useEffect(() => {
    if (!open) return;
    const id = Math.random().toString(36).slice(2);
    window.history.pushState({ ...window.history.state, overlay: id }, "");
    let popped = false;
    const onPop = () => {
      popped = true;
      closeRef.current();
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      if (popped) return;
      // After the render that closed it, so a new step's entry is already pushed if there is one.
      window.setTimeout(() => {
        if (window.history.state?.overlay === id) window.history.back();
      }, 0);
    };
  }, [open]);
}
