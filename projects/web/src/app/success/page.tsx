"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";

const APP_SCHEME = "tracetravel://upgrade-success";

function SuccessContent() {
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan") || "premium";

  useEffect(() => {
    const timer = setTimeout(() => {
      window.location.href = `${APP_SCHEME}?plan=${plan}`;
    }, 1500);
    return () => clearTimeout(timer);
  }, [plan]);

  const handleOpenApp = () => {
    window.location.href = `${APP_SCHEME}?plan=${plan}`;
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#0a0a0a] px-6">
      <div className="max-w-[430px] w-full text-center">
        <div className="rounded-3xl border border-[#2a2a2a] bg-[#141414] p-10">
          <Image
            src="/Bluelogo.png"
            alt="Trace"
            width={64}
            height={64}
            className="mx-auto mb-6"
          />
          <h1 className="text-3xl font-black text-white mb-3">
            You&apos;re all set!
          </h1>
          <p className="text-gray-400 mb-2">
            Your <strong className="capitalize text-white">{plan}</strong> plan
            is active with a 3-day free trial.
          </p>
          <p className="text-gray-500 text-sm mb-8">
            Returning you to Trace...
          </p>

          <button
            onClick={handleOpenApp}
            className="w-full rounded-2xl bg-[#e11d48] py-4 text-white font-bold text-base mb-6 hover:bg-[#be123c] transition-colors"
          >
            Open Trace
          </button>

          <div className="rounded-2xl bg-[#1c1c1e] p-6 text-left">
            <h3 className="text-sm font-bold text-gray-300 mb-3">
              What&apos;s next?
            </h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-0.5">&#10003;</span>
                Your premium features are already unlocked
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-0.5">&#10003;</span>
                Start swiping through unlimited deals
              </li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function SuccessPage() {
  return (
    <Suspense>
      <SuccessContent />
    </Suspense>
  );
}
