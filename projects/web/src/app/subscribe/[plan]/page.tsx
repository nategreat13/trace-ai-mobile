"use client";

import { Suspense, useState, useEffect } from "react";
import { useParams, useSearchParams, notFound } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

const PLANS: Record<
  string,
  {
    name: string;
    price: number;
    gradient: string;
    accent: string;
    btnClass: string;
    checkClass: string;
    features: string[];
  }
> = {
  premium: {
    name: "Premium",
    price: 49,
    gradient: "from-red-500 via-rose-500 to-pink-400",
    accent: "text-trace-red",
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
    accent: "text-trace-amber",
    btnClass: "bg-gradient-to-r from-yellow-500 to-amber-500",
    checkClass: "bg-amber-500",
    features: [
      "Everything in Premium",
      "Exclusive deals",
      "White-glove support",
    ],
  },
};

function CheckoutForm({ planId }: { planId: string }) {
  const searchParams = useSearchParams();
  const emailParam = searchParams.get("email");

  const plan = PLANS[planId];
  const stripe = useStripe();
  const elements = useElements();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [zip, setZip] = useState("");

  useEffect(() => {
    if (emailParam) setEmail(emailParam);
  }, [emailParam]);
  const [cardComplete, setCardComplete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const formReady = isValidEmail && name.trim() !== "" && cardComplete && zip.trim() !== "" && !!stripe;

  if (!plan) {
    notFound();
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setError(null);

    try {
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        setError("Card element not ready. Please try again.");
        setLoading(false);
        return;
      }

      const { error: pmError, paymentMethod } =
        await stripe.createPaymentMethod({
          type: "card",
          card: cardElement,
          billing_details: {
            name: name || undefined,
            email,
            address: { postal_code: zip || undefined },
          },
        });

      if (pmError) {
        setError(pmError.message || "Invalid card details.");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethodId: paymentMethod.id,
          email,
          plan: planId,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      window.location.href = `/success?plan=${planId}`;
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-[430px] mx-auto px-4 py-6">
        {/* Hero card */}
        <div
          className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${plan.gradient} px-6 py-7`}
        >
          {/* Decorative circles */}
          <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full bg-white/15" />
          <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-white/10" />

          <div className="relative">
            <div className="flex items-center gap-2 mb-4">
              <svg
                className="w-5 h-5 text-white"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
              <span className="text-sm font-extrabold text-white tracking-wider uppercase">
                Limited Time Offer
              </span>
            </div>
            <h1 className="text-4xl font-black text-white mb-1.5">
              {plan.name}
            </h1>
            <p className="text-white/80 text-base font-medium">
              3 days free &middot; Then ${plan.price}/year
            </p>
          </div>
        </div>

        {/* What you get */}
        <div className="mt-4 rounded-2xl border border-[#2a2a2a] bg-[#141414] px-4 py-3.5">
          <h2 className="text-xs font-black text-white tracking-widest uppercase mb-2.5">
            What you get
          </h2>
          <ul className="space-y-2">
            {plan.features.map((f) => (
              <li key={f} className="flex items-center gap-2.5">
                <span
                  className={`w-5 h-5 rounded-full ${plan.checkClass} flex items-center justify-center shrink-0`}
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

        {/* Billing info */}
        <form onSubmit={handleSubmit} className="mt-6">
          <h2 className="text-xs font-black text-white tracking-widest uppercase mb-3">
            Billing Info
          </h2>

          <div className="space-y-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              readOnly={!!emailParam}
              placeholder="Email"
              className={`w-full px-4 py-3.5 rounded-xl bg-[#1c1c1e] text-white placeholder-gray-500 text-base outline-none focus:ring-2 focus:ring-white/20 ${emailParam ? "opacity-60" : ""}`}
            />

            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className="w-full px-4 py-3.5 rounded-xl bg-[#1c1c1e] text-white placeholder-gray-500 text-base outline-none focus:ring-2 focus:ring-white/20"
            />

            <div className="px-4 py-3.5 rounded-xl bg-[#1c1c1e]">
              <CardElement
                onChange={(e) => setCardComplete(e.complete)}
                options={{
                  style: {
                    base: {
                      fontSize: "16px",
                      color: "#ffffff",
                      "::placeholder": { color: "#6b7280" },
                      iconColor: "#6b7280",
                    },
                  },
                  hidePostalCode: true,
                }}
              />
            </div>

            <input
              type="text"
              inputMode="numeric"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              placeholder="Zip code"
              className="w-full px-4 py-3.5 rounded-xl bg-[#1c1c1e] text-white placeholder-gray-500 text-base outline-none focus:ring-2 focus:ring-white/20"
            />
          </div>

          {/* No charge notice */}
          <div className="mt-4 flex items-start gap-3 rounded-xl bg-[#1c1c1e] px-4 py-3.5">
            <svg
              className="w-5 h-5 text-trace-red shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            <p className="text-sm text-gray-400">
              <span className="text-white font-semibold">
                No charge today.
              </span>{" "}
              We&apos;ll only bill if you keep your subscription active after
              the trial ends.
            </p>
          </div>

          {error && (
            <p className="text-red-500 text-sm text-center mt-3">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !formReady}
            className={`w-full mt-5 py-4 rounded-xl text-base font-bold text-white transition-opacity disabled:opacity-50 ${plan.btnClass}`}
          >
            {loading ? "Processing..." : "Start Free Trial"}
          </button>
        </form>
      </div>
    </main>
  );
}

export default function PlanPage() {
  const { plan } = useParams<{ plan: string }>();

  if (!PLANS[plan]) {
    notFound();
  }

  return (
    <Elements stripe={stripePromise}>
      <Suspense>
        <CheckoutForm planId={plan} />
      </Suspense>
    </Elements>
  );
}
