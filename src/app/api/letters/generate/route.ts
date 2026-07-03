import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { findBestTemplate } from "@/lib/claude/template-matcher";
import { generateDisputeLetter } from "@/lib/claude/generate-letter";
import type { Client, Dispute, NegativeItem } from "@/types";

export const maxDuration = 300; // letter generation can take a while for big rounds

interface DisputeWithJoins extends Dispute {
  negative_item: NegativeItem;
  client: Client;
}

// Latest prior result for an item, excluding the current round.
async function priorResult(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  clientId: string,
  negativeItemId: string,
  currentRoundId: string
): Promise<string | undefined> {
  const { data } = await supabase
    .from("disputes")
    .select("result, created_at")
    .eq("client_id", clientId)
    .eq("negative_item_id", negativeItemId)
    .neq("round_id", currentRoundId)
    .neq("result", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.result ?? undefined;
}

async function generateForDispute(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  dispute: DisputeWithJoins,
  agencyId: string,
  agencyName: string
): Promise<{ disputeId: string; ok: true; content: string } | {
  disputeId: string;
  ok: false;
  error: string;
}> {
  try {
    const template = await findBestTemplate(
      agencyId,
      dispute.negative_item.negative_type,
      dispute.letter_type
    );
    if (!template) {
      return {
        disputeId: dispute.id,
        ok: false,
        error: "No matching letter template found.",
      };
    }

    const previousResult = await priorResult(
      supabase,
      dispute.client_id,
      dispute.negative_item_id,
      dispute.round_id
    );

    const { content } = await generateDisputeLetter({
      client: dispute.client,
      item: dispute.negative_item,
      dispute,
      template,
      agencyName,
      previousResult,
    });

    const { error } = await supabase
      .from("disputes")
      .update({ letter_content: content })
      .eq("id", dispute.id);
    if (error) {
      return { disputeId: dispute.id, ok: false, error: error.message };
    }

    return { disputeId: dispute.id, ok: true, content };
  } catch (err) {
    return {
      disputeId: dispute.id,
      ok: false,
      error: err instanceof Error ? err.message : "Generation failed.",
    };
  }
}

// Marks the round as letters_generated once no pending letter remains ungenerated.
async function maybeMarkGenerated(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  roundId: string
) {
  const { count } = await supabase
    .from("disputes")
    .select("id", { count: "exact", head: true })
    .eq("round_id", roundId)
    .is("letter_content", null);
  if ((count ?? 0) === 0) {
    await supabase
      .from("dispute_rounds")
      .update({ status: "letters_generated" })
      .eq("id", roundId)
      .eq("status", "preparing");
  }
}

const DISPUTE_SELECT =
  "*, negative_item:negative_items(*), client:clients(*)";

export async function POST(req: Request) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { disputeId?: string; roundId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // No ANTHROPIC_API_KEY is fine — generateDisputeLetter() returns a realistic
  // mock letter so the round → letters → PDF flow stays fully previewable.

  const supabase = await createServerSupabaseClient();
  const agencyId = session.agency.id;
  const agencyName = session.agency.name;

  // ---- Single dispute ----
  if (body.disputeId) {
    const { data, error } = await supabase
      .from("disputes")
      .select(DISPUTE_SELECT)
      .eq("id", body.disputeId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
    }
    const dispute = data as unknown as DisputeWithJoins;

    const result = await generateForDispute(
      supabase,
      dispute,
      agencyId,
      agencyName
    );
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }
    await maybeMarkGenerated(supabase, dispute.round_id);
    return NextResponse.json({ success: true, content: result.content });
  }

  // ---- Bulk by round ----
  if (body.roundId) {
    const { data, error } = await supabase
      .from("disputes")
      .select(DISPUTE_SELECT)
      .eq("round_id", body.roundId)
      .is("letter_content", null);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const disputes = (data ?? []) as unknown as DisputeWithJoins[];
    if (disputes.length === 0) {
      await maybeMarkGenerated(supabase, body.roundId);
      return NextResponse.json({ success: true, results: [] });
    }

    // Process with a small concurrency limit so we don't hammer the API.
    const CONCURRENCY = 3;
    const results: Awaited<ReturnType<typeof generateForDispute>>[] = [];
    for (let i = 0; i < disputes.length; i += CONCURRENCY) {
      const batch = disputes.slice(i, i + CONCURRENCY);
      const settled = await Promise.all(
        batch.map((d) =>
          generateForDispute(supabase, d, agencyId, agencyName)
        )
      );
      results.push(...settled);
    }

    await maybeMarkGenerated(supabase, body.roundId);

    return NextResponse.json({
      success: true,
      results: results.map((r) =>
        r.ok
          ? { disputeId: r.disputeId, ok: true }
          : { disputeId: r.disputeId, ok: false, error: r.error }
      ),
    });
  }

  return NextResponse.json(
    { error: "Provide either disputeId or roundId" },
    { status: 400 }
  );
}
