"use client";

import { useState } from "react";
import { sendSignInLink, signInWithGoogle, useAccount } from "@/lib/account";
import { cx, Icon, ICONS } from "./ui";

export const GoogleG = () => (
  <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z" />
    <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
  </svg>
);

/**
 * The two ways in: Google (one tap) or an emailed link. No passwords.
 * `email` prefills the link (the checkout email after a trial starts).
 */
export function SignInOptions({
  email,
  dark,
  onSignedIn,
  onLinkSent,
}: {
  email?: string;
  dark?: boolean;
  onSignedIn: (email: string, moved: boolean) => void;
  onLinkSent?: (email: string) => void;
}) {
  const { refresh } = useAccount();
  const [busy, setBusy] = useState<"google" | "link" | null>(null);
  const [error, setError] = useState("");
  const [typed, setTyped] = useState(email ?? "");
  const [sentTo, setSentTo] = useState("");
  const address = (email || typed).trim();
  const valid = /.+@.+\..+/.test(address);

  const google = async () => {
    setBusy("google");
    setError("");
    try {
      const r = await signInWithGoogle();
      await refresh();
      onSignedIn(r.email, r.moved);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const link = async () => {
    if (!valid) return;
    setBusy("link");
    setError("");
    try {
      await sendSignInLink(address);
      setSentTo(address);
      onLinkSent?.(address);
    } catch {
      setError("We couldn't send the link. Check the address and try again.");
    } finally {
      setBusy(null);
    }
  };

  if (sentTo) {
    return (
      <div className={cx("rise flex items-start gap-3 rounded-2xl p-4 text-left", dark ? "bg-white/10" : "bg-soft")}>
        <span className="bg-trace flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white">
          <Icon d={ICONS.mail} size={18} />
        </span>
        <span className="flex flex-col leading-snug">
          <span className="text-[15.5px] font-extrabold">Check your email</span>
          <span className={cx("text-[14px]", dark ? "text-white/80" : "text-muted")}>
            We sent a sign-in link to <span className="font-bold">{sentTo}</span>. Open it on this device. It can land in spam.
          </span>
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <button
        type="button"
        onClick={google}
        disabled={!!busy}
        className="flex min-h-[54px] items-center justify-center gap-3 rounded-2xl bg-white text-[16px] font-bold text-[#1F1F1F] shadow-[0_1px_0_rgba(0,0,0,0.06)] ring-1 ring-black/10 active:scale-[0.98] disabled:opacity-60"
      >
        <GoogleG />
        {busy === "google" ? "Connecting…" : "Continue with Google"}
      </button>
      {!email && (
        <input
          type="email"
          autoComplete="email"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="you@example.com"
          aria-label="Email"
          className="min-h-[52px] rounded-2xl border border-line bg-surface px-4 text-[16px] text-ink outline-none focus:border-trace-red"
        />
      )}
      <button
        type="button"
        onClick={link}
        disabled={!!busy || !valid}
        className={cx(
          "flex min-h-[54px] items-center justify-center gap-2.5 rounded-2xl text-[16px] font-bold active:scale-[0.98] disabled:opacity-50",
          dark ? "bg-white/12 text-white ring-1 ring-white/25" : "bg-ink text-surface",
        )}
      >
        <Icon d={ICONS.mail} size={18} />
        {busy === "link" ? "Sending…" : "Email me a sign-in link"}
      </button>
      {email && <p className={cx("-mt-1 truncate text-center text-[12.5px]", dark ? "text-white/70" : "text-muted")}>We'll send it to {email}</p>}
      {error && <p role="alert" className={cx("text-[14px] font-semibold", dark ? "text-[#FFB4B4]" : "text-trace-red")}>{error}</p>}
    </div>
  );
}
