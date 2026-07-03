import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { RoundsFilter } from "./rounds-filter";
import { cn, formatDate, daysRemaining } from "@/lib/utils/helpers";
import type { RoundStatus } from "@/types";
import { Clock } from "lucide-react";

type SearchParams = Record<string, string | string[] | undefined>;

interface RoundRow {
  id: string;
  round_number: number;
  status: RoundStatus;
  date_sent: string | null;
  response_deadline: string | null;
  total_items_disputed: number;
  client_id: string;
  client: { first_name: string; last_name: string } | null;
}

function DeadlineCell({
  status,
  deadline,
}: {
  status: RoundStatus;
  deadline: string | null;
}) {
  if (!deadline || status === "complete") {
    return <span className="text-gray-400">—</span>;
  }
  const days = daysRemaining(deadline);
  const tone =
    days < 0
      ? "text-red-600"
      : days <= 14
        ? "text-amber-600"
        : "text-green-600";
  return (
    <span className={cn("font-medium", tone)}>
      {days < 0
        ? `${Math.abs(days)}d overdue`
        : status === "awaiting_response"
          ? `${days}d left`
          : formatDate(deadline)}
    </span>
  );
}

export default async function AllRoundsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const statusFilter =
    typeof sp.status === "string" ? sp.status : "";

  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("dispute_rounds")
    .select(
      "id, round_number, status, date_sent, response_deadline, total_items_disputed, client_id, client:clients(first_name, last_name)"
    );

  if (statusFilter) query = query.eq("status", statusFilter);

  // Soonest / most-overdue deadlines first; rounds without a deadline sink.
  query = query
    .order("response_deadline", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  const { data } = await query;
  const rounds = (data ?? []) as unknown as RoundRow[];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Rounds</h2>
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-sm font-medium text-gray-600">
            {rounds.length}
          </span>
        </div>
        <RoundsFilter />
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        {rounds.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="No rounds found"
            description={
              statusFilter
                ? "No rounds match this status filter."
                : "Rounds appear here once you start disputing items for a client."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Round</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Sent</th>
                  <th className="px-4 py-3">Deadline</th>
                  <th className="px-4 py-3">Items</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rounds.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/clients/${r.client_id}/rounds/${r.id}`}
                        className="font-medium text-gray-900 hover:text-blue-600"
                      >
                        {r.client
                          ? `${r.client.first_name} ${r.client.last_name}`
                          : "Unknown client"}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <Link
                        href={`/clients/${r.client_id}/rounds/${r.id}`}
                        className="block"
                      >
                        Round {r.round_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/clients/${r.client_id}/rounds/${r.id}`}
                        className="block"
                      >
                        <Badge status={r.status} />
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {r.date_sent ? formatDate(r.date_sent) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <DeadlineCell
                        status={r.status}
                        deadline={r.response_deadline}
                      />
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {r.total_items_disputed}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
