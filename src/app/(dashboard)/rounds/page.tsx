import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { RoundsFilter } from "./rounds-filter";
import { RoundsKanban } from "./rounds-kanban";
import { cn, formatDate, daysRemaining } from "@/lib/utils/helpers";
import type { RoundStatus, Bureau } from "@/types";
import { Clock, List, LayoutGrid } from "lucide-react";

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
  disputes: { bureau: Bureau }[];
}

function buildViewUrl(view: string, statusFilter: string) {
  const params = new URLSearchParams();
  if (statusFilter) params.set("status", statusFilter);
  if (view !== "pipeline") params.set("view", view);
  const qs = params.toString();
  return qs ? `/rounds?${qs}` : "/rounds";
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
  const viewParam = typeof sp.view === "string" ? sp.view : "";
  const view = viewParam === "list" ? "list" : "pipeline"; // pipeline is default per spec

  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("dispute_rounds")
    .select(
      "id, round_number, status, date_sent, response_deadline, total_items_disputed, client_id, client:clients(first_name, last_name), disputes(bureau)"
    );

  if (statusFilter) query = query.eq("status", statusFilter);

  // Soonest / most-overdue deadlines first; rounds without a deadline sink.
  query = query
    .order("response_deadline", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  const { data } = await query;
  const rounds = (data ?? []) as unknown as RoundRow[];

  const kanbanRounds = rounds.map((r) => ({
    id: r.id,
    round_number: r.round_number,
    status: r.status,
    date_sent: r.date_sent,
    response_deadline: r.response_deadline,
    client_id: r.client_id,
    client: r.client,
    bureauCounts: {
      equifax: r.disputes.filter((d) => d.bureau === "equifax").length,
      experian: r.disputes.filter((d) => d.bureau === "experian").length,
      transunion: r.disputes.filter((d) => d.bureau === "transunion").length,
    },
  }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Rounds</h2>
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-sm font-medium text-gray-600">
            {rounds.length}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-md border border-gray-200 p-0.5">
            <Link
              href={buildViewUrl("list", statusFilter)}
              className={cn(
                "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors duration-150",
                view === "list"
                  ? "bg-gray-100 text-gray-700"
                  : "text-gray-400 hover:text-gray-600"
              )}
            >
              <List className="h-3.5 w-3.5" /> List
            </Link>
            <Link
              href={buildViewUrl("pipeline", statusFilter)}
              className={cn(
                "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors duration-150",
                view === "pipeline"
                  ? "bg-gray-100 text-gray-700"
                  : "text-gray-400 hover:text-gray-600"
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Pipeline
            </Link>
          </div>
          <RoundsFilter />
        </div>
      </div>

      {view === "pipeline" ? (
        rounds.length === 0 ? (
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <EmptyState
              icon={Clock}
              title="No rounds found"
              description={
                statusFilter
                  ? "No rounds match this status filter."
                  : "Rounds appear here once you start disputing items for a client."
              }
            />
          </div>
        ) : (
          <RoundsKanban rounds={kanbanRounds} />
        )
      ) : (
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
      )}
    </div>
  );
}
