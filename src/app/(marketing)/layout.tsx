import type { Metadata } from "next";
import Link from "next/link";
import { AppContentLogo } from "@/components/logo";
import { MarketingNav } from "./marketing-nav";

export const metadata: Metadata = {
  title: "RoundTrack Pro — Dispute Management Software for GoHighLevel",
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
    title: "RoundTrack Pro — Credit Repair Software for GoHighLevel",
    description:
      "Stop managing credit repair in spreadsheets. AI letters, client portal, and full GHL sync — all in one platform.",
    url: "https://roundtrackpro.com",
    siteName: "RoundTrack Pro",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "RoundTrack Pro — Dispute Management for GHL Agencies",
    description:
      "AI dispute letters + client portal + GHL sync. Built for credit repair businesses.",
  },
  robots: { index: true, follow: true },
  alternates: { canonical: "https://roundtrackpro.com" },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-[#0F1730]">
      <MarketingNav />
      <main className="flex-1">{children}</main>

      <footer className="border-t border-white/[0.06] bg-[#0b1122] text-slate-400">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="flex flex-col justify-between gap-10 md:flex-row">
            <div className="max-w-sm space-y-3">
              <AppContentLogo theme="dark" className="h-9 w-auto" />
              <p className="text-sm leading-relaxed">
                The connected platform for GoHighLevel credit repair agencies —
                AI dispute letters, client portal, and native GHL sync in one
                system.
              </p>
              <a
                href="mailto:support@roundtrackpro.com"
                className="inline-block text-sm text-slate-400 hover:text-white"
              >
                support@roundtrackpro.com
              </a>
            </div>
            <div className="grid grid-cols-2 gap-8 text-sm sm:grid-cols-3">
              <div className="space-y-2.5">
                <p className="font-medium text-white">Product</p>
                <Link href="/#features" className="block hover:text-white">Features</Link>
                <Link href="/#how-it-works" className="block hover:text-white">How It Works</Link>
                <Link href="/#pricing" className="block hover:text-white">Pricing</Link>
                <Link href="/#compare" className="block hover:text-white">Compare</Link>
                <Link href="/#faq" className="block hover:text-white">FAQ</Link>
                <Link href="/snapshot" className="block hover:text-white">GHL Snapshot</Link>
              </div>
              <div className="space-y-2.5">
                <p className="font-medium text-white">Company</p>
                <a href="mailto:support@roundtrackpro.com" className="block hover:text-white">Contact</a>
                <Link href="/login" className="block hover:text-white">Log In</Link>
                <Link href="/signup" className="block hover:text-white">Sign Up</Link>
              </div>
              <div className="space-y-2.5">
                <p className="font-medium text-white">Legal</p>
                <Link href="/terms" className="block hover:text-white">Terms of Service</Link>
                <Link href="/privacy" className="block hover:text-white">Privacy Policy</Link>
              </div>
            </div>
          </div>
          <p className="mt-12 border-t border-white/[0.06] pt-6 text-xs leading-relaxed text-slate-500">
            © {new Date().getFullYear()} RoundTrack Pro. Not affiliated with
            HighLevel, Inc. RoundTrack Pro is practice management software. Not a
            credit repair service. Not legal advice.
          </p>
        </div>
      </footer>
    </div>
  );
}
