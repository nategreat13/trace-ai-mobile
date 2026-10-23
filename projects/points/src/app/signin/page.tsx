"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Check, Icon, ICONS, Logo, PrimaryButton } from "@/components/ui";
import { GoogleG } from "@/components/SignInOptions";
import { sendSignInLink, signInWithGoogle, useAccount } from "@/lib/account";
import { usePoints } from "@/lib/store";

/** Sign in with an emailed link. No passwords. */
export default function SignInPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh" />}>
      <SignIn />
    </Suspense>
  );
}

function SignIn() {
  const { state, ready } = usePoints();
  const { verified, refresh } = useAccount();
  const router = useRouter();
  const prefill = useSearchParams().get("email") ?? "";
  const [email, setEmail] = useState(prefill);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (ready) setEmail((e) => e || state.email);
  }, [ready, state.email]);
  // Already verified here: nothing to do. (A checkout-only session still gets to verify.)
  useEffect(() => {
    if (verified) router.replace(state.member ? "/discover" : "/");
  }, [verified, state.member, router]);

  const google = async () => {
    setError("");
    try {
      await signInWithGoogle();
      await refresh();
      const me = await fetch("/api/me", { cache: "no-store" }).then((x) => x.json());
      router.replace(me.member ? "/discover" : "/");
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const valid = /.+@.+\..+/.test(email.trim());
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError("");
    try {
      await sendSignInLink(email.trim());
      setSent(true);
    } catch {
      setError("We couldn't send the link. Check the address and try again.");
    } finally {
      setBusy(false);
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
            <p className="text-[15px] leading-snug text-muted">Use Google, or the email you started your trial with. No password needed.</p>
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
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="min-h-[52px] rounded-2xl border border-line bg-surface px-4 text-[16px] outline-none focus:border-trace-red"
            />
          </label>
          {error && <p role="alert" className="text-[14px] font-semibold text-trace-red">{error}</p>}
          <PrimaryButton type="submit" disabled={!valid || busy}>
            {busy ? "Sending…" : "Email me a sign-in link"}
          </PrimaryButton>
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
