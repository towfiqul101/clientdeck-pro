"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/helpers";
import { Building2, Plug, Palette, CreditCard, FolderOpen, LineChart, Globe, Key, UserCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const TABS: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "General", href: "/settings", icon: Building2 },
  { label: "Account", href: "/settings/account", icon: UserCircle },
  { label: "GHL Integration", href: "/settings/ghl", icon: Plug },
  { label: "Documents", href: "/settings/documents", icon: FolderOpen },
  { label: "Credit Monitoring", href: "/settings/credit-monitoring", icon: LineChart },
  { label: "Domain", href: "/settings/domain", icon: Globe },
  { label: "API", href: "/settings/api", icon: Key },
  { label: "Branding", href: "/settings/branding", icon: Palette },
  { label: "Billing", href: "/settings/billing", icon: CreditCard },
];

export function SettingsNav() {
  const pathname = usePathname();
  const scrollerRef = useRef<HTMLElement>(null);
  const activeRef = useRef<HTMLAnchorElement>(null);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);

  const updateFades = () => {
    const el = scrollerRef.current;
    if (!el) return;
    setShowLeftFade(el.scrollLeft > 4);
    setShowRightFade(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: "nearest", block: "nearest" });
    updateFades();
  }, [pathname]);

  useEffect(() => {
    updateFades();
    const el = scrollerRef.current;
    if (!el) return;
    const onResize = () => updateFades();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Fades the tab strip's own edges (via mask, not an overlay) so it works
  // in both light and dark theme without hardcoding a background color.
  const maskStops = [
    showLeftFade ? "transparent 0, black 24px" : "black 0",
    showRightFade ? "black calc(100% - 24px), transparent 100%" : "black 100%",
  ].join(", ");
  const maskImage = `linear-gradient(to right, ${maskStops})`;

  return (
    <nav
      ref={scrollerRef}
      onScroll={updateFades}
      className="flex gap-1 overflow-x-auto border-b border-white/10"
      style={{ WebkitMaskImage: maskImage, maskImage }}
    >
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            ref={active ? activeRef : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "border-blue-600 text-blue-400"
                : "border-transparent text-slate-500 hover:border-white/10 hover:text-slate-300"
            )}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
