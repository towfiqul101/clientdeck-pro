import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getClientOr404 } from "@/lib/clients/queries";
import {
  RoundWorkspace,
  type RoundData,
  type RoundDispute,
} from "./round-workspace";
import type { Bureau, DisputeResult, LetterType } from "@/types";

interface DisputeJoinRow {
  id: string;
  bureau: Bureau;
  letter_type: LetterType;
  letter_content: string | null;
  certified_mail_number: string | null;
  is_finalized: boolean;
  result: DisputeResult;
  result_notes: string | null;
  negative_item_id: string;
  negative_item: { creditor_name: string } | null;
}

export default async function RoundDetailPage({
  params,
}: {
  params: Promise<{ id: string; roundId: string }>;
}) {
  const { id, roundId } = await params;
  const supabase = await createServerSupabaseClient();

  const client = await getClientOr404(id);

  const { data: round } = await supabase
    .from("dispute_rounds")
    .select("*")
    .eq("id", roundId)
    .eq("client_id", id)
    .single();

  if (!round) notFound();

  const { data: disputeRows } = await supabase
    .from("disputes")
    .select(
      "id, bureau, letter_type, letter_content, certified_mail_number, is_finalized, result, result_notes, negative_item_id, negative_item:negative_items(creditor_name)"
    )
    .eq("round_id", roundId)
    .order("bureau", { ascending: true });

  const disputes: RoundDispute[] = (
    (disputeRows ?? []) as unknown as DisputeJoinRow[]
  ).map((d) => ({
    id: d.id,
    bureau: d.bureau,
    letter_type: d.letter_type,
    letter_content: d.letter_content,
    certified_mail_number: d.certified_mail_number,
    is_finalized: d.is_finalized,
    result: d.result,
    result_notes: d.result_notes,
    negative_item_id: d.negative_item_id,
    creditor_name: d.negative_item?.creditor_name ?? "Unknown creditor",
  }));

  const roundData: RoundData = {
    id: round.id,
    round_number: round.round_number,
    status: round.status,
    date_sent: round.date_sent,
    response_deadline: round.response_deadline,
    total_items_disputed: round.total_items_disputed,
    total_deletions: round.total_deletions,
    total_updates: round.total_updates,
    total_verified: round.total_verified,
    total_no_response: round.total_no_response,
  };

  return (
    <RoundWorkspace
      clientId={id}
      clientName={`${client.first_name} ${client.last_name}`}
      round={roundData}
      disputes={disputes}
    />
  );
}
