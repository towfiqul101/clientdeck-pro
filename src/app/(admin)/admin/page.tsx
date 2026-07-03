import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { StatCard } from "@/components/dashboard/stat-card";
import { AdminBarChart, type AdminBarPoint } from "@/components/admin/admin-bar-chart";
import { Card, CardHeader } from "@/components/ui/card";
import { cn, formatCurrency, formatDate, getStatusColor } from "@/lib/utils/helpers";
import { planMonthly } from "@/lib/admin/mrr";
import {
  Building2,
  BadgeCheck,
  Clock,
  XCircle,
  Users,
  Trash2,
  DollarSign,
} from "lucide-react";
import type { Plan, PlanStatus } from "@/types";

export const dynamic = "force-dynamic";

interface AgencyRow {
  id: string;
  name: string;
  owner_email: string;
  plan: Plan;
  plan_status: PlanStatus;
  created_at: string;
}

function weekBuckets(): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  const now = new Date();
  // Monday-anchored week start.
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  for (let i = 11; i >= 0; i--) {
    const d = new Date(monday);
    d.setDate(monday.getDate() - i * 7);
    out.push({
      key: d.toISOString().slice(0, 10),
      label: d.toLocaleString("en-US", { month: "short", day: "numeric" }),
    });
  }
  return out;
}

function weekKeyOf(iso: string): string {
  const d = new Date(iso);
  const day = d.getDay();
  d.setDate(d.getDate() - ((day + 6) % 7));
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export default async function AdminOverviewPage() {
  const admin = createAdminClient();

  const [agenciesRes, clientsCountRes, deletionsCountRes] = await Promise.all([
    admin
      .from("agencies")
      .select("id, name, owner_email, plan, plan_status, created_at")
      .order("created_at", { ascending: false }),
    admin.from("clients").select("id", { count: "exact", head: true }),
    admin
      .from("disputes")
      .select("id", { count: "exact", head: true })
      .eq("result", "deleted"),
  ]);

  const agencies = (agenciesRes.data ?? []) as AgencyRow[];
  const totalAgencies = agencies.length;
  const active = agencies.filter((a) => a.plan_status === "active").length;
  const trialing = agencies.filter((a) => a.plan_status === "trialing").length;
  const cancelled = agencies.filter((a) => a.plan_status === "cancelled").length;
  const mrr = agencies
    .filter((a) => a.plan_status === "active")
    .reduce((sum, a) => sum + planMonthly(a.plan), 0);
  const totalClients = clientsCountRes.count ?? 0;
  const totalDeletions = deletionsCountRes.count ?? 0;

  // Signups per week
  const buckets = weekBuckets();
  const counts = new Map(buckets.map((b) => [b.key, 0]));
  for (const a of agencies) {
    const key = weekKeyOf(a.created_at);
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const chartData: AdminBarPoint[] = buckets.map((b) => ({
    label: b.label,
    value: counts.get(b.key) ?? 0,
  }));

  const recent = agencies.slice(0, 8);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Agencies" value={totalAgencies} icon={Building2} accent="blue" />
        <StatCard label="Active" value={active} icon={BadgeCheck} accent="green" />
        <StatCard label="Trialing" value={trialing} icon={Clock} accent="amber" />
        <StatCard label="Cancelled" value={cancelled} icon={XCircle} accent="purple" />
        <StatCard label="Total Clients" value={totalClients} icon={Users} accent="blue" />
        <StatCard label="Total Deletions" value={totalDeletions} icon={Trash2} accent="green" />
        <StatCard
          label="MRR Estimate"
          value={formatCurrency(mrr)}
          icon={DollarSign}
          accent="purple"
          trend={`${active} active`}
        />
      </div>

      <Card>
        <CardHeader
          title="Signups"
          description="New agencies per week, last 12 weeks."
        />
        <div className="p-5">
          <AdminBarChart data={chartData} empty="No signups in this window yet." />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Recent Signups"
          action={
            <Link
              href="/admin/agencies"
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              View all
            </Link>
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-5 py-3 font-medium">Agency</th>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Plan</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recent.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-gray-500">
                    No agencies yet.
                  </td>
                </tr>
              ) : (
                recent.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">
                      <Link href={`/admin/agencies/${a.id}`} className="hover:text-blue-600">
                        {a.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{a.owner_email}</td>
                    <td className="px-5 py-3 capitalize text-gray-600">{a.plan}</td>
                    <td className="px-5 py-3">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                          getStatusColor(a.plan_status)
                        )}
                      >
                        {a.plan_status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-500">{formatDate(a.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
