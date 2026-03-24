import Image from "next/image";
import Link from "next/link";

const features = [
  {
    icon: "✈️",
    title: "Unlimited Swipes",
    desc: "Swipe through hundreds of deals daily — no limits.",
  },
  {
    icon: "🔍",
    title: "Full Explore",
    desc: "Browse, filter, and search every deal we find.",
  },
  {
    icon: "🔔",
    title: "Deal Alerts",
    desc: "Get notified the moment a deal drops for your routes.",
  },
  {
    icon: "👑",
    title: "Business Class Deals",
    desc: "Exclusive fares that regular users never see.",
  },
];

const steps = [
  { num: "1", title: "Swipe", desc: "Swipe through AI-curated flight deals tailored to you." },
  { num: "2", title: "Save", desc: "Save the ones you love. We'll track prices for you." },
  { num: "3", title: "Book", desc: "Book directly with airlines at the lowest price." },
];

export default function HomePage() {
  return (
    <main className="min-h-screen">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          <Image src="/Bluelogo.png" alt="Trace" width={36} height={36} />
          <span className="text-xl font-extrabold">Trace</span>
        </div>
        <Link
          href="/subscribe"
          className="bg-trace-red text-white px-5 py-2.5 rounded-full text-sm font-bold hover:opacity-90 transition-opacity"
        >
          Get Started
        </Link>
      </nav>

      {/* Hero */}
      <section className="text-center px-6 pt-20 pb-24 max-w-3xl mx-auto">
        <h1 className="text-5xl sm:text-6xl font-black tracking-tight leading-tight mb-6">
          Fly Business.
          <br />
          <span className="text-trace-red">Pay Economy.</span>
        </h1>
        <p className="text-lg text-gray-500 max-w-xl mx-auto mb-10">
          Trace uses AI to find incredible flight deals — including business
          class fares at a fraction of the normal price. Start your 3-day free
          trial today.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/subscribe?plan=premium"
            className="bg-trace-red text-white px-8 py-4 rounded-2xl text-lg font-bold hover:opacity-90 transition-opacity"
          >
            Start Free Trial
          </Link>
          <Link
            href="/subscribe"
            className="border-2 border-gray-200 text-gray-700 px-8 py-4 rounded-2xl text-lg font-bold hover:border-gray-300 transition-colors"
          >
            View Plans
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="bg-gray-50 px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-black text-center mb-12">
            Everything you need to fly for less
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f) => (
              <div
                key={f.title}
                className="bg-white rounded-2xl p-6 border border-gray-100"
              >
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="text-lg font-bold mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-black text-center mb-12">
            How it works
          </h2>
          <div className="grid sm:grid-cols-3 gap-8">
            {steps.map((s) => (
              <div key={s.num} className="text-center">
                <div className="w-14 h-14 rounded-full bg-trace-red text-white text-2xl font-black flex items-center justify-center mx-auto mb-4">
                  {s.num}
                </div>
                <h3 className="text-xl font-bold mb-2">{s.title}</h3>
                <p className="text-sm text-gray-500">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing preview */}
      <section className="bg-gray-50 px-6 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-black mb-4">Simple pricing</h2>
          <p className="text-gray-500 mb-12">
            Both plans include a 3-day free trial. Cancel anytime.
          </p>
          <div className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl p-8 border border-gray-200">
              <h3 className="text-xl font-bold mb-1">Premium</h3>
              <div className="text-4xl font-black mb-1">
                $49<span className="text-lg font-normal text-gray-400">/yr</span>
              </div>
              <p className="text-sm text-gray-400 mb-6">3-day free trial</p>
              <Link
                href="/subscribe?plan=premium"
                className="block w-full bg-trace-red text-white py-3 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity"
              >
                Start Free Trial
              </Link>
            </div>
            <div className="bg-white rounded-2xl p-8 border-2 border-trace-amber relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-trace-amber text-white text-xs font-bold px-3 py-1 rounded-full">
                BEST VALUE
              </div>
              <h3 className="text-xl font-bold mb-1">Business</h3>
              <div className="text-4xl font-black mb-1">
                $139<span className="text-lg font-normal text-gray-400">/yr</span>
              </div>
              <p className="text-sm text-gray-400 mb-6">3-day free trial</p>
              <Link
                href="/subscribe?plan=business"
                className="block w-full bg-trace-amber text-white py-3 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity"
              >
                Start Free Trial
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-12 border-t border-gray-100">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Image src="/Bluelogo.png" alt="Trace" width={24} height={24} />
            <span className="font-bold text-sm text-gray-500">
              Trace Travel
            </span>
          </div>
          <p className="text-xs text-gray-400">
            &copy; {new Date().getFullYear()} Trace Travel. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}
