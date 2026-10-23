import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
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

export const metadata: Metadata = {
  title: "Trace Points — You're sitting on a free flight",
  description:
    "Tell us your cards and balances. Trace does the math across every airline partner and shows the trips you can book from your airport.",
  icons: { icon: "/favicon.png" },
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
          <div className="app-col">{children}</div>
        </PointsProvider>
      </body>
    </html>
  );
}
