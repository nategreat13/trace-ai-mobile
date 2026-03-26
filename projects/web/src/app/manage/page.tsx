"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";

const PLANS: Record<
  string,
  {
    name: string;
    price: number;
    gradient: string;
    btnClass: string;
    checkClass: string;
    features: string[];
  }
> = {
  premium: {
    name: "Premium",
    price: 49,
    gradient: "from-red-500 via-rose-500 to-pink-400",
    btnClass: "bg-gradient-to-r from-red-500 to-rose-500",
    checkClass: "bg-trace-red",
    features: [
      "Unlimited swipes",
      "Unlimited saved deals",
      "Full Explore access",
      "Deal alerts",
    ],
  },
  business: {
    name: "Business Class",
    price: 139,
    gradient: "from-yellow-400 via-amber-500 to-orange-600",
    btnClass: "bg-gradient-to-r from-yellow-500 to-amber-500",
    checkClass: "bg-amber-500",
    features: [
      "Everything in Premium",
      "Exclusive deals",
      "White-glove support",
    ],
  },
};

function ManageContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";

  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [prorationPreview, setProrationPreview] = useState<{
    charge: number;
    credit: number;
    periodEnd: string | null;
  } | null>(null);
  const [previewingPlan, setPreviewingPlan] = useState<string | null>(null);

  // Fetch current plan
  useEffect(() => {
    if (!email) {
      setLoading(false);
      return;
    }
    // Use the preview endpoint with the same plan to get current info
    // Or we can just try both and see which one says "already on this plan"
    fetch("/api/preview-switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, plan: "business" }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error === "Already on this plan") {
          setCurrentPlan("business");
        } else if (data.currentPlan) {
          setCurrentPlan(data.currentPlan);
        } else {
          // Try with premium
          return fetch("/api/preview-switch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, plan: "premium" }),
          })
            .then((r) => r.json())
            .then((d) => {
              if (d.error === "Already on this plan") {
                setCurrentPlan("premium");
              } else if (d.currentPlan) {
                setCurrentPlan(d.currentPlan);
              }
            });
        }
      })
      .catch(() => setError("Failed to load subscription info."))
      .finally(() => setLoading(false));
  }, [email]);

  const handlePreview = async (plan: string) => {
    setPreviewingPlan(plan);
    setProrationPreview(null);
    setError(null);
    try {
      const res = await fetch("/api/preview-switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, plan }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to preview.");
        setPreviewingPlan(null);
        return;
      }
      setProrationPreview({
        charge: data.charge,
        credit: data.credit,
        periodEnd: data.periodEnd,
      });
    } catch {
      setError("Something went wrong.");
      setPreviewingPlan(null);
    }
  };

  const handleSwitch = async () => {
    if (!previewingPlan) return;
    setSwitching(true);
    setError(null);
    try {
      const res = await fetch("/api/switch-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, plan: previewingPlan }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to switch plan.");
      } else {
        setDone("switched");
        setCurrentPlan(previewingPlan);
        setPreviewingPlan(null);
        setProrationPreview(null);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSwitching(false);
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    setError(null);
    try {
      const res = await fetch("/api/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to cancel.");
      } else {
        setDone("cancelled");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setCancelling(false);
    }
  };

  if (!email) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#0a0a0a] px-6">
        <p className="text-gray-400">Missing email parameter.</p>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </main>
    );
  }

  if (done === "switched") {
    const plan = PLANS[currentPlan || "premium"];
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
              Plan Updated!
            </h1>
            <p className="text-gray-400 mb-2">
              You&apos;re now on the{" "}
              <strong className="text-white">{plan?.name}</strong> plan.
              {prorationPreview?.charge
                ? ` You'll be charged $${(prorationPreview.charge / 100).toFixed(2)} for the prorated difference.`
                : ""}
            </p>
            <p className="text-gray-500 text-sm mt-4">
              Close this page to return to Trace.
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (done === "cancelled") {
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
              Subscription Cancelled
            </h1>
            <p className="text-gray-400 mb-2">
              You&apos;ll keep access to premium features until the end of your
              current billing period.
            </p>
            <p className="text-gray-500 text-sm mt-4">
              Close this page to return to Trace.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const otherPlanId =
    currentPlan === "business" ? "premium" : "business";
  const otherPlan = PLANS[otherPlanId];
  const currentPlanInfo = PLANS[currentPlan || "premium"];

  return (
    <main className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-[430px] mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Image
            src="/Bluelogo.png"
            alt="Trace"
            width={36}
            height={36}
          />
          <h1 className="text-xl font-black text-white">Manage Plan</h1>
        </div>

        {/* Current plan card */}
        {currentPlanInfo && (
          <div
            className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${currentPlanInfo.gradient} px-6 py-5 mb-4`}
          >
            <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full bg-white/15" />
            <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-white/10" />
            <div className="relative">
              <p className="text-xs font-bold text-white/70 uppercase tracking-wider mb-1">
                Current Plan
              </p>
              <h2 className="text-2xl font-black text-white">
                {currentPlanInfo.name}
              </h2>
              <p className="text-white/80 text-sm font-medium">
                ${currentPlanInfo.price}/year
              </p>
            </div>
          </div>
        )}

        {/* Current plan features */}
        {currentPlanInfo && (
          <div className="rounded-2xl border border-[#2a2a2a] bg-[#141414] px-4 py-3.5 mb-4">
            <ul className="space-y-2">
              {currentPlanInfo.features.map((f) => (
                <li key={f} className="flex items-center gap-2.5">
                  <span
                    className={`w-5 h-5 rounded-full ${currentPlanInfo.checkClass} flex items-center justify-center shrink-0`}
                  >
                    <svg
                      className="w-3 h-3 text-white"
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
                  </span>
                  <span className="text-sm text-white font-medium">{f}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Switch plan section */}
        {otherPlan && (
          <div className="rounded-2xl border border-[#2a2a2a] bg-[#141414] p-5 mb-4">
            <h3 className="text-xs font-black text-white tracking-widest uppercase mb-3">
              {otherPlanId === "business"
                ? "Upgrade to Business"
                : "Switch to Premium"}
            </h3>
            <p className="text-sm text-gray-400 mb-3">
              {otherPlan.name} &middot; ${otherPlan.price}/year
            </p>
            <ul className="space-y-2 mb-4">
              {otherPlan.features.map((f) => (
                <li key={f} className="flex items-center gap-2.5">
                  <span
                    className={`w-5 h-5 rounded-full ${otherPlan.checkClass} flex items-center justify-center shrink-0`}
                  >
                    <svg
                      className="w-3 h-3 text-white"
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
                  </span>
                  <span className="text-sm text-gray-300 font-medium">{f}</span>
                </li>
              ))}
            </ul>

            {/* Proration preview */}
            {prorationPreview && previewingPlan === otherPlanId && (
              <div className="rounded-xl bg-[#1c1c1e] px-4 py-3.5 mb-4">
                <p className="text-sm text-gray-400">
                  {prorationPreview.charge > 0 ? (
                    <>
                      You&apos;ll be charged{" "}
                      <span className="text-white font-semibold">
                        ${(prorationPreview.charge / 100).toFixed(2)}
                      </span>{" "}
                      today (prorated for the rest of your billing period).
                    </>
                  ) : prorationPreview.credit > 0 ? (
                    <>
                      You&apos;ll receive a{" "}
                      <span className="text-white font-semibold">
                        ${(prorationPreview.credit / 100).toFixed(2)}
                      </span>{" "}
                      credit toward your next bill.
                    </>
                  ) : (
                    <>No additional charge for this billing period.</>
                  )}
                </p>
              </div>
            )}

            {!prorationPreview || previewingPlan !== otherPlanId ? (
              <button
                onClick={() => handlePreview(otherPlanId)}
                disabled={previewingPlan !== null}
                className={`w-full py-3.5 rounded-xl text-sm font-bold text-white transition-opacity disabled:opacity-50 ${otherPlan.btnClass}`}
              >
                {previewingPlan === otherPlanId
                  ? "Loading..."
                  : otherPlanId === "business"
                    ? "Upgrade to Business"
                    : "Switch to Premium"}
              </button>
            ) : (
              <button
                onClick={handleSwitch}
                disabled={switching}
                className={`w-full py-3.5 rounded-xl text-sm font-bold text-white transition-opacity disabled:opacity-50 ${otherPlan.btnClass}`}
              >
                {switching ? "Switching..." : "Confirm Switch"}
              </button>
            )}
          </div>
        )}

        {error && (
          <p className="text-red-500 text-sm text-center mb-4">{error}</p>
        )}

        {/* Cancel */}
        <button
          onClick={handleCancel}
          disabled={cancelling}
          className="w-full py-3 text-sm text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-50"
        >
          {cancelling ? "Cancelling..." : "Cancel Subscription"}
        </button>
      </div>
    </main>
  );
}

export default function ManagePage() {
  return (
    <Suspense>
      <ManageContent />
    </Suspense>
  );
}
