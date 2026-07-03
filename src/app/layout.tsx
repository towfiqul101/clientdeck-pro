import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ClientDeck Pro",
  description:
    "Practice management software for credit professionals — dispute tracking, AI letters, and client portal.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      {/* suppressHydrationWarning: browser extensions (Grammarly, etc.) inject
          attributes onto <body> before React hydrates, which would otherwise
          trip a dev-only hydration mismatch overlay. */}
      <body className="min-h-full" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
