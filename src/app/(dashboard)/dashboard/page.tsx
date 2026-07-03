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

  return (
    <div className="space-y-8">
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active Clients"
          value={activeClientCount}
          icon={Users}
          accent="blue"
        />
        <StatCard
          label="Deletions This Month"
          value={deletionsThisMonth}
          icon={Trash2}
          accent="green"
        />
        <StatCard
          label="Overdue Rounds"
          value={overdueRounds}
          icon={AlertTriangle}
          accent="amber"
          trend={overdueRounds > 0 ? "Needs attention" : "All on track"}
        />
        <StatCard
          label="Revenue This Month"
          value={formatCurrency(revenueThisMonth)}
          icon={DollarSign}
          accent="purple"
          trend="Active clients"
        />
      </div>

      {/* Needs Attention */}
      {hasAttention && (
        <Card className="border-amber-200">
          <CardHeader
            title="Needs Attention"
            description="Items that may need action today."
          />
          <div className="grid grid-cols-1 divide-y divide-gray-100 md:grid-cols-2 md:divide-x md:divide-y-0">
            <div className="space-y-1 p-4">
              {overdueList.map((r) => {
                const over = Math.abs(daysAgo(r.response_deadline));
                return (
                  <Link
                    key={r.id}
                    href={`/clients/${r.client_id}/rounds/${r.id}`}
                    className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-gray-50"
                  >
                    <span className="flex items-center gap-2 text-gray-700">
                      <Clock className="h-4 w-4 text-red-500" />
                      Round {r.round_number} —{" "}
                      {r.client
                        ? `${r.client.first_name} ${r.client.last_name}`
                        : "Client"}
                    </span>
                    <span className="font-medium text-red-600">
                      {over}d overdue
                    </span>
                  </Link>
                );
              })}
              {failedPayments.map((c) => (
                <Link
                  key={c.id}
                  href={`/clients/${c.id}`}
                  className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-gray-50"
                >
                  <span className="flex items-center gap-2 text-gray-700">
                    <CreditCard className="h-4 w-4 text-red-500" />
                    {c.first_name} {c.last_name}
                  </span>
                  <span className="font-medium text-red-600">
                    Payment failed · {daysAgo(c.updated_at)}d
                  </span>
                </Link>
              ))}
            </div>

            <div className="space-y-1 p-4">
              {staleClients.map((c) => {
                const last = lastActivityByClient.get(c.id) ?? c.created_at;
                return (
                  <Link
                    key={c.id}
                    href={`/clients/${c.id}`}
                    className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-gray-50"
                  >
                    <span className="flex items-center gap-2 text-gray-700">
                      <MoonStar className="h-4 w-4 text-amber-500" />
                      {c.first_name} {c.last_name}
                    </span>
                    <span className="font-medium text-amber-600">
                      Stale · {daysAgo(last)}d
                    </span>
                  </Link>
                );
              })}
              {syncFailures > 0 && (
                <Link
                  href="/settings/ghl"
                  className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-gray-50"
                >
                  <span className="flex items-center gap-2 text-gray-700">
                    <RefreshCw className="h-4 w-4 text-red-500" />
                    GHL sync failures (24h)
                  </span>
                  <span className="font-medium text-red-600">
                    {syncFailures}
                  </span>
                </Link>
              )}
            </div>
          </div>
        </Card>
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
                <Activity className="h-8 w-8 text-gray-300" />
                <p className="mt-3 text-sm text-gray-500">
                  No activity yet.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {activities.map((entry) => (
                  <li key={entry.id} className="px-5 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-gray-900">
                        {entry.action}
                      </p>
                      <span className="shrink-0 text-xs text-gray-400">
                        {timeAgo(entry.created_at)}
                      </span>
                    </div>
                    {entry.description && (
                      <p className="mt-0.5 line-clamp-2 text-sm text-gray-500">
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

      {/* Quick action */}
      <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Add a client</h3>
          <p className="text-sm text-gray-500">
            Start a new case, or view all active rounds.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/rounds"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            )}
          >
            View Rounds
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/clients/new"
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Add New Client
          </Link>
        </div>
      </div>
    </div>
  );
}
