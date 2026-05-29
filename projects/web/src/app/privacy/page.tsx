import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Trace",
  description: "Privacy policy for Trace, the AI-powered flight deal finder.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-gray-500 mb-10">Last updated: May 29, 2026</p>

      <div className="space-y-8 text-gray-700 leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Introduction
          </h2>
          <p>
            Trace Travel Co (&quot;Trace,&quot; &quot;we,&quot; &quot;us,&quot;
            or &quot;our&quot;) operates the Trace mobile application and
            website at tracetravel.co. This Privacy Policy explains what
            information we collect, how we use it, and your choices regarding
            your data.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Information We Collect
          </h2>

          <h3 className="font-semibold text-gray-900 mt-4 mb-1">
            Account Information
          </h3>
          <p>
            When you create an account, we collect your email address and name.
            You may optionally upload a profile photo.
          </p>

          <h3 className="font-semibold text-gray-900 mt-4 mb-1">
            Travel Preferences
          </h3>
          <p>
            We collect your home airport, destination preferences (domestic,
            international, or both), preferred deal types (e.g., family, luxury,
            adventure, budget), and travel timeframe to personalize your deal
            feed.
          </p>

          <h3 className="font-semibold text-gray-900 mt-4 mb-1">
            Usage Data
          </h3>
          <p>
            We collect information about how you interact with the app,
            including deals you swipe on, deals you save, deal alerts you
            create, and engagement metrics such as streaks, badges, and your
            Deal Hunter level.
          </p>

          <h3 className="font-semibold text-gray-900 mt-4 mb-1">
            Payment Information
          </h3>
          <p>
            Subscriptions are processed through Apple&apos;s App Store or Google
            Play. We store your subscription status but never see or store your
            payment method details. Payment information is handled entirely by
            Apple or Google in accordance with their respective privacy policies.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Information We Do Not Collect
          </h2>
          <p>
            We do not collect your precise location or GPS data, contacts,
            browsing history outside the app, health data, or phone number. We
            do not request access to Apple&apos;s cross-app advertising
            identifier (IDFA), and we do not show the iOS App Tracking
            Transparency prompt — this means our advertising partners cannot
            link your activity in Trace to your activity in other apps you use.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            How We Use Your Information
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Personalize your flight deal feed based on your preferences and
              swipe history
            </li>
            <li>Display and manage your saved deals and deal alerts</li>
            <li>Track your progress through badges, levels, and streaks</li>
            <li>Process and manage your subscription</li>
            <li>Provide customer support</li>
            <li>Improve the app experience</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Third-Party Services
          </h2>
          <p>We use the following third-party services:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>
              <strong>Firebase</strong> (Google) — authentication, database, and
              file storage
            </li>
            <li>
              <strong>RevenueCat</strong> — subscription management
            </li>
            <li>
              <strong>Expo</strong> — app updates and delivery
            </li>
            <li>
              <strong>Meta Platforms (Facebook)</strong> — advertising
              measurement and attribution. See the &quot;Advertising and
              Analytics&quot; section below for details on what is shared.
            </li>
          </ul>
          <p className="mt-2">
            These services may process your data in accordance with their own
            privacy policies. We do not sell your personal data. We do share
            limited, primarily anonymous or hashed information with Meta
            Platforms to measure how effective our advertising campaigns are —
            described in detail below.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Advertising and Analytics
          </h2>
          <p>
            We run advertising campaigns on platforms such as Facebook and
            Instagram to reach people who would benefit from Trace. To measure
            how effective those campaigns are and to improve them over time, we
            share a limited amount of information with Meta Platforms, Inc.:
          </p>
          <ul className="list-disc pl-5 space-y-2 mt-3">
            <li>
              <strong>From your device</strong> (collected by the Meta SDK
              integrated into the Trace app): an anonymous Meta-generated
              identifier scoped to this app install (sometimes called{" "}
              <code className="text-xs">_fbp</code>), app event signals such as
              when you first install or open the app, and diagnostic data such
              as crash reports from the Meta SDK itself. This identifier is not
              shared with other apps you use.
            </li>
            <li>
              <strong>From our server</strong> (when you sign up or complete
              onboarding): hashed copies of your email address, first name, last
              name, and two-letter country code, along with your IP address and
              browser/device user-agent string at the moment you signed up.
              These are sent to Meta&apos;s Conversions API so Meta can
              statistically match your sign-up to an ad you may have seen,
              without us exposing the underlying values. Hashing converts the
              original value into a one-way fingerprint that cannot be reversed.
            </li>
          </ul>
          <p className="mt-3">
            We do <strong>not</strong> enable Apple&apos;s App Tracking
            Transparency prompt or read Apple&apos;s IDFA, which means Meta
            cannot link your activity in Trace to your activity in other apps.
          </p>
          <p className="mt-3">
            Meta processes the information we share according to its own data
            policy, available at{" "}
            <a
              href="https://www.facebook.com/policy.php"
              className="text-rose-500 underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              facebook.com/policy.php
            </a>
            . You can manage how Meta uses information about you in your
            Facebook or Instagram account&apos;s ad preferences. If you delete
            your Trace account, our server stops sending information about you
            to Meta.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Data Storage and Security
          </h2>
          <p>
            Your data is stored in Firebase (Google Cloud) and transmitted over
            encrypted HTTPS connections. We implement reasonable security
            measures to protect your information, but no method of transmission
            or storage is 100% secure.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Data Retention and Deletion
          </h2>
          <p>
            We retain your data for as long as your account is active. You can
            delete your account at any time from the app&apos;s profile screen.
            When you delete your account, we remove your profile, swipe history,
            saved deals, and deal alerts. Apple or Google may retain billing
            records in accordance with their policies.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Children&apos;s Privacy
          </h2>
          <p>
            Trace is not directed at children under 13. We do not knowingly
            collect information from children under 13. If you believe we have
            collected data from a child, please contact us and we will delete it
            promptly.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Your Rights
          </h2>
          <p>You have the right to:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Access the personal data we hold about you</li>
            <li>Request correction of inaccurate data</li>
            <li>Delete your account and associated data</li>
            <li>Export your data upon request</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Changes to This Policy
          </h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify
            you of significant changes through the app or by email.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Contact Us
          </h2>
          <p>
            If you have questions about this Privacy Policy or your data, contact
            us at{" "}
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
