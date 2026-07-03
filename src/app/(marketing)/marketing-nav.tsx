"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/ui/logo";

export function MarketingNav({ loggedIn }: { loggedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const links = [
    { href: "/#features", label: "Features" },
    { href: "/#pricing", label: "Pricing" },
    { href: "/snapshot", label: "GHL Snapshot" },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-gray-800 bg-gray-950/90 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5">
        <Link href="/" className="flex items-center gap-2 text-white">
          <Logo className="h-6 w-auto" variant="light" />
        </Link>

        <div className="hidden items-center gap-6 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm text-gray-300 hover:text-white"
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          {loggedIn ? (
            <Link
              href="/dashboard"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Go to Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="text-sm text-gray-300 hover:text-white">
                Login
              </Link>
              <Link
                href="/signup"
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Start Free Trial
              </Link>
            </>
          )}
        </div>

        <button
          className="text-gray-300 md:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {open && (
        <div className="space-y-1 border-t border-gray-800 px-4 py-3 md:hidden">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="block py-2 text-sm text-gray-300"
              onClick={() => setOpen(false)}
            >
              {l.label}
            </Link>
          ))}
          {loggedIn ? (
            <Link href="/dashboard" className="block py-2 text-sm font-medium text-blue-400">
              Go to Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="block py-2 text-sm text-gray-300">
                Login
              </Link>
              <Link href="/signup" className="block py-2 text-sm font-medium text-blue-400">
                Start Free Trial
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}
