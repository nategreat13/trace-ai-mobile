"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

const APP_STORE_URL = "https://apps.apple.com/us/app/trace-travel/id6760838076";
const PROD_API = "https://api-7l7vojyykq-uc.a.run.app";

interface ShareData {
  sharerName: string;
  dealSnapshot: {
    destination: string;
    price: number;
    original_price?: number;
    discount_pct?: number;
    image_url?: string;
    travel_window?: string;
    airlines?: string;
  };
}

/**
 * Share redirect page — publicly accessible, no auth required.
 *
 * Fetches the share record so we can show the sender's name and deal info.
 * Immediately tries to open the deep link in the Trace app. If the app
 * isn't installed the browser stays on this page; after 1.5s we redirect
 * to the App Store instead.
 */
export default function ShareRedirectPage() {
  const { id } = useParams<{ id: string }>();
  const [shareData, setShareData] = useState<ShareData | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // Fetch share record to show sender name + deal info
  useEffect(() => {
    if (!id) return;
    fetch(`${PROD_API}/share-deal/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setShareData(data))
      .catch(() => setLoadError(true));
  }, [id]);

  // Attempt deep link + App Store fallback
  useEffect(() => {
    if (!id) return;
    window.location.href = `tracetravel://share/${id}`;
    const timer = setTimeout(() => {
      setTimedOut(true);
      window.location.href = APP_STORE_URL;
    }, 1500);
    return () => clearTimeout(timer);
  }, [id]);

  const deal = shareData?.dealSnapshot;
  const senderName = shareData?.sharerName;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-0 bg-white">
      {/* Deal image header */}
      {deal?.image_url ? (
        <div className="relative w-full max-w-md h-56 overflow-hidden">
          <img
            src={deal.image_url}
            alt={deal.destination}
            className="w-full h-full object-cover"
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          {/* Destination + price on image */}
          <div className="absolute bottom-4 left-4 right-4">
            <p className="text-white text-2xl font-black leading-tight">{deal.destination}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-white text-xl font-bold">${deal.price}</span>
              {deal.original_price && deal.original_price > deal.price && (
                <span className="text-white/60 text-sm line-through">${deal.original_price}</span>
              )}
              {deal.discount_pct && deal.discount_pct > 0 ? (
                <span className="bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {deal.discount_pct}% OFF
                </span>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        /* No image yet (loading or missing) — show placeholder */
        <div className="w-full max-w-md h-32 bg-gradient-to-br from-rose-500 to-pink-600" />
      )}

      {/* Content card */}
      <div className="w-full max-w-md bg-white px-6 pt-5 pb-8 flex flex-col items-center gap-4">
        {/* Logo + sender message */}
        <div className="flex flex-col items-center gap-2 text-center">
          <img
            src="/icon.png"
            alt="Trace"
            width={48}
            height={48}
            className="rounded-xl shadow-sm"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          {senderName ? (
            <p className="text-gray-800 text-base font-semibold">
              {senderName} found you a deal ✈️
            </p>
          ) : loadError ? (
            <p className="text-gray-500 text-sm">Deal shared via Trace</p>
          ) : (
            <p className="text-gray-400 text-sm">Loading…</p>
          )}
        </div>

        {/* Travel window / airline chips */}
        {deal && (deal.travel_window || deal.airlines) && (
          <div className="flex gap-2 flex-wrap justify-center">
            {deal.travel_window && (
              <span className="bg-gray-100 text-gray-600 text-xs font-medium px-3 py-1 rounded-full">
                📅 {deal.travel_window}
              </span>
            )}
            {deal.airlines && (
              <span className="bg-gray-100 text-gray-600 text-xs font-medium px-3 py-1 rounded-full">
                ✈️ {deal.airlines}
              </span>
            )}
          </div>
        )}

        {/* Status message */}
        <p className="text-gray-500 text-sm text-center">
          {timedOut
            ? "Looks like you don't have the app yet. Redirecting to the App Store…"
            : "Opening deal in Trace…"}
        </p>

        {/* CTA buttons */}
        <a
          href={APP_STORE_URL}
          className="w-full text-center rounded-xl bg-rose-500 px-8 py-3 text-white font-semibold text-sm"
        >
          {timedOut ? "Download Trace" : "Get the App"}
        </a>

        <a
          href={`tracetravel://share/${id}`}
          className="text-rose-500 text-sm font-medium"
        >
          Already have Trace? Open the deal →
        </a>
      </div>
    </main>
  );
}
