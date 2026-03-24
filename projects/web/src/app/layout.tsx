import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trace — Fly Business. Pay Economy.",
  description:
    "AI-powered flight deal finder. Swipe through the best business class deals and save thousands on flights.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-white text-gray-900 antialiased">{children}</body>
    </html>
  );
}
