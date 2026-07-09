import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { StatCard } from "@/components/dashboard/stat-card";
import { OnboardingBanner } from "@/components/dashboard/onboarding-banner";
import { computeOnboarding } from "@/lib/onboarding/steps";
import {
  DeletionsChart,
  type MonthlyDeletion,
} from "@/components/dashboard/deletions-chart";
import { Card, CardHeader } from "@/components/ui/card";
import { cn, formatCurrency } from "@/lib/utils/helpers";
import type { ActivityLog } from "@/types";
import {
  Users,
  Trash2,
  AlertTriangle,
  DollarSign,
  Plus,
  Activity,
  Clock,
  CreditCard,
  MoonStar,
  RefreshCw,
  ArrowRight,
  Zap,
  CheckCircle2,
  BarChart3,
  Sparkles,
} from "lucide-react";

const ACTIVE_STATUSES = ["active", "onboarding", "analysis", "on_hold"];
const STALE_DAYS = 21;

interface OverdueRow {
  id: string;
  round_number: number;
  client_id: string;
  response_deadline: string;
  client: { first_name: string; last_name: string } | null;
}

function daysAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// Builds the last 6 month buckets (oldest → newest).
function monthBuckets(): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleString("en-US", { month: "short" }),
    });
  }
  return out;
}

export default async function DashboardPage() {
  const session = await getSessionContext();
  if (!session) redirect("/login");

  const supabase = await createServerSupabaseClient();
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const startOfMonth = `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}-01`;
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)
    .toISOString()
    .split("T")[0];
  const nowMs = now.getTime();
  const staleCutoff = new Date(
    nowMs - STALE_DAYS * 86_400_000
  ).toISOString();
  const last24h = new Date(nowMs - 24 * 60 * 60 * 1000).toISOString();

  const [
    clientsRes,
    deletionsMonthRes,
    overdueCountRes,
    overdueListRes,
    deletions6moRes,
    activityRes,
    recentActivityRes,
    syncFailRes,
    resolvedRes,
    winsRes,
    roundStatusRes,
  ] = await Promise.all([
    supabase
      .from("clients")
      .select(
        "id, first_name, last_name, status, payment_status, monthly_fee, created_at, updated_at"
      ),
    supabase
      .from("disputes")
      .select("id", { count: "exact", head: true })
      .eq("result", "deleted")
      .gte("result_date", startOfMonth),
    supabase
      .from("dispute_rounds")
      .select("id", { count: "exact", head: true })
      .eq("status", "awaiting_response")
      .lt("response_deadline", today),
    supabase
      .from("dispute_rounds")
      .select(
        "id, round_number, client_id, response_deadline, client:clients(first_name, last_name)"
      )
      .eq("status", "awaiting_response")
      .lt("response_deadline", today)
      .order("response_deadline", { ascending: true })
      .limit(6),
    supabase
      .from("disputes")
      .select("result_date")
      .eq("result", "deleted")
      .gte("result_date", sixMonthsAgo),
    // For stale detection: latest activity per client.
    supabase
      .from("activity_log")
      .select("client_id, created_at")
      .not("client_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase
      .from("activity_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("ghl_sync_log")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed")
      .gte("attempted_at", last24h),
    // Success rate: resolved disputes (denominator) vs wins (deleted/updated).
    supabase
      .from("disputes")
      .select("id", { count: "exact", head: true })
      .not("result", "is", null),
    supabase
      .from("disputes")
      .select("id", { count: "exact", head: true })
      .in("result", ["deleted", "updated"]),
    // Pipeline overview: tally round statuses.
    supabase.from("dispute_rounds").select("status"),
  ]);

  const clients = clientsRes.data ?? [];
  const onboarding = computeOnboarding(session.agency.settings);
  const firstClientId = clients[0]?.id ?? null;
  const activeClients = clients.filter((c) =>
    ACTIVE_STATUSES.includes(c.status)
  );

  // Stat cards
  const activeClientCount = activeClients.length;
  const deletionsThisMonth = deletionsMonthRes.count ?? 0;
  const overdueRounds = overdueCountRes.count ?? 0;
  const revenueThisMonth = clients
    .filter((c) => c.payment_status === "active")
    .reduce((sum, c) => sum + Number(c.monthly_fee ?? 0), 0);
  const syncFailures = syncFailRes.count ?? 0;

  const resolvedCount = resolvedRes.count ?? 0;
  const winsCount = winsRes.count ?? 0;
  const successRate =
    resolvedCount > 0 ? Math.round((winsCount / resolvedCount) * 100) : 0;

  // Pipeline overview tally
  const PIPELINE_STAGES = [
    { key: "preparing", label: "Preparing", color: "bg-indigo-500" },
    { key: "letters_generated", label: "Ready", color: "bg-violet-500" },
    { key: "sent", label: "Sent", color: "bg-blue-500" },
    { key: "awaiting_response", label: "Awaiting", color: "bg-amber-500" },
    { key: "complete", label: "Complete", color: "bg-emerald-500" },
  ] as const;
  const stageCounts = new Map<string, number>(
    PIPELINE_STAGES.map((s) => [s.key, 0])
  );
  for (const row of roundStatusRes.data ?? []) {
    const key = String(row.status);
    if (stageCounts.has(key))
      stageCounts.set(key, (stageCounts.get(key) ?? 0) + 1);
  }
  const maxStage = Math.max(1, ...Array.from(stageCounts.values()));
  const hasPipeline = (roundStatusRes.data ?? []).length > 0;

  // Greeting
  const hour = now.getHours();
  const timeOfDay =
    hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const firstName = session.teamMember.name.split(" ")[0] || "there";

  // Chart: deletions per month
  const buckets = monthBuckets();
  const counts = new Map(buckets.map((b) => [b.key, 0]));
  for (const row of deletions6moRes.data ?? []) {
    if (!row.result_date) continue;
    const key = String(row.result_date).slice(0, 7);
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const chartData: MonthlyDeletion[] = buckets.map((b) => ({
    label: b.label,
    deletions: counts.get(b.key) ?? 0,
  }));

  // Needs Attention
  const overdueList = (overdueListRes.data ?? []) as unknown as OverdueRow[];
  const failedPayments = clients
    .filter((c) => c.payment_status === "failed")
    .slice(0, 5);

  const lastActivityByClient = new Map<string, string>();
  for (const row of activityRes.data ?? []) {
    if (row.client_id && !lastActivityByClient.has(row.client_id)) {
      lastActivityByClient.set(row.client_id, row.created_at);
    }
  }
  const staleClients = activeClients
    .filter((c) => {
      const last = lastActivityByClient.get(c.id) ?? c.created_at;
      return last < staleCutoff;
    })
    .slice(0, 5);

  const activities = (recentActivityRes.data ?? []) as ActivityLog[];
  const hasAttention =
    overdueList.length > 0 ||
    failedPayments.length > 0 ||
    staleClients.length > 0 ||
    syncFailures > 0;

  const attentionRows: {
    key: string;
    href: string;
    icon: typeof Clock;
    label: string;
    meta: string;
    accent: string;
    metaColor: string;
  }[] = [
    ...overdueList.map((r) => ({
      key: `over-${r.id}`,
      href: `/clients/${r.client_id}/rounds/${r.id}`,
      icon: Clock,
      label: `${
        r.client ? `${r.client.first_name} ${r.client.last_name}` : "Client"
      } — Round ${r.round_number} overdue`,
      meta: `${Math.abs(daysAgo(r.response_deadline))}d`,
      accent: "border-amber-500",
      metaColor: "text-amber-400",
    })),
    ...failedPayments.map((c) => ({
      key: `pay-${c.id}`,
      href: `/clients/${c.id}`,
      icon: CreditCard,
      label: `Payment failed — ${c.first_name} ${c.last_name}`,
      meta: `${daysAgo(c.updated_at)}d`,
      accent: "border-red-500",
      metaColor: "text-red-400",
    })),
    ...staleClients.map((c) => {
      const last = lastActivityByClient.get(c.id) ?? c.created_at;
      return {
        key: `stale-${c.id}`,
        href: `/clients/${c.id}`,
        icon: MoonStar,
        label: `${c.first_name} ${c.last_name} — no activity`,
        meta: `${daysAgo(last)}d`,
        accent: "border-blue-500",
        metaColor: "text-blue-400",
      };
    }),
    ...(syncFailures > 0
      ? [
          {
            key: "sync",
            href: "/settings/ghl",
            icon: RefreshCw,
            label: "GHL sync failures (24h)",
            meta: String(syncFailures),
            accent: "border-red-500",
            metaColor: "text-red-400",
          },
        ]
      : []),
  ];

  const quickActions = [
    {
      href: "/clients/new",
      icon: Plus,
      title: "Add New Client",
      desc: "Start a new case",
      iconBg: "bg-violet-500/20",
      iconText: "text-violet-400",
    },
    {
      href: "/clients",
      icon: Sparkles,
      title: "AI Strategy",
      desc: "Open a client to advise",
      iconBg: "bg-blue-500/20",
      iconText: "text-blue-400",
    },
    {
      href: "/rounds",
      icon: Zap,
      title: "Dispute Rounds",
      desc: "Manage the pipeline",
      iconBg: "bg-amber-500/20",
      iconText: "text-amber-400",
    },
    {
      href: "/reports",
      icon: BarChart3,
      title: "View Reports",
      desc: "Track outcomes",
      iconBg: "bg-teal-500/20",
      iconText: "text-teal-400",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Hero banner */}
      <div
        className="relative overflow-hidden rounded-2xl"
        style={{
          background:
            "linear-gradient(135deg, #1a0533 0%, #0a1628 50%, #0f1a2e 100%)",
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            background:
              "radial-gradient(ellipse at 30% 50%, #8B5CF6 0%, transparent 60%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            background:
              "radial-gradient(ellipse at 80% 20%, #2563EB 0%, transparent 50%)",
          }}
        />
        <div className="relative z-10 p-6 md:p-8">
          <p className="mb-2 text-sm font-medium text-violet-300">
            Good {timeOfDay}, {firstName} 👋
          </p>
          <h1 className="mb-1 text-2xl font-bold text-white md:text-3xl">
            Welcome to <span className="text-violet-400">ClientDeck Pro</span>
          </h1>
          <p className="text-slate-400">Your credit repair command center.</p>
        </div>
      </div>

      {!onboarding.hidden && (
        <OnboardingBanner
          steps={onboarding.steps}
          completedCount={onboarding.completedCount}
          total={onboarding.total}
          showCongrats={onboarding.showCongrats}
          allComplete={onboarding.allComplete}
          firstClientId={firstClientId}
        />
      )}

      {/* Stats */}
      <div className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Active Clients"
          value={activeClientCount}
          icon={Users}
          accent="purple"
          trend={activeClientCount > 0 ? "Active caseload" : "No active clients"}
          trendTone={activeClientCount > 0 ? "up" : "neutral"}
        />
        <StatCard
          label="Deletions"
          value={deletionsThisMonth}
          icon={Trash2}
          accent="green"
          trend="This month"
          trendTone={deletionsThisMonth > 0 ? "up" : "neutral"}
        />
        <StatCard
          label="Overdue Rounds"
          value={overdueRounds}
          icon={AlertTriangle}
          accent="amber"
          trend={overdueRounds > 0 ? "Needs attention" : "All on track"}
          trendTone={overdueRounds > 0 ? "down" : "up"}
        />
        <StatCard
          label="Revenue"
          value={formatCurrency(revenueThisMonth)}
          icon={DollarSign}
          accent="blue"
          trend="Active clients"
          trendTone="neutral"
        />
        <StatCard
          label="Success Rate"
          value={`${successRate}%`}
          icon={CheckCircle2}
          accent="teal"
          trend={`${winsCount} of ${resolvedCount} resolved`}
          trendTone={successRate >= 50 ? "up" : "neutral"}
        />
      </div>

      {/* Needs Attention */}
      {hasAttention && (
        <div className="glass-panel overflow-hidden">
          <div className="flex items-center justify-between gap-4 border-b border-white/[0.08] px-5 py-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <Zap className="h-4 w-4 text-amber-400" />
              Needs Attention
            </h2>
            <Link
              href="/rounds"
              className="text-xs font-medium text-violet-400 hover:text-violet-300"
            >
              View all →
            </Link>
          </div>
          <div className="space-y-1.5 p-3">
            {attentionRows.map((row) => {
              const Icon = row.icon;
              return (
                <Link
                  key={row.key}
                  href={row.href}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-lg border-l-2 bg-white/[0.02] px-3 py-2.5 text-sm transition-colors hover:bg-white/[0.05]",
                    row.accent
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2.5 text-slate-300">
                    <Icon className={cn("h-4 w-4 shrink-0", row.metaColor)} />
                    <span className="truncate">{row.label}</span>
                  </span>
                  <span className={cn("shrink-0 font-medium", row.metaColor)}>
                    {row.meta}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Chart + recent activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader
              title="Deletions"
              description="Items deleted per month, last 6 months."
            />
            <div className="p-5">
              <DeletionsChart data={chartData} />
            </div>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader title="Recent Activity" />
            {activities.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                <Activity className="h-8 w-8 text-slate-600" />
                <p className="mt-3 text-sm text-slate-500">No activity yet.</p>
              </div>
            ) : (
              <ul className="divide-y divide-white/[0.06]">
                {activities.map((entry) => (
                  <li key={entry.id} className="px-5 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-slate-200">
                        {entry.action}
                      </p>
                      <span className="shrink-0 text-xs text-slate-500">
                        {timeAgo(entry.created_at)}
                      </span>
                    </div>
                    {entry.description && (
                      <p className="mt-0.5 line-clamp-2 text-sm text-slate-400">
                        {entry.description}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {/* Pipeline overview */}
      {hasPipeline && (
        <Card>
          <CardHeader
            title="Dispute Pipeline Overview"
            description="Rounds by stage across all clients."
          />
          <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-3 md:grid-cols-5">
            {PIPELINE_STAGES.map((stage) => {
              const count = stageCounts.get(stage.key) ?? 0;
              return (
                <div key={stage.key} className="space-y-2">
                  <p className="text-xs font-medium text-slate-400">
                    {stage.label}
                  </p>
                  <p className="text-2xl font-bold text-white">{count}</p>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                    <div
                      className={cn("h-full rounded-full", stage.color)}
                      style={{ width: `${(count / maxStage) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="glass-panel p-5">
        <h3 className="text-sm font-semibold text-slate-100">Quick Actions</h3>
        <p className="text-sm text-slate-400">Common tasks, one click away.</p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                className="glass-card group flex items-center gap-3 p-4"
              >
                <span
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                    action.iconBg
                  )}
                >
                  <Icon className={cn("h-5 w-5", action.iconText)} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-100">
                    {action.title}
                  </span>
                  <span className="block truncate text-xs text-slate-500">
                    {action.desc}
                  </span>
                </span>
                <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-slate-600 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-400" />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
