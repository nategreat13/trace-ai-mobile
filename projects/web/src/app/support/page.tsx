import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Support — Trace",
  description: "Get help with Trace, the AI-powered flight deal finder.",
};

export default function SupportPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-md text-center">
        <h1 className="text-3xl font-bold mb-4">Support</h1>
        <p className="text-gray-600 mb-6">
          Need help? Have questions or feedback? Reach out and we'll get back to
          you as soon as possible.
        </p>
        <a
          href="mailto:contact@tracetravel.co"
          className="inline-block rounded-xl bg-rose-500 px-8 py-3 text-white font-semibold hover:bg-rose-600 transition-colors"
        >
          contact@tracetravel.co
        </a>
      </div>
    </main>
  );
}
