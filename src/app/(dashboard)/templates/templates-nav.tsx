"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/helpers";
import { FileText, ListChecks } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const TABS: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Templates", href: "/templates", icon: FileText },
  { label: "Dispute Reasons", href: "/templates/reasons", icon: ListChecks },
];

export function TemplatesNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 border-b border-white/10">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
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
