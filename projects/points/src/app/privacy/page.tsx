import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Privacy policy · Trace Points" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="October 23, 2026">
      <p>
        Trace Points is run by Trace Travel (&ldquo;Trace&rdquo;, &ldquo;we&rdquo;). This policy explains what we collect when you use Trace Points, why, and the choices you have.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>What you tell us:</strong> the cards and loyalty programs you hold, your point balances, your home airport, trips you pick, save, watch or request, and messages you send us.</li>
        <li><strong>Your email</strong>, when you give it to us, start a trial, or sign in.</li>
        <li><strong>Payment details</strong> are entered on Stripe&apos;s checkout page and handled by Stripe. We never see or store your full card number.</li>
        <li><strong>Usage and device data:</strong> pages viewed, buttons tapped, browser type and IP address, collected through our servers and the Meta Pixel.</li>
      </ul>
      <p>We never ask for your bank, card or airline logins, and we never access your accounts.</p>

      <h2>How we use it</h2>
      <ul>
        <li>To show which trips your points can book, and keep your trips and balances in sync across devices.</li>
        <li>To run your membership: start your trial, bill you through Stripe, remind you before your trial ends, and answer seat checks, trip requests and messages.</li>
        <li>To measure and improve our ads and product, including through Meta.</li>
        <li>To prevent fraud and keep the service working.</li>
      </ul>

      <h2>Who we share it with</h2>
      <p>We don&apos;t sell your personal information. We share it only with services that help us run Trace Points:</p>
      <ul>
        <li>Stripe (payments and billing)</li>
        <li>Google Firebase (account data and sign-in emails)</li>
        <li>Vercel (hosting)</li>
        <li>Slack (our team&apos;s inbox for your requests and messages)</li>
        <li>Meta (ad measurement through the Meta Pixel and Conversions API, which receive a hashed email when you start a trial)</li>
        <li>Our email provider, to send trial reminders and replies</li>
      </ul>
      <p>We may also share information if the law requires it, or as part of a sale or merger of our business.</p>
      <p>
        Card offers link to the card issuer&apos;s site. If you apply, what you share there is covered by the issuer&apos;s privacy policy, and Trace may earn a commission.
      </p>

      <h2>Cookies and ads</h2>
      <p>
        We use cookies and similar storage to keep you signed in, remember your answers on your device, and measure ads. You can block cookies in your browser, or opt out of ads based on your activity in your Meta ad settings. Your answers are also stored in your browser so you don&apos;t lose them before signing up.
      </p>

      <h2>How long we keep it</h2>
      <p>We keep your account data while you have an account, and for as long as we need it for billing records and legal obligations after that.</p>

      <h2>Your choices</h2>
      <p>
        You can see and change your points, airport and trips in the app at any time. To get a copy of your data, delete your account, or opt out of sharing for ad measurement, contact us and we&apos;ll handle it within 30 days. Depending on where you live (for example California), you may have additional rights, and we won&apos;t treat you differently for using them.
      </p>

      <h2>Children</h2>
      <p>Trace Points is for adults. We don&apos;t knowingly collect information from anyone under 16.</p>

      <h2>Changes</h2>
      <p>If we change this policy in a meaningful way, we&apos;ll update the date above and let members know by email.</p>
    </LegalPage>
  );
}
