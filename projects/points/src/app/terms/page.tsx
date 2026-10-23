import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Terms of service · Trace Points" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of service" updated="October 23, 2026">
      <p>
        These terms cover your use of Trace Points, run by Trace Travel (&ldquo;Trace&rdquo;, &ldquo;we&rdquo;). By using Trace Points or starting a trial, you agree to them.
      </p>

      <h2>What Trace Points does</h2>
      <p>
        Trace Points shows which flights your credit card points and airline miles can likely book, based on the balances you enter, published award charts and typical saver prices. We don&apos;t book flights, hold your points, or access your accounts.
      </p>

      <h2>Estimates, not guarantees</h2>
      <ul>
        <li>Award prices, taxes and fees, transfer ratios, transfer bonuses and seat availability are set by airlines and banks and change often. What we show are estimates, and a trip we list may not be available on the dates you want.</li>
        <li>Point transfers to airlines usually can&apos;t be undone. Always confirm the seat is available in the airline&apos;s own search before transferring points. You decide whether and when to transfer, and you&apos;re responsible for those decisions.</li>
        <li>Seat checks, trip requests and watch lists are answered by our team as quickly as we can, usually within 24 hours, but we can&apos;t promise seats will be available.</li>
      </ul>

      <h2>Trials, billing and cancelling</h2>
      <ul>
        <li>Membership starts with a 7-day free trial. You add a card at checkout; you aren&apos;t charged during the trial.</li>
        <li>
          <strong>Unless you cancel before the trial ends, your membership renews automatically</strong> and your card is charged $99 per year (annual plan), $12 per month (monthly plan), or the discounted yearly price shown at checkout if you claimed an offer, plus any applicable tax, at the start of each period until you cancel.
        </li>
        <li>We&apos;ll email you a reminder before your trial ends.</li>
        <li>Cancel anytime in the app under Account. Cancelling stops future charges; you keep access until the end of the period you&apos;ve paid for.</li>
        <li>
          Money-back guarantee: if you&apos;re charged and don&apos;t want to keep your membership, <Link href="/contact?from=terms">contact us</Link> within 14 days of the charge and we&apos;ll refund it in full.
        </li>
        <li>If we change prices, we&apos;ll tell you by email before the change applies to your next renewal.</li>
      </ul>

      <h2>Your account</h2>
      <p>
        Keep your email up to date and don&apos;t share your sign-in links. Membership is for personal use. We may suspend accounts that abuse the service, such as scraping or reselling our results.
      </p>

      <h2>Card offers and other companies</h2>
      <p>
        Trace isn&apos;t affiliated with, or endorsed by, the airlines, banks or loyalty programs we mention. Their names and logos belong to them. Card offers are shown as of the date listed and are set by the issuer; Trace may earn a commission if you&apos;re approved. Approval is up to the issuer.
      </p>

      <h2>Limits of liability</h2>
      <p>
        Trace Points is provided &ldquo;as is.&rdquo; To the extent the law allows, Trace isn&apos;t liable for indirect or consequential losses, including lost points, missed award seats or travel costs, and our total liability to you is limited to what you paid us in the 12 months before the claim.
      </p>

      <h2>Changes</h2>
      <p>We may update these terms. If a change matters to members, we&apos;ll email you before it takes effect. Using Trace Points after that means you accept the new terms.</p>
    </LegalPage>
  );
}
