"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn, getInitials } from "@/lib/utils/helpers";
import { Logo } from "@/components/ui/logo";
import {
  LayoutDashboard,
  Users,
  Clock,
  FileText,
  BarChart3,
  UserPlus,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Clients", href: "/clients", icon: Users },
  { label: "Rounds", href: "/rounds", icon: Clock },
  { label: "Templates", href: "/templates", icon: FileText },
  { label: "Reports", href: "/reports", icon: BarChart3 },
  { label: "Team", href: "/team", icon: UserPlus },
  { label: "Settings", href: "/settings", icon: Settings },
];

// Derive a page title from the first path segment.
const TITLES: Record<string, string> = {
  "": "Dashboard",
  clients: "Clients",
  rounds: "Rounds",
  templates: "Templates",
  reports: "Reports",
  team: "Team",
  settings: "Settings",
};

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface DashboardShellProps {
  agencyName: string;
  userName: string;
  userEmail: string;
  children: React.ReactNode;
}

export function DashboardShell({
  agencyName,
  userName,
  userEmail,
  children,
}: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const segment = pathname.split("/")[1] ?? "";
  const pageTitle = TITLES[segment] ?? "Dashboard";

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const sidebar = (
    <div className="flex h-full flex-col bg-gray-900">
      {/* Brand */}
      <div className="flex h-16 items-center justify-between px-4">
        <Logo variant="light" />
        <button
          onClick={() => setMobileOpen(false)}
          className="rounded-md p-1 text-gray-400 hover:bg-gray-800 hover:text-white md:hidden"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Agency name */}
      <div className="px-4 pb-2">
        <p className="truncate text-xs font-medium uppercase tracking-wide text-gray-500">
          {agencyName}
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {NAV_ITEMS.map((item) => {
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
                  ? "bg-blue-600 text-white"
                  : "text-gray-300 hover:bg-gray-800 hover:text-white"
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User + logout */}
      <div className="border-t border-gray-800 p-3">
        <div className="flex items-center gap-3 px-1 py-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-700 text-sm font-medium text-white">
            {getInitials(
              userName.split(" ")[0] ?? userName,
              userName.split(" ")[1] ?? userName.slice(1)
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">
              {userName}
            </p>
            <p className="truncate text-xs text-gray-400">{userEmail}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="mt-1 flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
        >
          <LogOut className="h-5 w-5" />
          Log out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 md:block">
        {sidebar}
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-gray-900/60"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-64">{sidebar}</aside>
        </div>
      )}

      {/* Main column */}
      <div className="md:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-gray-200 bg-white px-4 md:px-8">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 md:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900">{pageTitle}</h1>
        </header>

        {/* Content */}
        <main className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
