import type { AccountType, Bureau, NegativeType } from "@/types";

export interface ParsedItem {
  creditor_name: string;
  account_number_last4: string | null;
  account_type: AccountType | null;
  negative_type: NegativeType;
  balance: number | null;
  date_opened: string | null;
  date_of_first_delinquency: string | null;
}

const ACCOUNT_TYPES: AccountType[] = [
  "credit_card", "auto_loan", "mortgage", "personal_loan", "student_loan",
  "medical", "collection", "utility", "other",
];
const NEGATIVE_TYPES: NegativeType[] = [
  "late_payment", "collection", "charge_off", "repossession", "bankruptcy",
  "foreclosure", "tax_lien", "judgment", "inquiry", "identity_theft",
  "personal_info_error", "duplicate_account", "other",
];

const PARSE_PROMPT = `You are an expert credit report analyst. Analyze this credit report and extract ALL negative items.

For each negative item found, return a JSON object with these exact fields:
{
  "creditor_name": "exact name as shown on report",
  "account_number_last4": "last 4 digits only, or null",
  "account_type": one of: "credit_card"|"auto_loan"|"mortgage"|"personal_loan"|"student_loan"|"medical"|"collection"|"utility"|"other",
  "negative_type": one of: "late_payment"|"collection"|"charge_off"|"repossession"|"bankruptcy"|"foreclosure"|"tax_lien"|"judgment"|"inquiry"|"identity_theft"|"personal_info_error"|"duplicate_account"|"other",
  "balance": number or null (just the number, no $ sign),
  "date_opened": "YYYY-MM-DD" or null,
  "date_of_first_delinquency": "YYYY-MM-DD" or null
}

Return ONLY a valid JSON array of negative items. No explanation, no markdown, no commentary.
If no negative items found, return an empty array: []

Focus on: collections, charge-offs, late payments (30/60/90+), hard inquiries (last 2 years),
bankruptcies, foreclosures, repossessions, tax liens, judgments, personal information errors
(wrong name spelling, old/incorrect addresses, wrong DOB), and duplicate accounts (same creditor +
account number appearing twice). Ignore positive/current accounts and authorized-user accounts
unless they show negative marks.`;

function coerce(raw: unknown): ParsedItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const creditor = typeof o.creditor_name === "string" ? o.creditor_name.trim() : "";
  if (!creditor) return null;

  const negRaw = String(o.negative_type ?? "").trim();
  const negative_type: NegativeType = (NEGATIVE_TYPES as string[]).includes(negRaw)
    ? (negRaw as NegativeType)
    : "other";
  const acctRaw = String(o.account_type ?? "").trim();
  const account_type: AccountType | null = (ACCOUNT_TYPES as string[]).includes(acctRaw)
    ? (acctRaw as AccountType)
    : null;

  const last4Raw = o.account_number_last4;
  const last4 =
    last4Raw == null ? null : String(last4Raw).replace(/\D/g, "").slice(-4) || null;

  const balance: number | null =
    typeof o.balance === "number"
      ? (Number.isFinite(o.balance) ? o.balance : null)
      : typeof o.balance === "string" && o.balance.trim() !== "" && Number.isFinite(Number(o.balance))
        ? Number(o.balance)
        : null;

  const iso = (v: unknown): string | null => {
    if (typeof v !== "string") return null;
    return /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? v.trim() : null;
  };

  return {
    creditor_name: creditor,
    account_number_last4: last4,
    account_type,
    negative_type,
    balance,
    date_opened: iso(o.date_opened),
    date_of_first_delinquency: iso(o.date_of_first_delinquency),
  };
}

/**
 * Sends a base64 PDF to Claude and returns validated, enum-coerced negative
 * items. Never throws for parse issues — returns [] with a note instead.
 */
export async function parseCreditReport(
  base64Pdf: string,
  bureau: Bureau
): Promise<{ items: ParsedItem[]; note?: string }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { items: [], note: "AI parsing unavailable — ANTHROPIC_API_KEY is not set." };
  }

  const promptText = `This is a ${bureau} credit report.\n\n${PARSE_PROMPT}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: base64Pdf },
            },
            { type: "text", text: promptText },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error: ${response.status} — ${err}`);
  }

  const data = await response.json();
  const text: string = (data.content ?? [])
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("\n")
    .trim();

  // Claude is told to return raw JSON, but strip any accidental code fences.
  const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return { items: [], note: "Could not read the report. Try a clearer PDF or add items manually." };
  }
  if (!Array.isArray(parsed)) return { items: [], note: "Unexpected response — no items found." };

  const items = parsed.map(coerce).filter((x): x is ParsedItem => x !== null);
  return { items };
}
