import Link from "next/link";
import { getSessionContext } from "@/lib/auth/session";
import { MarketingNav } from "./marketing-nav";

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionContext();
  const loggedIn = Boolean(session);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <MarketingNav loggedIn={loggedIn} />
      <main className="flex-1">{children}</main>

      <footer className="border-t border-gray-800 bg-gray-950 text-gray-400">
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
                <Link href="/#pricing" className="block hover:text-white">Pricing</Link>
                <Link href="/snapshot" className="block hover:text-white">GHL Snapshot</Link>
              </div>
              <div className="space-y-2">
                <p className="font-medium text-white">Account</p>
                <Link href="/login" className="block hover:text-white">Login</Link>
                <Link href="/signup" className="block hover:text-white">Sign Up</Link>
              </div>
              <div className="space-y-2">
                <p className="font-medium text-white">Legal</p>
                <Link href="/terms" className="block hover:text-white">Terms of Service</Link>
                <Link href="/privacy" className="block hover:text-white">Privacy Policy</Link>
              </div>
            </div>
          </div>
          <p className="mt-10 border-t border-gray-800 pt-6 text-xs text-gray-500">
            © 2025 ClientDeck Pro. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
