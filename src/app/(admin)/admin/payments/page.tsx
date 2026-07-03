import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardHeader } from "@/components/ui/card";
import { cn, formatCurrency, formatDate, getStatusColor } from "@/lib/utils/helpers";
import { planMonthly } from "@/lib/admin/mrr";
import { PaymentForm, RowActions } from "./payment-controls";
import type { Plan, PlanStatus } from "@/types";

const FILTERS = ["all", "active", "past_due", "trialing", "cancelled"] as const;

interface AgencyRow {
  id: string;
  name: string;
  plan: Plan;
  plan_status: PlanStatus;
}

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const sp = await searchParams;
  const filter = (FILTERS as readonly string[]).includes(sp.filter ?? "")
    ? sp.filter!
    : "all";

  const admin = createAdminClient();
  const [{ data: agencyData }, { data: payData }] = await Promise.all([
    admin.from("agencies").select("id, name, plan, plan_status").order("name"),
    admin
      .from("manual_payments")
      .select("agency_id, amount, created_at")
      .order("created_at", { ascending: false }),
  ]);

  const allAgencies = (agencyData ?? []) as AgencyRow[];
  const agencies =
    filter === "all"
      ? allAgencies
      : allAgencies.filter((a) => a.plan_status === filter);

  // Latest payment per agency.
  const lastPayment = new Map<string, string>();
  for (const p of payData ?? []) {
    if (!lastPayment.has(p.agency_id)) lastPayment.set(p.agency_id, p.created_at);
  }

  return (
    <div className="space-y-6">
      <PaymentForm agencies={allAgencies.map((a) => ({ id: a.id, name: a.name }))} />

      <Card>
        <CardHeader
          title="Agency payments"
          description="Manual payment status across all agencies."
          action={
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map((f) => (
                <Link
                  key={f}
                  href={`/admin/payments?filter=${f}`}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium capitalize",
                    filter === f
                      ? "bg-blue-600 text-white"
                      : "border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                  )}
                >
                  {f.replace("_", " ")}
                </Link>
              ))}
            </div>
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-5 py-3 font-medium">Agency</th>
                <th className="px-5 py-3 font-medium">Plan</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Monthly</th>
                <th className="px-5 py-3 font-medium">Last payment</th>
                <th className="px-5 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {agencies.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-gray-500">
                    No agencies in this filter.
                  </td>
                </tr>
              ) : (
                agencies.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">
                      <Link href={`/admin/agencies/${a.id}`} className="hover:text-blue-600">
                        {a.name}
                      </Link>
                    </td>
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
                    <td className="px-5 py-3 text-gray-600">
                      {formatCurrency(planMonthly(a.plan))}
                    </td>
                    <td className="px-5 py-3 text-gray-500">
                      {lastPayment.has(a.id)
                        ? formatDate(lastPayment.get(a.id)!)
                        : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <RowActions agencyId={a.id} />
                    </td>
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
