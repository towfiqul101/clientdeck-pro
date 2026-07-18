import { createServerSupabaseClient } from "@/lib/supabase/server";
import { RoundBuilder, type BuilderItem } from "./round-builder";
import type { DisputeResult, NegativeItem, DisputeReason, DisputeInstruction } from "@/types";

interface PriorDisputeRow {
  negative_item_id: string;
  result: DisputeResult;
  created_at: string;
  round: { round_number: number } | null;
}

export default async function NewRoundPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const [itemsRes, roundRes, priorRes, reasonsRes, instructionsRes] = await Promise.all([
    // Active items — anything not already deleted can still be disputed.
    supabase
      .from("negative_items")
      .select("*")
      .eq("client_id", id)
      .neq("dispute_status", "deleted")
      .order("bureau", { ascending: true })
      .order("creditor_name", { ascending: true }),
    supabase
      .from("dispute_rounds")
      .select("round_number")
      .eq("client_id", id)
      .order("round_number", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("disputes")
      .select(
        "negative_item_id, result, created_at, round:dispute_rounds(round_number)"
      )
      .eq("client_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("dispute_reasons")
      .select("*")
      .eq("is_active", true)
      .order("is_system", { ascending: false })
      .order("sort_order"),
    supabase
      .from("dispute_instructions")
      .select("*")
      .eq("is_active", true)
      .order("is_system", { ascending: false })
      .order("sort_order"),
  ]);

  const roundNumber = (roundRes.data?.round_number ?? 0) + 1;

  // Latest prior dispute result per item (rows already ordered newest-first).
  const priorByItem = new Map<
    string,
    { result: DisputeResult; round: number | null }
  >();
  for (const row of (priorRes.data ?? []) as unknown as PriorDisputeRow[]) {
    if (!priorByItem.has(row.negative_item_id)) {
      priorByItem.set(row.negative_item_id, {
        result: row.result,
        round: row.round?.round_number ?? null,
      });
    }
  }

  const items: BuilderItem[] = ((itemsRes.data ?? []) as NegativeItem[]).map(
    (item) => {
      const prior = priorByItem.get(item.id);
      return {
        ...item,
        previous_result: prior?.result ?? null,
        previous_round: prior?.round ?? null,
      };
    }
  );

  return (
    <RoundBuilder
      clientId={id}
      roundNumber={roundNumber}
      items={items}
      reasons={(reasonsRes.data ?? []) as DisputeReason[]}
      instructions={(instructionsRes.data ?? []) as DisputeInstruction[]}
    />
  );
}
