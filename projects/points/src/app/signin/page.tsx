"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Check, Icon, ICONS, Logo, PrimaryButton } from "@/components/ui";
import { GoogleG } from "@/components/SignInOptions";
import { sendSignInLink, signInWithGoogle, signInWithPassword, useAccount } from "@/lib/account";
import { usePoints } from "@/lib/store";

/** Sign in with Google, email and password, or an emailed link (also the way back in after a forgotten password). */
export default function SignInPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh" />}>
      <SignIn />
    </Suspense>
  );
}

function SignIn() {
  const { state, ready } = usePoints();
  const { verified, hasPassword, refresh } = useAccount();
  const router = useRouter();
  const prefill = useSearchParams().get("email") ?? "";
  const [email, setEmail] = useState(prefill);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"password" | "link" | null>(null);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (ready) setEmail((e) => e || state.email);
  }, [ready, state.email]);
  // Already signed in properly here: nothing to do. (A checkout-only session still gets to sign in.)
  useEffect(() => {
    if (verified || hasPassword) router.replace(state.member ? "/discover" : "/");
  }, [verified, hasPassword, state.member, router]);

  const goIn = async () => {
    await refresh();
    const me = await fetch("/api/me", { cache: "no-store" }).then((x) => x.json());
    router.replace(me.member ? "/discover" : "/");
  };

  const google = async () => {
    setError("");
    try {
      await signInWithGoogle();
      await goIn();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const valid = /.+@.+\..+/.test(email.trim());
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || !password || busy) return;
    setBusy("password");
    setError("");
    try {
      await signInWithPassword(email, password);
      await goIn();
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  };
  const link = async () => {
    if (!valid || busy) return;
    setBusy("link");
    setError("");
    try {
      await sendSignInLink(email.trim());
      setSent(true);
    } catch {
      setError("We couldn't send the link. Check the address and try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col px-5 pt-4 pb-10">
      <Link href="/" aria-label="Trace Points home" className="self-start py-2">
        <Logo className="h-5" />
      </Link>
      {sent ? (
        <div className="rise flex flex-1 flex-col items-center justify-center gap-4 pb-20 text-center">
          <span className="check-in bg-trace flex h-16 w-16 items-center justify-center rounded-3xl text-white">
            <Icon d={ICONS.mail} size={28} stroke={2.2} />
          </span>
          <h1 className="text-[28px] font-black">Check your email</h1>
          <p className="max-w-[310px] text-[15.5px] leading-snug text-muted">
            We sent a sign-in link to <span className="font-bold text-ink">{email.trim()}</span>. Open it on this device. It may take a minute, and it can land in spam.
          </p>
          <button type="button" onClick={() => setSent(false)} className="min-h-[44px] text-[14.5px] font-bold text-muted">
            Use a different email
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-1 flex-col gap-5 pt-10">
          <div className="flex flex-col gap-1">
            <h1 className="text-[30px] leading-tight font-black">Sign in</h1>
            <p className="text-[15px] leading-snug text-muted">Use Google, or the email you started your trial with.</p>
          </div>
          <button
            type="button"
            onClick={google}
            className="flex min-h-[54px] items-center justify-center gap-3 rounded-2xl bg-white text-[16px] font-bold text-[#1F1F1F] ring-1 ring-black/10 active:scale-[0.98]"
          >
            <GoogleG /> Continue with Google
          </button>
          <div className="flex items-center gap-3 text-[12.5px] font-semibold text-muted">
            <span className="h-px flex-1 bg-line" /> or use your email <span className="h-px flex-1 bg-line" />
          </div>
          <label className="flex flex-col gap-2">
            <span className="text-[14px] font-bold">Email</span>
            <input
              type="email"
              name="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="min-h-[52px] rounded-2xl border border-line bg-surface px-4 text-[16px] outline-none focus:border-trace-red"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-[14px] font-bold">Password</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="min-h-[52px] rounded-2xl border border-line bg-surface px-4 text-[16px] outline-none focus:border-trace-red"
            />
          </label>
          {error && <p role="alert" className="text-[14px] font-semibold text-trace-red">{error}</p>}
          <PrimaryButton type="submit" disabled={!valid || !password || !!busy}>
            {busy === "password" ? "Signing in…" : "Sign in"}
          </PrimaryButton>
          <button type="button" onClick={link} disabled={!valid || !!busy} className="-mt-1 min-h-[44px] text-[14.5px] font-bold text-muted disabled:opacity-50">
            {busy === "link" ? "Sending…" : "Forgot it? Email me a sign-in link"}
          </button>
          <p className="flex items-center justify-center gap-1.5 text-[13px] text-muted">
            <Check size={12} /> Your trips, points and membership on every device
          </p>
          <div className="flex-1" />
          <p className="text-center text-[13.5px] text-muted">
            New here?{" "}
            <Link href="/" className="font-bold text-ink">
              See what your points can book
            </Link>
          </p>
        </form>
      )}
    </div>
  );
}
