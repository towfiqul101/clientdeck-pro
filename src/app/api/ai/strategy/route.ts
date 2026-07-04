import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { buildStrategyContext, generateStrategy } from "@/lib/claude/strategy";
import type { Client, NegativeItem, DisputeRound, Dispute } from "@/types";

export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  let body: { clientId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const clientId = body.clientId;
  if (!clientId) {
    return NextResponse.json({ ok: false, error: "Missing client." }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();

  const [{ data: client, error: clientError }, { data: items }, { data: rounds }, { data: disputes }] =
    await Promise.all([
      supabase.from("clients").select("*").eq("id", clientId).single(),
      supabase.from("negative_items").select("*").eq("client_id", clientId),
      supabase.from("dispute_rounds").select("*").eq("client_id", clientId),
      supabase.from("disputes").select("*").eq("client_id", clientId),
    ]);

  if (clientError || !client) {
    return NextResponse.json({ ok: false, error: "Client not found." }, { status: 404 });
  }

  const context = buildStrategyContext({
    client: client as Client,
    items: (items ?? []) as NegativeItem[],
    rounds: (rounds ?? []) as DisputeRound[],
    disputes: (disputes ?? []) as Dispute[],
  });

  try {
    const strategy = await generateStrategy(context);
    return NextResponse.json({ ok: true, strategy });
  } catch (e) {
    console.error("[ai/strategy] failed:", e);
    return NextResponse.json(
      { ok: false, error: "Strategy generation failed. Try again." },
      { status: 500 }
    );
  }
}
