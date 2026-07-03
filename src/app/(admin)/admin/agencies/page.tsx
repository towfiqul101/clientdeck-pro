import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardHeader } from "@/components/ui/card";
import { cn, formatDate, getStatusColor } from "@/lib/utils/helpers";
import { Search } from "lucide-react";
import type { Plan, PlanStatus } from "@/types";

interface AgencyRow {
  id: string;
  name: string;
  owner_name: string;
  owner_email: string;
  plan: Plan;
  plan_status: PlanStatus;
  trial_ends_at: string | null;
  created_at: string;
}

export default async function AdminAgenciesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  const admin = createAdminClient();
  let builder = admin
    .from("agencies")
    .select(
      "id, name, owner_name, owner_email, plan, plan_status, trial_ends_at, created_at"
    )
    .order("created_at", { ascending: false });
  if (query) {
    builder = builder.or(`name.ilike.%${query}%,owner_email.ilike.%${query}%`);
  }
  const { data } = await builder;
  const agencies = (data ?? []) as AgencyRow[];

  // Client counts per agency (single pass).
  const { data: clientRows } = await admin.from("clients").select("agency_id");
  const clientCounts = new Map<string, number>();
  for (const row of clientRows ?? []) {
    clientCounts.set(row.agency_id, (clientCounts.get(row.agency_id) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Agencies"
          description={`${agencies.length} ${query ? "matching" : "total"}`}
          action={
            <form method="GET" className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                name="q"
                defaultValue={query}
                placeholder="Search name or email…"
                className="w-56 rounded-md border border-gray-300 py-1.5 pl-8 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </form>
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-5 py-3 font-medium">Agency</th>
                <th className="px-5 py-3 font-medium">Owner email</th>
                <th className="px-5 py-3 font-medium">Plan</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Clients</th>
                <th className="px-5 py-3 font-medium">Trial ends</th>
                <th className="px-5 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {agencies.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-gray-500">
                    No agencies found.
                  </td>
                </tr>
              ) : (
                agencies.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <Link
                        href={`/admin/agencies/${a.id}`}
                        className="font-medium text-gray-900 hover:text-blue-600"
                      >
                        {a.name}
                      </Link>
                      <div className="text-xs text-gray-500">{a.owner_name}</div>
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
                    <td className="px-5 py-3 text-gray-600">
                      {clientCounts.get(a.id) ?? 0}
                    </td>
                    <td className="px-5 py-3 text-gray-500">
                      {a.trial_ends_at ? formatDate(a.trial_ends_at) : "—"}
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
