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
 * Calls Claude for dispute-strategy recommendations. Never throws when the
 * API key is unset — returns a clear "unavailable" string so the panel and
 * route can render it directly without special-casing a missing key.
 */
export async function generateStrategy(context: string): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return "AI strategy is unavailable — add ANTHROPIC_API_KEY to enable this feature.";
  }
  const prompt = `You are an expert credit repair strategist with deep knowledge of FCRA, FDCPA, and bureau dispute tactics.

Analyze this client's situation and provide specific, actionable dispute strategy recommendations.

${context}

Provide:
1. A brief overall assessment (2 sentences)
2. Specific recommendation for each remaining negative item (letter type, strategy, why)
3. Priority order
4. Overall outlook (how many more rounds estimated)
5. Special tactics (CFPB complaints, debt validation, goodwill letters)

Reference specific FCRA sections where relevant. Keep it concise — this is for credit repair professionals.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Claude API error: ${res.status}`);
  const data = await res.json();
  return (data.content ?? [])
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("\n")
    .trim();
}
