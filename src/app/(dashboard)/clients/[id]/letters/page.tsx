import { createServerSupabaseClient } from "@/lib/supabase/server";
import { LettersList, type LetterRow } from "./letters-list";

interface DisputeJoinRow {
  id: string;
  bureau: LetterRow["bureau"];
  letter_type: LetterRow["letter_type"];
  letter_content: string | null;
  letter_pdf_url: string | null;
  result: LetterRow["result"];
  created_at: string;
  round: { round_number: number } | null;
  negative_item: { creditor_name: string } | null;
}

export default async function ClientLettersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data } = await supabase
    .from("disputes")
    .select(
      "id, bureau, letter_type, letter_content, letter_pdf_url, result, created_at, round:dispute_rounds(round_number), negative_item:negative_items(creditor_name)"
    )
    .eq("client_id", id)
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as unknown as DisputeJoinRow[];
  const letters: LetterRow[] = rows.map((r) => ({
    id: r.id,
    bureau: r.bureau,
    letter_type: r.letter_type,
    letter_content: r.letter_content,
    letter_pdf_url: r.letter_pdf_url,
    result: r.result,
    created_at: r.created_at,
    round_number: r.round?.round_number ?? null,
    creditor_name: r.negative_item?.creditor_name ?? null,
  }));

  return <LettersList letters={letters} />;
}
