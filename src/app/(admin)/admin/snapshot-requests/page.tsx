import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardHeader } from "@/components/ui/card";
import { cn, getStatusColor, formatDate } from "@/lib/utils/helpers";
import { StatusButtons } from "./status-buttons";
import type { SnapshotRequest } from "@/types";

export const dynamic = "force-dynamic";

const ORDER: Record<string, number> = { pending: 0, sent: 1, installed: 2 };

export default async function SnapshotRequestsAdminPage() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("snapshot_requests")
    .select("*")
    .order("created_at", { ascending: false });

  const requests = ((data ?? []) as SnapshotRequest[]).sort(
    (a, b) =>
      (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9) ||
      +new Date(b.created_at) - +new Date(a.created_at)
  );
  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Snapshot Requests"
          description={`${pendingCount} pending · queue for delivering the GHL snapshot.`}
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b border-white/10 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Agency</th>
                <th className="px-5 py-3 font-medium">GHL Location</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-500">
                    No requests yet.
                  </td>
                </tr>
              ) : (
                requests.map((r) => (
                  <tr key={r.id} className="hover:bg-white/[0.03]">
                    <td className="px-5 py-3 font-medium text-slate-100">{r.name}</td>
                    <td className="px-5 py-3 text-slate-400">{r.email}</td>
                    <td className="px-5 py-3 text-slate-400">{r.agency_name ?? "—"}</td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-400">
                      {r.ghl_location_id ?? "—"}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                          getStatusColor(r.status)
                        )}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-500">{formatDate(r.created_at)}</td>
                    <td className="px-5 py-3">
                      <StatusButtons id={r.id} status={r.status} />
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
