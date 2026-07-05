import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardHeader } from "@/components/ui/card";
import { cn, getStatusColor, formatDate } from "@/lib/utils/helpers";
import { CLIENT_STATUSES } from "@/lib/constants";
import type { Client } from "@/types";

const field =
  "rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

export default async function AdminClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ agency?: string; status?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const agencyFilter = sp.agency ?? "";
  const statusFilter = sp.status ?? "";
  const query = (sp.q ?? "").trim();

  const admin = createAdminClient();

  const { data: agencyRows } = await admin
    .from("agencies")
    .select("id, name")
    .order("name");
  const agencyName = new Map((agencyRows ?? []).map((a) => [a.id, a.name]));

  let builder = admin
    .from("clients")
    .select(
      "id, agency_id, first_name, last_name, status, current_round, total_items_deleted, score_eq_current, score_exp_current, score_tu_current, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(500);
  if (agencyFilter) builder = builder.eq("agency_id", agencyFilter);
  if (statusFilter) builder = builder.eq("status", statusFilter);
  if (query) {
    builder = builder.or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%`);
  }
  const { data } = await builder;
  const clients = (data ?? []) as Partial<Client>[];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="All Clients"
          description={`${clients.length} across all agencies`}
        />
        <form method="GET" className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-5 py-3">
          <select name="agency" defaultValue={agencyFilter} className={field}>
            <option value="">All agencies</option>
            {(agencyRows ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <select name="status" defaultValue={statusFilter} className={field}>
            <option value="">All statuses</option>
            {CLIENT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="Search name…"
            className={`${field} w-48`}
          />
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Filter
          </button>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-5 py-3 font-medium">Client</th>
                <th className="px-5 py-3 font-medium">Agency</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Scores (EQ/EXP/TU)</th>
                <th className="px-5 py-3 font-medium">Round</th>
                <th className="px-5 py-3 font-medium">Deletions</th>
                <th className="px-5 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {clients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-gray-500">
                    No clients found.
                  </td>
                </tr>
              ) : (
                clients.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">
                      {c.first_name} {c.last_name}
                    </td>
                    <td className="px-5 py-3">
                      <Link
                        href={`/admin/agencies?open=${c.agency_id}`}
                        className="text-gray-600 hover:text-blue-600"
                      >
                        {agencyName.get(c.agency_id as string) ?? "—"}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                          getStatusColor(c.status as string)
                        )}
                      >
                        {(c.status as string)?.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-gray-600">
                      {c.score_eq_current ?? "—"}/{c.score_exp_current ?? "—"}/
                      {c.score_tu_current ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-gray-600">{c.current_round ?? 0}</td>
                    <td className="px-5 py-3 text-gray-600">
                      {c.total_items_deleted ?? 0}
                    </td>
                    <td className="px-5 py-3 text-gray-500">
                      {c.created_at ? formatDate(c.created_at) : "—"}
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
