import { notFound, redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardHeader } from "@/components/ui/card";
import { cn, getStatusColor } from "@/lib/utils/helpers";
import { StatusButtons } from "./status-buttons";
import type { SnapshotRequest } from "@/types";

export default async function SnapshotRequestsAdminPage() {
  const session = await getSessionContext();
  if (!session) redirect("/login");

  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
  if (!adminEmail || session.agency.owner_email.toLowerCase() !== adminEmail) {
    notFound();
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("snapshot_requests")
    .select("*")
    .order("created_at", { ascending: false });
  const requests = (data ?? []) as SnapshotRequest[];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Snapshot Requests"
          description="Internal queue for delivering the GHL snapshot."
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
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
            <tbody className="divide-y divide-gray-100">
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-gray-500">
                    No requests yet.
                  </td>
                </tr>
              ) : (
                requests.map((r) => (
                  <tr key={r.id}>
                    <td className="px-5 py-3 font-medium text-gray-900">{r.name}</td>
                    <td className="px-5 py-3 text-gray-600">{r.email}</td>
                    <td className="px-5 py-3 text-gray-600">{r.agency_name ?? "—"}</td>
                    <td className="px-5 py-3 font-mono text-xs text-gray-600">
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
                    <td className="px-5 py-3 text-gray-500">
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
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
