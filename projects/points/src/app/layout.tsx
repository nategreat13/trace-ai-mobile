import type { Metadata, Viewport } from "next";
import { PointsProvider } from "@/lib/store";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trace Points — You're sitting on a free flight",
  description:
    "Tell us your cards and balances. Trace does the math across every airline partner and shows what you can book from your airport.",
  icons: { icon: "/favicon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#FFFFFF",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased font-sans">
        <PointsProvider>
          <div className="app-col">{children}</div>
        </PointsProvider>
      </body>
    </html>
  );
}
