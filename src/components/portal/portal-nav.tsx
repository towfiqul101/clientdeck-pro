"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/helpers";
import { Home, TrendingUp, MessageSquare, FolderOpen, CreditCard } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const ITEMS: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Home", href: "/portal/dashboard", icon: Home },
  { label: "Progress", href: "/portal/progress", icon: TrendingUp },
  { label: "Messages", href: "/portal/messages", icon: MessageSquare },
  { label: "Documents", href: "/portal/documents", icon: FolderOpen },
  { label: "Billing", href: "/portal/billing", icon: CreditCard },
];

export function PortalNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-lg items-stretch justify-around">
        {ITEMS.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium"
              style={active ? { color: "var(--brand)" } : undefined}
            >
              <Icon
                className={cn("h-5 w-5", !active && "text-slate-500")}
                style={active ? { color: "var(--brand)" } : undefined}
              />
              <span className={cn(!active && "text-slate-500")}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
