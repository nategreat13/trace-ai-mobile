"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePoints } from "./store";
import { pickSynced, type MeResponse } from "./sync";

/** Where the email address waits between "send link" and opening it, as Firebase recommends. */
export const PENDING_EMAIL_KEY = "trace-points:signin-email";

interface Account {
  /** Signed-in email, null when signed out, undefined while checking. */
  email: string | null | undefined;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<Account | null>(null);

/** Emails a sign-in link that opens /signin/finish. Firebase loads only here, keeping it off the landing page. */
export async function sendSignInLink(email: string) {
  const [{ sendSignInLinkToEmail }, { firebaseAuth }] = await Promise.all([import("firebase/auth"), import("./firebaseClient")]);
  await sendSignInLinkToEmail(firebaseAuth(), email, { url: `${window.location.origin}/signin/finish`, handleCodeInApp: true });
  try {
    localStorage.setItem(PENDING_EMAIL_KEY, email);
  } catch {
    // The finish page asks for the email again.
  }
}

/**
 * Keeps the device and the account in step. On load, a signed-in device
 * takes its saved state and membership from the server (the account wins);
 * after that, changes save back a moment after they happen.
 */
export function AccountProvider({ children }: { children: React.ReactNode }) {
  const { state, update, ready } = usePoints();
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  const loaded = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/me", { cache: "no-store" });
      if (!r.ok) {
        setEmail(null);
        return;
      }
      const me = (await r.json()) as MeResponse;
      if (!me.email) {
        setEmail(null);
        return;
      }
      const local = stateRef.current;
      if (me.state) update({ ...me.state, email: me.email });
      else {
        update({ email: me.email });
        await save({ ...local, email: me.email });
      }
      // Membership follows Stripe. A test-mode trial (no Stripe keys) stays local.
      if (me.member) update({ member: me.member });
      else if (local.member && !local.member.testMode) update({ member: null });
      setEmail(me.email);
    } catch {
      setEmail(null);
    } finally {
      loaded.current = true;
    }
  }, [update]);

  useEffect(() => {
    if (ready) refresh();
  }, [ready, refresh]);

  // Save synced changes back, debounced.
  const synced = JSON.stringify(pickSynced(state));
  useEffect(() => {
    if (!email || !loaded.current) return;
    const t = setTimeout(() => save(stateRef.current), 1200);
    return () => clearTimeout(t);
  }, [synced, email]);

  const signOut = useCallback(async () => {
    await fetch("/api/me", { method: "DELETE" });
    setEmail(null);
  }, []);

  const value = useMemo(() => ({ email, refresh, signOut }), [email, refresh, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

async function save(s: Parameters<typeof pickSynced>[0]) {
  try {
    await fetch("/api/me", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state: pickSynced(s) }) });
  } catch {
    // Offline: the next change saves everything again.
  }
}

export function useAccount() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAccount outside AccountProvider");
  return c;
}
