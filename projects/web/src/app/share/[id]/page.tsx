"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

const APP_STORE_URL = "https://apps.apple.com/us/app/trace-travel/id6760838076";

/**
 * Share redirect page — publicly accessible, no auth required.
 *
 * Immediately tries to open the deep link in the Trace app. If the app
 * isn't installed the browser stays on this page, so after 1.5s we
 * redirect to the App Store instead.
 *
 * URL: https://subscribe.tracetravel.co/share/<shareId>
 * Deep link: tracetravel://share/<shareId>
 */
export default function ShareRedirectPage() {
  const { id } = useParams<{ id: string }>();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!id) return;

    // Attempt to hand off to the native app
    window.location.href = `tracetravel://share/${id}`;

    // If the app isn't installed the page stays open — redirect to the
    // App Store after a short delay so the user can get it.
    const timer = setTimeout(() => {
      setTimedOut(true);
      window.location.href = APP_STORE_URL;
    }, 1500);

    return () => clearTimeout(timer);
  }, [id]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 bg-white">
      <img
        src="/icon.png"
        alt="Trace"
        width={72}
        height={72}
        className="rounded-2xl shadow-md"
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {timedOut ? "Get Trace" : "Opening Trace…"}
        </h1>
        <p className="text-gray-500 text-sm">
          {timedOut
            ? "Looks like you don't have the app yet. Redirecting to the App Store…"
            : "You're being redirected to the deal in the app."}
        </p>
      </div>

      {/* Fallback button in case the JS redirect doesn't fire fast enough */}
      <a
        href={APP_STORE_URL}
        className="mt-2 inline-block rounded-xl bg-rose-500 px-8 py-3 text-white font-semibold"
      >
        Download Trace
      </a>
    </main>
  );
}
