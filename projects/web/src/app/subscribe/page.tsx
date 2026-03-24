"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

const plans = [
  {
    id: "premium",
    name: "Premium",
    price: 49,
    color: "trace-red",
    features: [
      "Unlimited swipes",
      "Unlimited saved deals",
      "Full Explore access",
      "Deal alerts",
    ],
  },
  {
    id: "business",
    name: "Business",
    price: 139,
    badge: "BEST VALUE",
    color: "trace-amber",
    features: [
      "Everything in Premium",
      "Business class deals",
      "48h early access",
      "VIP support",
    ],
  },
];

function SubscribeContent() {
  const searchParams = useSearchParams();
  const planParam = searchParams.get("plan");
  const emailParam = searchParams.get("email");

  const [selected, setSelected] = useState(planParam === "business" ? "business" : "premium");
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: selected, email: emailParam }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert("Something went wrong. Please try again.");
        setLoading(false);
      }
    } catch {
      alert("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/Bluelogo.png" alt="Trace" width={36} height={36} />
          <span className="text-xl font-extrabold">Trace</span>
        </Link>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-black mb-3">Choose your plan</h1>
          <p className="text-gray-500">
            Both plans include a <strong>3-day free trial</strong>. Cancel
            anytime.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-6 mb-8">
          {plans.map((plan) => {
            const isSelected = selected === plan.id;
            const borderColor =
              plan.id === "business" ? "border-trace-amber" : "border-trace-red";

            return (
              <button
                key={plan.id}
                onClick={() => setSelected(plan.id)}
                className={`relative bg-white rounded-2xl p-8 border-2 text-left transition-all cursor-pointer ${
                  isSelected ? borderColor : "border-gray-200"
                }`}
              >
                {plan.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-trace-amber text-white text-xs font-bold px-3 py-1 rounded-full">
                    {plan.badge}
                  </span>
                )}

                {/* Selection indicator */}
                <div
                  className={`absolute top-4 right-4 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                    isSelected
                      ? plan.id === "business"
                        ? "border-trace-amber bg-trace-amber"
                        : "border-trace-red bg-trace-red"
                      : "border-gray-300"
                  }`}
                >
                  {isSelected && (
                    <svg
                      className="w-3.5 h-3.5 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </div>

                <h2 className="text-2xl font-bold mb-1">{plan.name}</h2>
                <div className="text-4xl font-black mb-1">
                  ${plan.price}
                  <span className="text-lg font-normal text-gray-400">
                    /yr
                  </span>
                </div>
                <p className="text-sm text-gray-400 mb-6">3-day free trial</p>
                <ul className="space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-3 text-sm">
                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-xs ${
                          plan.id === "business"
                            ? "bg-trace-amber"
                            : "bg-trace-red"
                        }`}
                      >
                        &#10003;
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>

        <button
          onClick={handleSubscribe}
          disabled={loading}
          className={`w-full py-4 rounded-2xl text-lg font-bold text-white transition-opacity cursor-pointer disabled:opacity-50 ${
            selected === "business" ? "bg-trace-amber" : "bg-trace-red"
          }`}
        >
          {loading
            ? "Redirecting to checkout..."
            : `Start Free Trial — ${selected === "business" ? "Business" : "Premium"}`}
        </button>

        <p className="text-center text-xs text-gray-400 mt-4">
          You won&apos;t be charged during your 3-day trial. Cancel anytime.
        </p>
      </div>
    </main>
  );
}

export default function SubscribePage() {
  return (
    <Suspense>
      <SubscribeContent />
    </Suspense>
  );
}
