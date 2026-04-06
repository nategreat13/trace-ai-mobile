import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Delete Account — Trace",
  description:
    "Learn how to delete your Trace account and all associated data.",
};

export default function DeleteAccountPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold mb-2">Delete Your Account</h1>
      <p className="text-gray-500 mb-10">
        We're sorry to see you go. Here's how to delete your Trace account and
        what happens when you do.
      </p>

      <div className="space-y-8 text-gray-700 leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            How to Delete Your Account
          </h2>
          <p className="mb-3">
            You can delete your account directly from the Trace app:
          </p>
          <ol className="list-decimal pl-5 space-y-2">
            <li>Open the Trace app and go to your <strong>Profile</strong> tab</li>
            <li>Scroll to the bottom and tap <strong>Delete Account</strong></li>
            <li>Confirm the deletion when prompted</li>
          </ol>
          <p className="mt-3">Your account and all associated data will be deleted immediately.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            What Gets Deleted
          </h2>
          <p>When you delete your account, we permanently remove:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Your profile and email address</li>
            <li>Travel preferences (home airport, destination type, deal types, timeframe)</li>
            <li>All swipe history</li>
            <li>All saved flight deals</li>
            <li>All deal alerts</li>
            <li>Your profile photo (if uploaded)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            What We Cannot Delete
          </h2>
          <p>
            If you have an active subscription, Stripe may retain billing records
            as required by law. Please{" "}
            <a
              href="mailto:contact@tracetravel.co"
              className="text-rose-500 underline"
            >
              contact us
            </a>{" "}
            if you need help canceling your subscription before deleting your
            account.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Can't Access the App?
          </h2>
          <p>
            If you're unable to delete your account from the app, email us at{" "}
            <a
              href="mailto:contact@tracetravel.co"
              className="text-rose-500 underline"
            >
              contact@tracetravel.co
            </a>{" "}
            from the email address associated with your account and we'll process
            the deletion for you.
          </p>
        </section>
      </div>
    </main>
  );
}
