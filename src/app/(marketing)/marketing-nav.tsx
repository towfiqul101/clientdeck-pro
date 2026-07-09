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
  { id: "compare", label: "Compare" },
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
    <header
      className="sticky top-0 z-40 border-b backdrop-blur-md"
      style={{
        background: "rgba(15,23,48,0.9)",
        borderColor: "rgba(255,255,255,0.06)",
      }}
    >
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
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
                active === l.id ? "text-white" : "text-slate-400 hover:text-white"
              )}
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/snapshot"
            className="text-sm text-slate-400 transition-colors duration-150 hover:text-white"
          >
            GHL Snapshot
          </Link>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          {loggedIn ? (
            <Link
              href="/dashboard"
              className="cta-gradient rounded-lg px-4 py-2 text-sm font-semibold text-white"
            >
              Go to Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="text-sm text-slate-400 hover:text-white">
                Log In
              </Link>
              <Link
                href="/signup"
                className="cta-gradient rounded-lg px-4 py-2 text-sm font-semibold text-white"
              >
                Start Free Trial
              </Link>
            </>
          )}
        </div>

        <button
          className="text-slate-400 md:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {open && (
        <div
          className="space-y-1 border-t px-6 py-3 md:hidden"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          {LINKS.map((l) => (
            <Link
              key={l.id}
              href={`/#${l.id}`}
              className="block py-2 text-sm text-slate-400"
              onClick={() => setOpen(false)}
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/snapshot"
            className="block py-2 text-sm text-slate-400"
            onClick={() => setOpen(false)}
          >
            GHL Snapshot
          </Link>
          {loggedIn ? (
            <Link href="/dashboard" className="block py-2 text-sm font-medium text-violet-400">
              Go to Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="block py-2 text-sm text-slate-400">
                Log In
              </Link>
              <Link href="/signup" className="block py-2 text-sm font-medium text-violet-400">
                Start Free Trial
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}
