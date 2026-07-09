"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/helpers";

const TABS = [
  { label: "Overview", segment: "" },
  { label: "Items", segment: "items" },
  { label: "Rounds", segment: "rounds" },
  { label: "Letters", segment: "letters" },
  { label: "Documents", segment: "documents" },
  { label: "Timeline", segment: "timeline" },
];

export function ClientTabs({ clientId }: { clientId: string }) {
  const pathname = usePathname();
  const base = `/clients/${clientId}`;

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-white/[0.08]">
      {TABS.map((tab) => {
        const href = tab.segment ? `${base}/${tab.segment}` : base;
        const active = tab.segment
          ? pathname.startsWith(href)
          : pathname === base;
        return (
          <Link
            key={tab.label}
            href={href}
            className={cn(
              "whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "border-violet-500 text-violet-400"
                : "border-transparent text-slate-500 hover:border-white/20 hover:text-slate-300"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
