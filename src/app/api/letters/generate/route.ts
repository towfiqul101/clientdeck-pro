import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { findBestTemplate } from "@/lib/claude/template-matcher";
import { generateDisputeLetter, fillTemplateLetter } from "@/lib/claude/generate-letter";
import type { ComplianceResult } from "@/lib/compliance/validate-letter";
import type { Client, Dispute, LetterSource, LetterTemplate, NegativeItem } from "@/types";

export const maxDuration = 300; // letter generation can take a while for big rounds

interface DisputeWithJoins extends Dispute {
  negative_item: NegativeItem;
  client: Client;
  dispute_reason: { label: string } | null;
  dispute_instruction: { label: string } | null;
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

// Staff can pick an exact agency_static template in round-builder
// (dispute.letter_template_id). Honor that pick first; fall back to
// findBestTemplate()'s auto-match when nothing was picked (AI path, or an
// agency_template dispute created before the picker existed) or when the
// picked template was since deactivated/deleted — a stale pointer should
// degrade to auto-match, not hard-fail generation.
async function resolveTemplate(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  dispute: DisputeWithJoins,
  agencyId: string,
  effectiveSource: LetterSource
): Promise<LetterTemplate | null> {
  if (effectiveSource === "agency_template" && dispute.letter_template_id) {
    const { data } = await supabase
      .from("letter_templates")
      .select("*")
      .eq("id", dispute.letter_template_id)
      .eq("is_active", true)
      .or(`agency_id.eq.${agencyId},agency_id.is.null`)
      .maybeSingle();
    if (data) return data as LetterTemplate;
  }
  return findBestTemplate(
    agencyId,
    dispute.negative_item.negative_type,
    dispute.letter_type,
    effectiveSource === "agency_template" ? "agency_static" : "ai_prompt"
  );
}

async function generateForDispute(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  dispute: DisputeWithJoins,
  agencyId: string,
  agencyName: string,
  forceSource?: LetterSource
): Promise<{ disputeId: string; ok: true; content: string; compliance: ComplianceResult } | {
  disputeId: string;
  ok: false;
  error: string;
}> {
  try {
    const effectiveSource: LetterSource = forceSource ?? dispute.letter_source;

    const template = await resolveTemplate(supabase, dispute, agencyId, effectiveSource);
    if (!template) {
      return {
        disputeId: dispute.id,
        ok: false,
        error:
          effectiveSource === "agency_template"
            ? "No matching agency template found for this item type."
            : "No matching letter template found.",
      };
    }

    const previousResult = await priorResult(
      supabase,
      dispute.client_id,
      dispute.negative_item_id,
      dispute.round_id
    );

    const genParams = {
      client: dispute.client,
      item: dispute.negative_item,
      dispute,
      template,
      agencyName,
      previousResult,
      reasonLabel: dispute.dispute_reason?.label,
      instructionLabel: dispute.dispute_instruction?.label,
    };

    const { content, compliance } =
      effectiveSource === "agency_template"
        ? fillTemplateLetter(genParams)
        : await generateDisputeLetter(genParams);

    const { error } = await supabase
      .from("disputes")
      .update({
        letter_content: content,
        compliance_status: compliance.status,
        compliance_checks: compliance.checks,
        compliance_checked_at: new Date().toISOString(),
        ...(forceSource && forceSource !== dispute.letter_source
          ? { letter_source: forceSource }
          : {}),
      })
      .eq("id", dispute.id);
    if (error) {
      return { disputeId: dispute.id, ok: false, error: error.message };
    }

    return { disputeId: dispute.id, ok: true, content, compliance };
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
  roundId: string,
  agencyId: string
) {
  const { count } = await supabase
    .from("disputes")
    .select("id", { count: "exact", head: true })
    .eq("round_id", roundId)
    .is("letter_content", null);
  if ((count ?? 0) === 0) {
    const { error } = await supabase
      .from("dispute_rounds")
      .update({ status: "letters_generated" })
      .eq("id", roundId)
      .eq("status", "preparing");
    if (error) {
      // The letters themselves are already saved at this point (each
      // dispute's own update is checked separately in generateForDispute) —
      // only this status label failed. Logged, not fatal to the response:
      // worst case the round stays showing "preparing" until the next
      // successful generation call retries this same update.
      console.error(`[letters/generate] Failed to mark round ${roundId} letters_generated:`, error);
      await supabase.from("activity_log").insert({
        agency_id: agencyId,
        action: "Round status update failed",
        actor_type: "system",
        description: `Round ${roundId}: all letters generated, but the round's status failed to update to letters_generated: ${error.message}`,
      });
    }
  }
}

const DISPUTE_SELECT =
  "*, negative_item:negative_items(*), client:clients(*), dispute_reason:dispute_reasons(label), dispute_instruction:dispute_instructions(label)";

export async function POST(req: Request) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { disputeId?: string; roundId?: string; forceSource?: LetterSource };
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
      agencyName,
      body.forceSource
    );
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }
    await maybeMarkGenerated(supabase, dispute.round_id, agencyId);
    return NextResponse.json({
      success: true,
      content: result.content,
      compliance: result.compliance,
    });
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
      await maybeMarkGenerated(supabase, body.roundId, agencyId);
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

    await maybeMarkGenerated(supabase, body.roundId, agencyId);

    return NextResponse.json({
      success: true,
      results: results.map((r) =>
        r.ok
          ? { disputeId: r.disputeId, ok: true, compliance: r.compliance }
          : { disputeId: r.disputeId, ok: false, error: r.error }
      ),
    });
  }

  return NextResponse.json(
    { error: "Provide either disputeId or roundId" },
    { status: 400 }
  );
}
