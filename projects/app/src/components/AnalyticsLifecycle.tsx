import { useEffect, useRef } from "react";
import { AppState, AppStateStatus, Platform } from "react-native";
import { Timestamp, doc, updateDoc } from "firebase/firestore";
import { col } from "@trace/shared";
import { db } from "../services/firebase";
import { logEvent } from "../lib/analytics";
import { getEnv } from "../lib/env";
import { resetSessionId } from "../lib/session";
import { useAuth } from "../context/AuthContext";

/**
 * One-stop analytics lifecycle component. Mounted inside AuthProvider so it
 * can read the current userProfile and mirror activity timestamps.
 *
 * Responsibilities:
 *  - Fire `app_open` on cold launch and on foreground resume after a long
 *    background window (matches the SESSION_TIMEOUT below).
 *  - Reset the analytics `session_id` at the same moments — these are the
 *    only times a "new session" begins by definition.
 *  - Mirror `lastSeenAt` onto the user's profile doc so per-user cohort
 *    queries ("active in last 7d", "dormant 30d") don't have to scan the
 *    events log.
 *
 * Renders nothing.
 */
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // keep in sync with App.tsx old constant

export default function AnalyticsLifecycle() {
  const { profile } = useAuth();
  const profileIdRef = useRef<string | null>(null);
  const lastBackgroundedAtRef = useRef<number | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // Mirror lastSeenAt to the user's profile doc. Fire-and-forget; the user
  // shouldn't see analytics writes affect anything UI-side.
  function mirrorLastSeenAt() {
    const id = profileIdRef.current;
    if (!id) return;
    // Env-aware doc path: staging writes to `staging_userProfiles`.
    updateDoc(doc(db, col(getEnv(), "userProfiles"), id), {
      lastSeenAt: Timestamp.now(),
    }).catch((err) => {
      if (__DEV__) console.warn("[lifecycle] lastSeenAt update failed:", err?.message);
    });
  }

  // Sync the profile-id ref AND mirror lastSeenAt the moment a profile id
  // becomes available. The bare-mount cold-launch handler below runs
  // BEFORE the profile finishes loading (auth + Firestore round-trip take
  // a beat), so a mirror call from there silently no-ops because
  // profileIdRef is still null. Doing the cold-launch mirror here, gated
  // on profile?.id, fixes the never-mirrored bug for users whose only
  // sessions are cold launches with the app left open.
  useEffect(() => {
    profileIdRef.current = profile?.id ?? null;
    if (profile?.id) {
      mirrorLastSeenAt();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  useEffect(() => {
    // Cold launch — already a fresh process, but ensure session id is set
    // and emit the open event. The lastSeenAt mirror happens in the
    // profile-watching effect above (see comment there for why).
    resetSessionId();
    logEvent("app_open", { source: "cold_launch", platform: Platform.OS });

    const handleChange = (next: AppStateStatus) => {
      const prev = appStateRef.current;
      if (prev === "active" && next.match(/inactive|background/)) {
        lastBackgroundedAtRef.current = Date.now();
      } else if (prev.match(/inactive|background/) && next === "active") {
        const backgroundedAt = lastBackgroundedAtRef.current;
        const elapsed = backgroundedAt ? Date.now() - backgroundedAt : Infinity;
        if (elapsed >= SESSION_TIMEOUT_MS) {
          // New session: rotate id BEFORE logging the event so the event
          // is stamped with the new session_id.
          resetSessionId();
          logEvent("app_open", {
            source: "foreground_resume",
            platform: Platform.OS,
            background_duration_ms: backgroundedAt ? elapsed : null,
          });
          mirrorLastSeenAt();
        }
      }
      appStateRef.current = next;
    };

    const sub = AppState.addEventListener("change", handleChange);
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
