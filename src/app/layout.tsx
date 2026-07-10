import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RoundTrack Pro",
  description:
    "Practice management software for credit professionals — dispute tracking, AI letters, and client portal.",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/logos/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/logos/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    images: [{ url: "/logos/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/logos/og-image.png"],
  },
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
