"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePoints } from "./store";
import { pickSynced, type MeResponse } from "./sync";

/** Where the email address waits between "send link" and opening it, as Firebase recommends. */
export const PENDING_EMAIL_KEY = "trace-points:signin-email";

interface Account {
  /** Signed-in email, null when signed out, undefined while checking. */
  email: string | null | undefined;
  /** Signed in with Google or an email link, not just from checkout. */
  verified: boolean;
  /** Has a Points password, so they can sign in on other devices with it. */
  hasPassword: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<Account | null>(null);

/**
 * Trades a Firebase ID token (Google or email link) for a Points session,
 * then signs out of Firebase: Points keeps its own session.
 */
export async function exchangeIdToken(idToken: string): Promise<{ email: string; moved: boolean }> {
  const r = await fetch("/api/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken }) });
  const j = (await r.json()) as { email?: string; moved?: boolean; error?: string };
  if (!r.ok || !j.email) throw new Error(j.error || "That sign-in didn't work. Try again.");
  return { email: j.email, moved: !!j.moved };
}

/** "Continue with Google": a Google popup, then a Points session for that verified email. */
export async function signInWithGoogle(): Promise<{ email: string; moved: boolean }> {
  const [{ GoogleAuthProvider, signInWithPopup, signOut }, { firebaseAuth }] = await Promise.all([import("firebase/auth"), import("./firebaseClient")]);
  const auth = firebaseAuth();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    const cred = await signInWithPopup(auth, provider);
    return await exchangeIdToken(await cred.user.getIdToken());
  } catch (e) {
    const code = (e as { code?: string }).code ?? "";
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") throw new Error("");
    if (code === "auth/popup-blocked") throw new Error("Your browser blocked the Google window. Allow pop-ups and try again.");
    throw new Error((e as Error).message && !code ? (e as Error).message : "Google sign-in isn't available right now. Use the email link instead.");
  } finally {
    await signOut(auth).catch(() => {});
  }
}

async function postJson(url: string, method: string, body: object): Promise<{ email?: string }> {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = (await r.json().catch(() => ({}))) as { email?: string; error?: string };
  if (!r.ok) throw new Error(j.error || "Something went wrong. Try again.");
  return j;
}

/** Puts a password on the signed-in account (new or changed). */
export async function setPassword(password: string) {
  await postJson("/api/password", "PUT", { password });
}

/** Email + password sign-in. Starts a Points session; call refresh() after. */
export async function signInWithPassword(email: string, password: string): Promise<string> {
  const j = await postJson("/api/password", "POST", { email: email.trim(), password });
  return j.email ?? email.trim().toLowerCase();
}

/** A strong password in Safari's style (xxxxxx-xxxxxx-xxxxxx), easy to read back. */
export function suggestPassword(): string {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const pick = new Uint32Array(18);
  crypto.getRandomValues(pick);
  const s = Array.from(pick, (n) => chars[n % chars.length]).join("");
  return `${s.slice(0, 6)}-${s.slice(6, 12)}-${s.slice(12)}`;
}

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
  const [verified, setVerified] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);
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
        setVerified(false);
        setHasPassword(false);
        return;
      }
      const local = stateRef.current;
      // A gift claimed on this device (popup or ad link) is yearly; a saved plan doesn't undo it.
      if (me.state) update({ ...me.state, email: me.email, ...(local.gift ? { plan: "annual" as const } : {}) });
      else {
        update({ email: me.email });
        await save({ ...local, email: me.email });
      }
      // Membership follows Stripe. A test-mode trial (no Stripe keys) stays local.
      if (me.member) update({ member: me.member });
      else if (local.member && !local.member.testMode) update({ member: null });
      setEmail(me.email);
      setVerified(!!me.verified);
      setHasPassword(!!me.hasPassword);
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
    setVerified(false);
    setHasPassword(false);
  }, []);

  const value = useMemo(() => ({ email, verified, hasPassword, refresh, signOut }), [email, verified, hasPassword, refresh, signOut]);
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
