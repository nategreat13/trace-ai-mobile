import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — Trace",
  description:
    "Terms of Service for Trace, the AI-powered flight deal finder.",
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
      <p className="text-gray-500 mb-10">Last updated: April 15, 2026</p>

      <div className="space-y-8 text-gray-700 leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Agreement to Terms
          </h2>
          <p>
            By downloading, installing, or using the Trace mobile application
            (&quot;App&quot;) operated by Trace Travel Co (&quot;Trace,&quot;
            &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), you agree to be
            bound by these Terms of Service (&quot;Terms&quot;). If you do not
            agree, do not use the App.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Description of Service
          </h2>
          <p>
            Trace is a flight deal discovery app that curates and personalizes
            flight deals based on your preferences. We do not sell airline
            tickets. Deals shown in the App link to third-party airlines and
            booking platforms where you complete your purchase directly.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Accounts</h2>
          <p>
            You may browse deals without an account. Certain features (saving
            deals, setting alerts, and subscribing) require you to create an
            account with a valid email address. You are responsible for
            maintaining the confidentiality of your account credentials.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Subscriptions and Payments
          </h2>
          <p>
            Trace offers optional paid subscription plans (Premium and Business)
            that unlock additional features. Subscriptions are billed through
            Apple&apos;s App Store or Google Play depending on your device.
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>
              Payment is charged to your Apple ID or Google account at
              confirmation of purchase.
            </li>
            <li>
              Subscriptions automatically renew unless canceled at least 24 hours
              before the end of the current period.
            </li>
            <li>
              You can manage or cancel your subscription in your device&apos;s
              subscription settings (Settings &rarr; Subscriptions on iOS, or
              Google Play &rarr; Subscriptions on Android).
            </li>
            <li>
              Refunds are handled by Apple or Google in accordance with their
              refund policies.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Free Trials
          </h2>
          <p>
            We may offer a free trial period for new subscribers. If you do not
            cancel before the trial ends, your subscription will automatically
            convert to a paid subscription at the listed price. Free trial
            eligibility is determined by Apple or Google and is limited to one
            trial per Apple ID or Google account.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Deal Accuracy
          </h2>
          <p>
            Flight deals displayed in the App are sourced from third-party data
            providers and may change at any time. We do not guarantee the
            accuracy, availability, or pricing of any deal. Always verify the
            price and availability on the airline or booking platform before
            purchasing.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Acceptable Use
          </h2>
          <p>You agree not to:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>
              Use the App for any unlawful purpose or in violation of any
              applicable laws
            </li>
            <li>
              Attempt to reverse-engineer, decompile, or disassemble the App
            </li>
            <li>
              Scrape, crawl, or collect data from the App by automated means
            </li>
            <li>
              Interfere with or disrupt the App&apos;s servers or networks
            </li>
            <li>Impersonate another person or entity</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Intellectual Property
          </h2>
          <p>
            All content, features, and functionality of the App (including text,
            graphics, logos, and software) are the property of Trace Travel Co
            and are protected by copyright and other intellectual property laws.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Limitation of Liability
          </h2>
          <p>
            To the fullest extent permitted by law, Trace Travel Co shall not be
            liable for any indirect, incidental, special, consequential, or
            punitive damages arising from your use of the App. Our total
            liability shall not exceed the amount you paid us in the 12 months
            preceding the claim.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Disclaimer of Warranties
          </h2>
          <p>
            The App is provided &quot;as is&quot; and &quot;as available&quot;
            without warranties of any kind, whether express or implied. We do
            not warrant that the App will be uninterrupted, error-free, or free
            of harmful components.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Termination
          </h2>
          <p>
            We may suspend or terminate your access to the App at our discretion,
            with or without notice, for conduct that we believe violates these
            Terms or is harmful to other users or the App. You may delete your
            account at any time from the Profile screen in the App.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Changes to These Terms
          </h2>
          <p>
            We may update these Terms from time to time. We will notify you of
            significant changes through the App or by email. Continued use of
            the App after changes constitutes acceptance of the updated Terms.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Governing Law
          </h2>
          <p>
            These Terms shall be governed by and construed in accordance with the
            laws of the United States, without regard to conflict of law
            principles.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Contact Us
          </h2>
          <p>
            If you have questions about these Terms, contact us at{" "}
            <a
              href="mailto:contact@tracetravel.co"
              className="text-rose-500 underline"
            >
              contact@tracetravel.co
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
