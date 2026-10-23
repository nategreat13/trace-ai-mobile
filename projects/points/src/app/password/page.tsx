"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PasswordCreate } from "@/components/SignInOptions";
import { Check, Logo, PrimaryButton } from "@/components/ui";
import { useAccount } from "@/lib/account";

/** Set or change the password on the signed-in account. Signed out goes to sign-in. */
export default function PasswordPage() {
  const { email, hasPassword } = useAccount();
  const router = useRouter();
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (email === null) router.replace("/signin");
  }, [email, router]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col px-5 pt-4 pb-10">
      <Link href="/account" aria-label="Back to account" className="self-start py-2">
        <Logo className="h-5" />
      </Link>
      {done ? (
        <div className="rise flex flex-1 flex-col items-center justify-center gap-4 pb-20 text-center">
          <span className="check-in flex h-16 w-16 items-center justify-center rounded-3xl bg-trace-green text-white">
            <Check size={28} />
          </span>
          <h1 className="text-[28px] font-black">Password saved</h1>
          <p className="max-w-[310px] text-[15.5px] leading-snug text-muted">Sign in with {email} and this password on any device.</p>
          <PrimaryButton onClick={() => router.replace("/account")} className="w-full max-w-[310px]">
            Done
          </PrimaryButton>
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-5 pt-10">
          <div className="flex flex-col gap-1">
            <h1 className="text-[30px] leading-tight font-black">{hasPassword ? "Change your password" : "Create a password"}</h1>
            <p className="text-[15px] leading-snug text-muted">So you can sign in to Trace Points on any device.</p>
          </div>
          {email && <PasswordCreate email={email} cta="Save password" onDone={() => setDone(true)} />}
        </div>
      )}
    </div>
  );
}
