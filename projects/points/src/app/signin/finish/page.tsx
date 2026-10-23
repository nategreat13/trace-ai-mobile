"use client";

import { isSignInWithEmailLink, signInWithEmailLink, signOut } from "firebase/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon, ICONS, PrimaryButton } from "@/components/ui";
import { PENDING_EMAIL_KEY, useAccount } from "@/lib/account";
import { firebaseAuth } from "@/lib/firebaseClient";
import { usePoints } from "@/lib/store";

/**
 * Where the emailed link lands. Firebase confirms the link, we trade its ID
 * token for a Points session, then sign out of Firebase again (Points keeps
 * its own session).
 */
export default function SignInFinishPage() {
  const { ready } = usePoints();
  const { refresh } = useAccount();
  const router = useRouter();
  const [needEmail, setNeedEmail] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const started = useRef(false);

  const finish = async (address: string) => {
    setError("");
    try {
      const auth = firebaseAuth();
      const cred = await signInWithEmailLink(auth, address, window.location.href);
      const idToken = await cred.user.getIdToken();
      const r = await fetch("/api/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken }) });
      await signOut(auth);
      if (!r.ok) throw new Error(((await r.json()) as { error?: string }).error);
      try {
        localStorage.removeItem(PENDING_EMAIL_KEY);
      } catch {}
      await refresh();
      // The account decides: members go to Discover, everyone else back to their results.
      const me = await fetch("/api/me", { cache: "no-store" }).then((x) => x.json());
      router.replace(me.member ? "/discover" : "/");
    } catch (e) {
      setError((e as Error).message || "That link didn't work. It may have expired, so request a new one.");
    }
  };

  useEffect(() => {
    if (!ready || started.current) return;
    started.current = true;
    if (!isSignInWithEmailLink(firebaseAuth(), window.location.href)) {
      setError("That sign-in link isn't valid. Request a new one.");
      return;
    }
    let saved = "";
    try {
      saved = localStorage.getItem(PENDING_EMAIL_KEY) ?? "";
    } catch {}
    if (saved) finish(saved);
    else setNeedEmail(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col items-center justify-center gap-4 px-8 text-center">
      {error ? (
        <>
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-near-bg text-near">
            <Icon d={ICONS.info} size={26} />
          </span>
          <h1 className="text-[24px] font-extrabold">Couldn&apos;t sign you in</h1>
          <p className="text-[15px] text-muted">{error}</p>
          <Link href="/signin" className="bg-trace mt-2 rounded-2xl px-6 py-3.5 font-extrabold text-white">
            Send a new link
          </Link>
        </>
      ) : needEmail ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setNeedEmail(false);
            finish(email.trim());
          }}
          className="flex w-full flex-col gap-4"
        >
          <h1 className="text-[24px] font-extrabold">Confirm your email</h1>
          <p className="text-[15px] text-muted">You opened the link on a different device. Type the email you used to sign in.</p>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="min-h-[52px] rounded-2xl border border-line bg-surface px-4 text-[16px] outline-none focus:border-trace-red"
          />
          <PrimaryButton type="submit" disabled={!/.+@.+\..+/.test(email)}>
            Sign in
          </PrimaryButton>
        </form>
      ) : (
        <>
          <span className="pulse-soft text-trace-pink">
            <Icon d={ICONS.plane} size={44} stroke={1.6} />
          </span>
          <h1 className="text-[24px] font-extrabold">Signing you in…</h1>
        </>
      )}
    </div>
  );
}
