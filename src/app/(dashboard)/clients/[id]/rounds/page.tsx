import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn, formatDate, daysRemaining } from "@/lib/utils/helpers";
import type { DisputeRound } from "@/types";
import { Plus, Layers } from "lucide-react";

function DeadlineLabel({ round }: { round: DisputeRound }) {
  if (round.status === "complete" || !round.response_deadline) return null;
  const days = daysRemaining(round.response_deadline);
  if (days < 0) {
    return (
      <span className="text-sm font-medium text-red-600">
        {Math.abs(days)} days overdue
      </span>
    );
  }
  return (
    <span className="text-sm font-medium text-amber-600">
      {days} days remaining
    </span>
  );
}

export default async function ClientRoundsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data } = await supabase
    .from("dispute_rounds")
    .select("*")
    .eq("client_id", id)
    .order("round_number", { ascending: false });

  const rounds = (data ?? []) as DisputeRound[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Dispute Rounds</h3>
        <Link href={`/clients/${id}/rounds/new`}>
          <Button>
            <Plus className="h-4 w-4" />
            Start New Round
          </Button>
        </Link>
      </div>

      {rounds.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <EmptyState
            icon={Layers}
            title="No rounds yet"
            description="Start a dispute round to generate letters and track responses."
            action={
              <Link href={`/clients/${id}/rounds/new`}>
                <Button>
                  <Plus className="h-4 w-4" />
                  Start New Round
                </Button>
              </Link>
            }
          />
        </div>
      ) : (
        <div className="space-y-3">
          {rounds.map((round) => (
            <Link
              key={round.id}
              href={`/clients/${id}/rounds/${round.id}`}
              className="block rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-colors hover:border-blue-300 hover:bg-gray-50"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div
                    className={cn(
                      "flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-lg font-semibold text-blue-600"
                    )}
                  >
                    {round.round_number}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">
                        Round {round.round_number}
                      </span>
                      <Badge status={round.status} />
                    </div>
                    <p className="mt-0.5 text-sm text-gray-500">
                      {round.date_sent
                        ? `Sent ${formatDate(round.date_sent)}`
                        : "Not sent yet"}
                      {" · "}
                      {round.total_items_disputed} items disputed
                    </p>
                  </div>
                </div>
                <DeadlineLabel round={round} />
              </div>

              <div className="mt-4 flex flex-wrap gap-4 border-t border-gray-100 pt-3 text-sm">
                <span className="text-green-600">
                  {round.total_deletions} deleted
                </span>
                <span className="text-teal-600">
                  {round.total_updates} updated
                </span>
                <span className="text-red-600">
                  {round.total_verified} verified
                </span>
                <span className="text-orange-600">
                  {round.total_no_response} no response
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
