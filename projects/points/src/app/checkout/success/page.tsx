"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Icon, ICONS } from "@/components/ui";
import { sendSignInLink, useAccount } from "@/lib/account";
import { verifyCheckout } from "@/lib/payments";
import { usePoints } from "@/lib/store";

/** Checkout lands here once the card is on the trial (or after a bank check redirect). Verify, then unlock. */
export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh" />}>
      <Confirm />
    </Suspense>
  );
}

function Confirm() {
  const { update, ready } = usePoints();
  const { refresh } = useAccount();
  const router = useRouter();
  const subscription = useSearchParams().get("subscription");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!ready) return;
    if (!subscription) {
      setError("We couldn't find your checkout.");
      return;
    }
    verifyCheckout(subscription)
      .then(async ({ member, email, signedIn }) => {
        update({ member, step: "done", ...(email ? { email } : {}) });
        // New accounts are signed in already. An existing account gets an
        // email link so its saved trips sync here too.
        if (signedIn) await refresh();
        else if (email) await sendSignInLink(email).catch(() => {});
        router.replace("/");
      })
      .catch((e: Error) => setError(e.message));
  }, [ready, subscription, update, router, refresh]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-8 text-center">
      {error ? (
        <>
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-near-bg text-near">
            <Icon d={ICONS.info} size={26} />
          </span>
          <h1 className="text-[24px] font-extrabold">We couldn&apos;t confirm your trial</h1>
          <p className="text-[15px] text-muted">{error} If you were charged, contact support and we&apos;ll sort it out.</p>
          <Link href="/checkout" className="bg-trace mt-2 rounded-2xl px-6 py-3.5 font-extrabold text-white">Try again</Link>
        </>
      ) : (
        <>
          <span className="pulse-soft text-trace-pink"><Icon d={ICONS.plane} size={44} stroke={1.6} /></span>
          <h1 className="text-[24px] font-extrabold">Confirming your membership…</h1>
        </>
      )}
    </div>
  );
}
