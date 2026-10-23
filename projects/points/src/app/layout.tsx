import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { AnalyticsBeacon } from "@/components/AnalyticsBeacon";
import { MetaPixel } from "@/components/MetaPixel";
import { AccountProvider } from "@/lib/account";
import { PointsProvider } from "@/lib/store";
import { THEME_SCRIPT } from "@/lib/themeScript";
import "./globals.css";

// Clean, geometric figures with no slashed zeros. Pairs with the Trace wordmark.
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

const DESCRIPTION =
  "Tell us your cards and balances. Trace does the math across every airline partner and shows the trips you can book from your airport.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://points.tracetravel.co"),
  title: "Trace Points — You're sitting on a free flight",
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "Trace Points",
    title: "You're sitting on a free flight",
    description: DESCRIPTION,
  },
  twitter: { card: "summary_large_image", title: "You're sitting on a free flight", description: DESCRIPTION },
  icons: { icon: "/favicon.png", apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Trace", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#11162A" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jakarta.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="font-sans antialiased">
        <PointsProvider>
          <AccountProvider>
            <div className="app-col">{children}</div>
          </AccountProvider>
          <AnalyticsBeacon />
        </PointsProvider>
        <MetaPixel />
      </body>
    </html>
  );
}
