import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { StatCard } from "@/components/dashboard/stat-card";
import {
  DeletionsChart,
  type MonthlyDeletion,
} from "@/components/dashboard/deletions-chart";
import { Card, CardHeader } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/helpers";
import { Users, Trash2, Percent, DollarSign } from "lucide-react";

const ACTIVE_STATUSES = ["active", "onboarding", "analysis", "on_hold"];

function monthBuckets(): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleString("en-US", { month: "short" }),
    });
  }
  return out;
}

export default async function ReportsPage() {
  const session = await getSessionContext();
  if (!session) redirect("/login");

  const supabase = await createServerSupabaseClient();
  const now = new Date();
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1)
    .toISOString()
    .split("T")[0];

  const [clientsRes, itemsRes, deletionsRes, deletionsSeriesRes] =
    await Promise.all([
      supabase
        .from("clients")
        .select("id, status, payment_status, monthly_fee"),
      supabase.from("negative_items").select("id", { count: "exact", head: true }),
      supabase
        .from("disputes")
        .select("id", { count: "exact", head: true })
        .eq("result", "deleted"),
      supabase
        .from("disputes")
        .select("result_date")
        .eq("result", "deleted")
        .gte("result_date", twelveMonthsAgo),
    ]);

  const clients = clientsRes.data ?? [];
  const totalClients = clients.length;
  const activeClients = clients.filter((c) =>
    ACTIVE_STATUSES.includes(c.status)
  ).length;
  const completedClients = clients.filter((c) => c.status === "completed").length;
  const totalItems = itemsRes.count ?? 0;
  const totalDeletions = deletionsRes.count ?? 0;
  const deletionRate =
    totalItems > 0 ? Math.round((totalDeletions / totalItems) * 100) : 0;
  const mrr = clients
    .filter((c) => c.payment_status === "active")
    .reduce((sum, c) => sum + Number(c.monthly_fee ?? 0), 0);

  const buckets = monthBuckets();
  const counts = new Map(buckets.map((b) => [b.key, 0]));
  for (const row of deletionsSeriesRes.data ?? []) {
    if (!row.result_date) continue;
    const key = String(row.result_date).slice(0, 7);
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const chartData: MonthlyDeletion[] = buckets.map((b) => ({
    label: b.label,
    deletions: counts.get(b.key) ?? 0,
  }));

  // Status breakdown
  const statusCounts = new Map<string, number>();
  for (const c of clients) {
    statusCounts.set(c.status, (statusCounts.get(c.status) ?? 0) + 1);
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Clients" value={totalClients} icon={Users} accent="blue" />
        <StatCard
          label="Total Deletions"
          value={totalDeletions}
          icon={Trash2}
          accent="green"
          trend="All time"
        />
        <StatCard
          label="Deletion Rate"
          value={`${deletionRate}%`}
          icon={Percent}
          accent="purple"
          trend={`${totalItems} items disputed`}
        />
        <StatCard
          label="Monthly Recurring"
          value={formatCurrency(mrr)}
          icon={DollarSign}
          accent="amber"
          trend={`${activeClients} active`}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader
              title="Deletions"
              description="Items deleted per month, last 12 months."
            />
            <div className="p-5">
              <DeletionsChart data={chartData} />
            </div>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader
              title="Client Status"
              description={`${completedClients} completed`}
            />
            <ul className="divide-y divide-gray-100">
              {[...statusCounts.entries()].map(([status, count]) => (
                <li
                  key={status}
                  className="flex items-center justify-between px-5 py-3 text-sm"
                >
                  <span className="capitalize text-gray-600">
                    {status.replace("_", " ")}
                  </span>
                  <span className="font-medium text-gray-900">{count}</span>
                </li>
              ))}
              {statusCounts.size === 0 && (
                <li className="px-5 py-8 text-center text-sm text-gray-500">
                  No clients yet.
                </li>
              )}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
