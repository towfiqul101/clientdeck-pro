"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/utils/helpers";

const LINKS = [
  { id: "features", label: "Features" },
  { id: "how-it-works", label: "How It Works" },
  { id: "pricing", label: "Pricing" },
  { id: "faq", label: "FAQ" },
];

export function MarketingNav({ loggedIn }: { loggedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const sections = LINKS.map((l) => document.getElementById(l.id)).filter(
      (el): el is HTMLElement => el !== null
    );
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(entry.target.id);
          }
        }
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
    );
    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-gray-800 bg-gray-950/90 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5">
        <Link href="/" className="flex items-center gap-2 text-white">
          <Logo className="h-6 w-auto" variant="light" />
        </Link>

        <div className="hidden items-center gap-6 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.id}
              href={`/#${l.id}`}
              className={cn(
                "text-sm transition-colors duration-150",
                active === l.id ? "text-white" : "text-gray-400 hover:text-white"
              )}
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
                Log In
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
          {LINKS.map((l) => (
            <Link
              key={l.id}
              href={`/#${l.id}`}
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
                Log In
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
