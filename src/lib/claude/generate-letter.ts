import type { Client, NegativeItem, Dispute, LetterTemplate } from "@/types";

const BUREAU_ADDRESSES: Record<string, string> = {
  equifax:
    "Equifax Information Services LLC\nP.O. Box 740256\nAtlanta, GA 30374-0256",
  experian:
    "Experian\nP.O. Box 4500\nAllen, TX 75013",
  transunion:
    "TransUnion LLC\nConsumer Dispute Center\nP.O. Box 2000\nChester, PA 19016",
};

interface GenerateLetterParams {
  client: Client;
  item: NegativeItem;
  dispute: Dispute;
  template: LetterTemplate;
  agencyName: string;
  agencyAddress?: string;
  previousResult?: string;
}

function buildPromptVariables(params: GenerateLetterParams): Record<string, string> {
  const { client, item, dispute, agencyName } = params;

  return {
    client_name: `${client.first_name} ${client.last_name}`,
    client_address: [
      client.address_line1,
      client.address_line2,
      `${client.city || ""}, ${client.state || ""} ${client.zip || ""}`,
    ]
      .filter(Boolean)
      .join("\n"),
    bureau_name: item.bureau.charAt(0).toUpperCase() + item.bureau.slice(1),
    bureau_address: BUREAU_ADDRESSES[item.bureau] || "",
    creditor_name: item.creditor_name,
    account_type: item.account_type || "Unknown",
    account_last4: item.account_number_last4 || "XXXX",
    balance: item.balance ? `$${item.balance.toFixed(2)}` : "Unknown",
    date_of_first_delinquency: item.date_of_first_delinquency || "Unknown",
    negative_type: item.negative_type,
    round_number: dispute.round_id ? "current" : "1",
    letter_type: dispute.letter_type,
    previous_result: params.previousResult || "N/A",
    today_date: new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    agency_name: agencyName,
    ssn_last4: client.ssn_last4 || "XXXX",
  };
}

function injectVariables(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return result;
}

/**
 * Deterministic FCRA dispute letter used when ANTHROPIC_API_KEY is not set.
 * Lets the whole round → letters → PDF flow be previewed with no API calls.
 */
function generateMockLetter(params: GenerateLetterParams): string {
  const { client, item } = params;
  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const cityStateZip = `${client.city || "[CITY]"}, ${client.state || "[STATE]"} ${client.zip || "[ZIP]"}`;

  return `${today}

${BUREAU_ADDRESSES[item.bureau] || "[BUREAU ADDRESS]"}

RE: Dispute of Inaccurate Information — ${item.creditor_name} (Account ending ${item.account_number_last4 || "XXXX"})

To Whom It May Concern:

I am writing pursuant to my rights under the Fair Credit Reporting Act (FCRA), 15 U.S.C. § 1681 et seq., to dispute inaccurate information appearing on my credit report.

My name is ${client.first_name} ${client.last_name} and I reside at ${client.address_line1 || "[ADDRESS]"}, ${cityStateZip}.

I am disputing the following account which is being reported inaccurately:

Creditor: ${item.creditor_name}
Account Type: ${item.account_type || "Unknown"}
Reported Issue: ${item.negative_type.replace(/_/g, " ").toUpperCase()}
${item.balance ? `Balance: $${item.balance.toFixed(2)}` : ""}

This information is inaccurate and I am requesting that you investigate this matter pursuant to Section 611 of the FCRA (15 U.S.C. § 1681i). Under the FCRA, you are required to conduct a reasonable investigation within 30 days of receiving this dispute.

If you are unable to verify this information with the original furnisher, you are required to delete it from my credit report immediately.

Please provide me with written confirmation of the results of your investigation, including any changes made to my credit report.

Sincerely,

${client.first_name} ${client.last_name}
${client.address_line1 || ""}
${cityStateZip}

Enclosures:
- Copy of Government-issued ID
- Copy of Proof of Address

[THIS IS A PREVIEW LETTER — AI generation requires ANTHROPIC_API_KEY]`;
}

export async function generateDisputeLetter(
  params: GenerateLetterParams
): Promise<{ content: string; tokensUsed: number }> {
  // No API key → return a realistic mock so the app is fully previewable.
  if (!process.env.ANTHROPIC_API_KEY) {
    return { content: generateMockLetter(params), tokensUsed: 0 };
  }

  const variables = buildPromptVariables(params);
  const prompt = injectVariables(params.template.prompt_template, variables);

  const systemPrompt = `You are an expert correspondence writer for credit service agencies. You write professional, legally-informed letters for credit bureaus, creditors, and collection agencies.

IMPORTANT RULES:
- Generate ONLY the letter content — no explanations, no commentary
- Letters must be properly formatted for printing and certified mail
- Use formal business letter format
- Be firm and professional, never threatening or abusive
- Cite relevant laws accurately (FCRA, FDCPA sections)
- Include proper headers: date, recipient address, RE line, salutation
- Include a signature block at the end
- The letter is from the CLIENT, not from the agency
- Do not include [REVIEW REQUIRED] or similar placeholder tags in the letter body`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error: ${response.status} — ${error}`);
  }

  const data = await response.json();
  const content = data.content
    .filter((block: { type: string }) => block.type === "text")
    .map((block: { text: string }) => block.text)
    .join("\n");

  const tokensUsed =
    (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);

  return { content, tokensUsed };
}

export async function generateBulkLetters(
  params: GenerateLetterParams[]
): Promise<{ content: string; tokensUsed: number }[]> {
  // Process in parallel with concurrency limit
  const CONCURRENCY = 3;
  const results: { content: string; tokensUsed: number }[] = [];

  for (let i = 0; i < params.length; i += CONCURRENCY) {
    const batch = params.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.allSettled(
      batch.map((p) => generateDisputeLetter(p))
    );

    for (const result of batchResults) {
      if (result.status === "fulfilled") {
        results.push(result.value);
      } else {
        results.push({
          content: `[ERROR: Letter generation failed — ${result.reason}]`,
          tokensUsed: 0,
        });
      }
    }
  }

  return results;
}
