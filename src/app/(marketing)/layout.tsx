import type { Metadata } from "next";
import Link from "next/link";
import { getSessionContext } from "@/lib/auth/session";
import { MarketingNav } from "./marketing-nav";

export const metadata: Metadata = {
  title: "ClientDeck Pro — Dispute Management Software for GoHighLevel",
  description:
    "The only dispute management platform built for GoHighLevel agencies. AI-powered dispute letters, automated client updates, and a branded client portal. Stop managing credit repair in spreadsheets.",
  keywords: [
    "credit repair software",
    "dispute management software",
    "gohighlevel credit repair",
    "credit repair automation",
    "dispute letter software",
    "credit repair crm",
    "ghl credit repair",
  ],
  openGraph: {
    title: "ClientDeck Pro — Credit Repair Software for GoHighLevel",
    description:
      "Stop managing credit repair in spreadsheets. AI letters, client portal, and full GHL sync — all in one platform.",
    url: "https://clientdeckpro.com",
    siteName: "ClientDeck Pro",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ClientDeck Pro — Dispute Management for GHL Agencies",
    description:
      "AI dispute letters + client portal + GHL sync. Built for credit repair businesses.",
  },
  robots: { index: true, follow: true },
  alternates: { canonical: "https://clientdeckpro.com" },
};

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionContext();
  const loggedIn = Boolean(session);

  return (
    <div className="flex min-h-screen flex-col bg-[#13131f]">
      <MarketingNav loggedIn={loggedIn} />
      <main className="flex-1">{children}</main>

      <footer className="border-t border-gray-800 bg-gray-950 text-slate-500">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="flex flex-col justify-between gap-8 md:flex-row">
            <div className="max-w-sm space-y-3">
              <span className="font-semibold text-white">ClientDeck Pro</span>
              <p className="text-sm">
                Practice management software for credit professionals. It is not
                a credit repair service and does not provide legal or financial
                advice.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-8 text-sm sm:grid-cols-3">
              <div className="space-y-2">
                <p className="font-medium text-white">Product</p>
                <Link href="/#features" className="block hover:text-white">Features</Link>
                <Link href="/#how-it-works" className="block hover:text-white">How It Works</Link>
                <Link href="/#pricing" className="block hover:text-white">Pricing</Link>
                <Link href="/#faq" className="block hover:text-white">FAQ</Link>
                <Link href="/snapshot" className="block hover:text-white">GHL Snapshot</Link>
              </div>
              <div className="space-y-2">
                <p className="font-medium text-white">Company</p>
                <a href="mailto:support@clientdeckpro.com" className="block hover:text-white">Contact</a>
                <Link href="/login" className="block hover:text-white">Log In</Link>
                <Link href="/signup" className="block hover:text-white">Sign Up</Link>
              </div>
              <div className="space-y-2">
                <p className="font-medium text-white">Legal</p>
                <Link href="/terms" className="block hover:text-white">Terms of Service</Link>
                <Link href="/privacy" className="block hover:text-white">Privacy Policy</Link>
              </div>
            </div>
          </div>
          <p className="mt-10 border-t border-gray-800 pt-6 text-xs text-slate-500">
            © {new Date().getFullYear()} ClientDeck Pro. All rights reserved. Not
            affiliated with HighLevel, Inc.
          </p>
        </div>
      </footer>
    </div>
  );
}
