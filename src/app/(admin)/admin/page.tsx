import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { StatCard } from "@/components/dashboard/stat-card";
import { AdminBarChart, type AdminBarPoint } from "@/components/admin/admin-bar-chart";
import { AgencyList, type AgencyListRow } from "@/components/admin/agency-list";
import { Card, CardHeader } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/helpers";
import { planMonthly } from "@/lib/admin/mrr";
import {
  Building2,
  BadgeCheck,
  Clock,
  PauseCircle,
  Users,
  Trash2,
  DollarSign,
  Hourglass,
} from "lucide-react";
import type { Plan, PlanStatus, AgencySettings } from "@/types";

export const dynamic = "force-dynamic";

interface AgencyRow extends AgencyListRow {
  settings: AgencySettings | null;
}

function isPendingSetup(a: AgencyRow): boolean {
  if (a.plan_status !== "trialing") return false;
  return a.settings?.onboarding_steps?.ghl_connected !== true;
}

function weekBuckets(): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  const now = new Date();
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
      .select("id, name, owner_email, plan, plan_status, created_at, settings")
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
  const pendingSetup = agencies.filter(isPendingSetup).length;
  const pausedOrCancelled = agencies.filter(
    (a) => a.plan_status === "paused" || a.plan_status === "cancelled"
  ).length;
  const mrr = agencies
    .filter((a) => a.plan_status === "active")
    .reduce((sum, a) => sum + planMonthly(a.plan as Plan), 0);
  const totalClients = clientsCountRes.count ?? 0;
  const totalDeletions = deletionsCountRes.count ?? 0;

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

  const recent: AgencyListRow[] = agencies.slice(0, 12).map((a) => ({
    id: a.id,
    name: a.name,
    owner_email: a.owner_email,
    plan: a.plan as Plan,
    plan_status: a.plan_status as PlanStatus,
    created_at: a.created_at,
  }));

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Agencies" value={totalAgencies} icon={Building2} accent="blue" />
        <StatCard label="Active" value={active} icon={BadgeCheck} accent="green" />
        <StatCard
          label="Pending Setup"
          value={pendingSetup}
          icon={Hourglass}
          accent="amber"
          trend={trialing > 0 ? `${trialing} trialing` : undefined}
        />
        <StatCard label="Paused / Cancelled" value={pausedOrCancelled} icon={PauseCircle} accent="purple" />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="MRR Estimate"
          value={formatCurrency(mrr)}
          icon={DollarSign}
          accent="green"
          trend={`${active} active`}
        />
        <StatCard label="Trialing" value={trialing} icon={Clock} accent="blue" />
        <StatCard label="Total Clients" value={totalClients} icon={Users} accent="blue" />
        <StatCard label="Total Deletions" value={totalDeletions} icon={Trash2} accent="green" />
      </div>

      <Card>
        <CardHeader title="Signups" description="New agencies per week, last 12 weeks." />
        <div className="p-5">
          <AdminBarChart data={chartData} empty="No signups in this window yet." />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Recent Agencies"
          description="Click a row to open the agency panel."
          action={
            <Link
              href="/admin/agencies"
              className="text-sm font-medium text-blue-400 hover:text-blue-400"
            >
              View all
            </Link>
          }
        />
        <AgencyList agencies={recent} />
      </Card>
    </div>
  );
}
