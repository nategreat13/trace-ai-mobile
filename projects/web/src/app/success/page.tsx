"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

function SuccessContent() {
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan") || "premium";

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <div className="max-w-md w-full text-center">
        <div className="bg-white rounded-3xl p-10 border border-gray-100 shadow-sm">
          <Image
            src="/Bluelogo.png"
            alt="Trace"
            width={64}
            height={64}
            className="mx-auto mb-6"
          />
          <h1 className="text-3xl font-black mb-3">You&apos;re all set!</h1>
          <p className="text-gray-500 mb-2">
            Your <strong className="capitalize">{plan}</strong> plan is active
            with a 3-day free trial.
          </p>
          <p className="text-gray-400 text-sm mb-8">
            Open the Trace app to start exploring deals.
          </p>

          <div className="bg-gray-50 rounded-2xl p-6 mb-8 text-left">
            <h3 className="text-sm font-bold text-gray-700 mb-3">
              What&apos;s next?
            </h3>
            <ul className="space-y-2 text-sm text-gray-500">
              <li className="flex items-start gap-2">
                <span className="text-trace-green mt-0.5">&#10003;</span>
                Open the Trace app on your phone
              </li>
              <li className="flex items-start gap-2">
                <span className="text-trace-green mt-0.5">&#10003;</span>
                Your premium features are already unlocked
              </li>
              <li className="flex items-start gap-2">
                <span className="text-trace-green mt-0.5">&#10003;</span>
                Start swiping through unlimited deals
              </li>
            </ul>
          </div>

          <Link
            href="/"
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            Back to tracetravel.co
          </Link>
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
