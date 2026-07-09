"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/helpers";
import {
  LayoutDashboard,
  Building2,
  Users,
  Package,
  CreditCard,
  Activity,
  LogOut,
  Menu,
  X,
  ShieldAlert,
  Hourglass,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: number;
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({
  adminEmail,
  pendingSnapshots,
  children,
}: {
  adminEmail: string;
  pendingSnapshots: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const nav: NavItem[] = [
    { label: "Overview", href: "/admin", icon: LayoutDashboard },
    { label: "Agencies", href: "/admin/agencies", icon: Building2 },
    { label: "Pending Setup", href: "/admin/pending", icon: Hourglass },
    { label: "Clients", href: "/admin/clients", icon: Users },
    {
      label: "Snapshot Requests",
      href: "/admin/snapshot-requests",
      icon: Package,
      badge: pendingSnapshots || undefined,
    },
    { label: "Payments", href: "/admin/payments", icon: CreditCard },
    { label: "Activity", href: "/admin/activity", icon: Activity },
  ];

  const sidebar = (
    <div className="flex h-full flex-col bg-gray-950">
      <div className="flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold text-white">ClientDeck Pro</span>
          <span className="rounded border border-red-500/40 bg-red-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.35)]">
            Admin
          </span>
        </div>
        <button
          onClick={() => setMobileOpen(false)}
          className="rounded-md p-1 text-slate-500 hover:bg-gray-800 hover:text-white md:hidden"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {nav.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-red-600 text-white"
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.badge ? (
                <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-gray-800 p-3">
        <div className="flex items-center gap-3 px-1 py-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-600/20 text-red-400">
            <ShieldAlert className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">Super Admin</p>
            <p className="truncate text-xs text-slate-500">{adminEmail}</p>
          </div>
        </div>
        <Link
          href="/dashboard"
          className="mt-1 flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-gray-800 hover:text-white"
        >
          <LayoutDashboard className="h-5 w-5" />
          Back to app
        </Link>
        <a
          href="/api/admin/logout"
          className="mt-1 flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-gray-800 hover:text-white"
        >
          <LogOut className="h-5 w-5" />
          Log out
        </a>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a15]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 md:block">
        {sidebar}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-gray-900/60"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-64">{sidebar}</aside>
        </div>
      )}

      <div className="md:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-white/10 bg-[#1a1a2e] px-4 md:px-8">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-1.5 text-slate-500 hover:bg-white/[0.06] hover:text-slate-300 md:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold text-slate-100">Admin</h1>
          <span className="rounded bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-400">
            Super-admin mode
          </span>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
