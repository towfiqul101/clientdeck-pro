"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn, getInitials } from "@/lib/utils/helpers";
import { AppSidebarLogo, AppContentLogo } from "@/components/logo";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";
import { NotificationBell } from "@/components/dashboard/notification-bell";
import { useTheme } from "@/lib/theme/theme-context";
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
  ChevronRight,
  Zap,
  Plug,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Clients", href: "/clients", icon: Users },
  { label: "Rounds", href: "/rounds", icon: Clock },
  { label: "Templates", href: "/templates", icon: FileText },
  { label: "Reports", href: "/reports", icon: BarChart3 },
  { label: "Team", href: "/team", icon: UserPlus },
  { label: "Settings", href: "/settings", icon: Settings },
];

const AUTOMATION_ITEMS: NavItem[] = [
  { label: "Workflows", href: "/onboarding/ghl-setup", icon: Zap },
  { label: "Integrations", href: "/settings/ghl", icon: Plug },
];

// Derive a page title from the first path segment.
const TITLES: Record<string, string> = {
  dashboard: "Dashboard",
  clients: "Clients",
  rounds: "Rounds",
  templates: "Templates",
  reports: "Reports",
  team: "Team",
  settings: "Settings",
};

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface DashboardShellProps {
  agencyName: string;
  agencyPlan?: string;
  userName: string;
  userEmail: string;
  children: React.ReactNode;
}

function NavLink({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  onNavigate: () => void;
}) {
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-lg border-l-2 px-3 py-2 text-sm font-medium transition-all duration-150",
        active
          ? "border-violet-500 bg-violet-500/15 text-violet-300"
          : "border-transparent text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
      )}
    >
      <Icon
        className={cn(
          "h-[18px] w-[18px] shrink-0",
          active ? "text-violet-400" : "text-slate-500"
        )}
      />
      {item.label}
    </Link>
  );
}

const PLAN_LABELS: Record<string, string> = {
  solo: "Starter Plan",
  pro: "Pro Plan",
  agency: "Agency Plan",
  enterprise: "Enterprise",
};

export function DashboardShell({
  agencyName,
  agencyPlan,
  userName,
  userEmail,
  children,
}: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  const segment = pathname.split("/")[1] ?? "";
  const pageTitle = TITLES[segment] ?? "Dashboard";
  const planLabel = agencyPlan ? PLAN_LABELS[agencyPlan] ?? "" : "";

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const closeMobile = () => setMobileOpen(false);

  const sidebar = (
    <div className="flex h-full flex-col border-r border-white/[0.06] bg-[#13131f]">
      {/* Brand */}
      <div className="flex h-16 items-center justify-between px-4">
        <AppSidebarLogo />
        <button
          onClick={closeMobile}
          className="rounded-md p-1 text-slate-400 hover:bg-white/5 hover:text-white md:hidden"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        <p className="px-3 pb-2 pt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">
          Navigation
        </p>
        <div className="space-y-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              pathname={pathname}
              onNavigate={closeMobile}
            />
          ))}
        </div>

        <p className="px-3 pb-2 pt-5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">
          Automation
        </p>
        <div className="space-y-1">
          {AUTOMATION_ITEMS.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              pathname={pathname}
              onNavigate={closeMobile}
            />
          ))}
        </div>
      </nav>

      {/* Workspace switcher */}
      <div className="border-t border-white/[0.06] p-3">
        <Link
          href="/settings"
          onClick={closeMobile}
          className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors duration-150 hover:bg-white/[0.04]"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-violet-700 text-sm font-semibold text-white">
            {(agencyName.charAt(0) || "A").toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-100">
              {agencyName}
            </p>
            {planLabel && (
              <p className="truncate text-xs text-slate-500">{planLabel}</p>
            )}
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-600 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-400" />
        </Link>

        <button
          onClick={handleLogout}
          className="mt-1 flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium text-slate-400 transition-colors duration-150 hover:bg-white/[0.04] hover:text-slate-200"
        >
          <LogOut className="h-[18px] w-[18px] shrink-0 text-slate-500" />
          Log out
        </button>
      </div>
    </div>
  );

  return (
    <div className="app-shell min-h-screen bg-[#0f0f1a]">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 md:block">
        {sidebar}
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={closeMobile}
          />
          <aside className="absolute inset-y-0 left-0 w-64">{sidebar}</aside>
        </div>
      )}

      {/* Main column */}
      <div className="app-content md:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-white/[0.06] bg-[#0f0f1a]/80 px-4 backdrop-blur-xl md:px-8">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-1.5 text-slate-400 hover:bg-white/5 hover:text-slate-200 md:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          {/* Mobile: brand wordmark stands in for the hidden sidebar logo.
              Lives in .app-content so it follows the light/dark toggle. */}
          <AppContentLogo theme={theme} className="md:hidden" />
          <h1 className="hidden text-lg font-semibold text-slate-100 md:block">
            {pageTitle}
          </h1>
          <div className="ml-auto flex items-center gap-3">
            <NotificationBell />
            <ThemeToggle />
            <span
              className="hidden text-sm text-slate-400 sm:block"
              title={userEmail}
            >
              {userName}
            </span>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-xs font-medium text-slate-200 ring-1 ring-white/10">
              {getInitials(
                userName.split(" ")[0] ?? userName,
                userName.split(" ")[1] ?? userName.slice(1)
              )}
            </span>
          </div>
        </header>

        {/* Content */}
        <main className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
