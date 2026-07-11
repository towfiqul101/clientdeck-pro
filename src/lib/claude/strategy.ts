import type { Client, NegativeItem, DisputeRound, Dispute } from "@/types";

/**
 * Builds a plain-text context block for the strategist prompt from
 * already-fetched (RLS-scoped) rows. No DB access here — pure formatting.
 */
export function buildStrategyContext(input: {
  client: Client;
  items: NegativeItem[];
  rounds: DisputeRound[];
  disputes: Dispute[];
}): string {
  const { client, items, rounds, disputes } = input;
  const lastResult = (itemId: string): string => {
    const ds = disputes
      .filter((d) => d.negative_item_id === itemId && d.result !== "pending")
      .sort((a, b) => (a.result_date ?? "").localeCompare(b.result_date ?? ""));
    return ds.length ? ds[ds.length - 1].result : "none yet";
  };
  return `CLIENT: ${client.first_name} ${client.last_name}
CREDIT GOAL: ${client.credit_goal ?? "N/A"}
SERVICE START: ${client.service_start_date}
CURRENT ROUND: ${client.current_round}

SCORES:
- Equifax: ${client.score_eq_start ?? "?"} → ${client.score_eq_current ?? "?"}
- Experian: ${client.score_exp_start ?? "?"} → ${client.score_exp_current ?? "?"}
- TransUnion: ${client.score_tu_start ?? "?"} → ${client.score_tu_current ?? "?"}

NEGATIVE ITEMS AND DISPUTE HISTORY:
${items.map((it) => `- ${it.creditor_name} (${it.bureau}) — ${it.negative_type}
  Balance: ${it.balance ?? "N/A"} | Status: ${it.dispute_status} | Rounds disputed: ${it.round_disputed ?? "not yet"} | Last result: ${lastResult(it.id)}`).join("\n")}

ROUND HISTORY:
${rounds.map((r) => `Round ${r.round_number}: ${r.status} — ${r.total_deletions} deleted, ${r.total_verified} verified, ${r.total_no_response} no response`).join("\n")}`;
}

/**
 * Static instructions, identical on every call — cached separately from the
 * per-client `context` (built in buildStrategyContext) below, which changes
 * every call and must not carry cache_control. Short enough (well under the
 * ~4096-token minimum cacheable prefix on Haiku 4.5) that cache writes will
 * likely no-op today (cache_creation_input_tokens: 0) — harmless, and pays
 * off automatically if this prompt grows.
 */
const STRATEGY_SYSTEM_PROMPT = `You are an expert credit repair strategist with deep knowledge of FCRA, FDCPA, and bureau dispute tactics.

Analyze the client's situation and provide specific, actionable dispute strategy recommendations.

Provide:
1. A brief overall assessment (2 sentences)
2. Specific recommendation for each remaining negative item (letter type, strategy, why)
3. Priority order
4. Overall outlook (how many more rounds estimated)
5. Special tactics (CFPB complaints, debt validation, goodwill letters)

Reference specific FCRA sections where relevant. Keep it concise — this is for credit repair professionals.`;

/**
 * Calls Claude for dispute-strategy recommendations. Never throws when the
 * API key is unset — returns a clear "unavailable" string so the panel and
 * route can render it directly without special-casing a missing key.
 */
export async function generateStrategy(context: string): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return "AI strategy is unavailable — add ANTHROPIC_API_KEY to enable this feature.";
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      // Internal staff-facing suggestion panel, not a client-facing legal
      // document — Haiku is sufficient here and meaningfully cheaper than Sonnet.
      model: "claude-haiku-4-5",
      max_tokens: 1500,
      system: [
        {
          type: "text",
          text: STRATEGY_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: context }],
    }),
  });
  if (!res.ok) throw new Error(`Claude API error: ${res.status}`);
  const data = await res.json();

  const usage = data.usage ?? {};
  console.log("[claude:usage] strategy", {
    model: "claude-haiku-4-5",
    input_tokens: usage.input_tokens ?? 0,
    output_tokens: usage.output_tokens ?? 0,
    cache_read_input_tokens: usage.cache_read_input_tokens ?? 0,
    cache_creation_input_tokens: usage.cache_creation_input_tokens ?? 0,
  });

  return (data.content ?? [])
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("\n")
    .trim();
}
