import type { Client, NegativeItem, Dispute, LetterTemplate } from "@/types";
import { validateLetterCompliance, type ComplianceResult } from "@/lib/compliance/validate-letter";

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
  reasonLabel?: string;
  instructionLabel?: string;
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
    dispute_reason: params.reasonLabel || "N/A",
    instruction: params.instructionLabel || "N/A",
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
 * Make the staff-picked dispute reason/instruction authoritative on the AI
 * path. The template-fill path substitutes {{dispute_reason}}/{{instruction}}
 * directly, but the AI path only saw those values when the template body
 * happened to reference them — and the stock system templates don't, so the
 * pick was silently ignored out of the box. Appending an explicit directive to
 * the user prompt steers Claude around the chosen basis regardless of template
 * authorship. No-op when neither was picked; harmless reinforcement if the
 * template already interpolated them.
 */
function appendDisputeDirective(prompt: string, params: GenerateLetterParams): string {
  const reason = params.reasonLabel?.trim();
  const instruction = params.instructionLabel?.trim();
  if (!reason && !instruction) return prompt;
  const lines: string[] = [];
  if (reason) lines.push(`- Dispute reason: ${reason}`);
  if (instruction) lines.push(`- Requested action: ${instruction}`);
  return `${prompt}

The consumer has specified the basis for this dispute. Write the letter around the following — do not substitute a different rationale or requested action:
${lines.join("\n")}`;
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

/**
 * Static system prompt: rules + anonymized few-shot examples (609/611/623),
 * one per template type, to anchor citation accuracy and formatting. Cached
 * as a single block — see the `cache_control` usage below.
 */
const LETTER_SYSTEM_PROMPT = `You are an expert correspondence writer for credit service agencies. You write professional, legally-informed letters for credit bureaus, creditors, and collection agencies.

IMPORTANT RULES:
- Generate ONLY the letter content — no explanations, no commentary
- Letters must be properly formatted for printing and certified mail
- Use formal business letter format
- Be firm and professional, never threatening or abusive
- Cite relevant laws accurately (FCRA, FDCPA sections)
- Include proper headers: date, recipient address, RE line, salutation
- Include a signature block at the end
- The letter is from the CLIENT, not from the agency
- Do not include [REVIEW REQUIRED] or similar placeholder tags in the letter body

EXAMPLE LETTERS (anonymized past output — match this tone, structure, and citation style):

--- Example 1: §609 direct dispute ---
March 3, 2026

Equifax Information Services LLC
P.O. Box 740256
Atlanta, GA 30374-0256

RE: Dispute of Inaccurate Information — Capital One (Account ending 4821)

To Whom It May Concern:

Pursuant to Section 609 of the Fair Credit Reporting Act (15 U.S.C. § 1681g), I am requesting full disclosure of the information your agency maintains regarding the above account, and I am formally disputing its accuracy and completeness.

My name is Jordan Ellis and I reside at 214 Larkspur Lane, Denver, CO 80203.

The account listed above is being reported inaccurately. I have no records substantiating this debt as reported, and I request that you verify this information directly with the original creditor rather than relying on automated confirmation.

Under 15 U.S.C. § 1681i, you are required to conduct a reasonable reinvestigation within 30 days of receipt of this letter. If the information cannot be verified, it must be deleted from my credit file.

Please send written confirmation of the results of your investigation, along with an updated copy of my credit report reflecting any changes.

Sincerely,

Jordan Ellis
214 Larkspur Lane
Denver, CO 80203

Enclosures:
- Copy of Government-issued ID
- Copy of Proof of Address

--- Example 2: §611 method-of-verification (MOV) follow-up ---
March 10, 2026

Experian
P.O. Box 4500
Allen, TX 75013

RE: Request for Method of Verification — Midland Funding (Account ending 7734)

To Whom It May Concern:

I previously disputed the above account and was informed that it had been "verified." Pursuant to Section 611 of the Fair Credit Reporting Act (15 U.S.C. § 1681i(a)(7)), I am requesting the method of verification used to confirm this account, including the name, address, and telephone number of the furnisher contacted and a description of the specific documents reviewed.

My name is Priya Nagarajan and I reside at 88 Willow Creek Drive, Austin, TX 78704.

A conclusory "verified" response without a documented, reasonable investigation does not satisfy your obligations under the FCRA. If your agency cannot produce specific evidence of how this account was verified, it must be deleted from my credit file immediately.

Please respond in writing within 15 days with either the requested verification details or confirmation of deletion.

Sincerely,

Priya Nagarajan
88 Willow Creek Drive
Austin, TX 78704

--- Example 3: §623 furnisher dispute ---
March 17, 2026

LVNV Funding LLC
Attn: Consumer Disputes
P.O. Box 1269
Greenville, SC 29602

RE: Direct Dispute of Furnished Information — Account ending 5590

To Whom It May Concern:

Pursuant to Section 623(b) of the Fair Credit Reporting Act (15 U.S.C. § 1681s-2(b)), I am directly disputing the accuracy of the account referenced above, which your company has furnished to the consumer reporting agencies.

My name is Marcus Webb and I reside at 4410 Cedar Hollow Court, Charlotte, NC 28211.

I have no record of this account and dispute that it belongs to me or is being reported accurately. As a furnisher, you are required under 15 U.S.C. § 1681s-2(b) to conduct a reasonable investigation and to notify each consumer reporting agency of any inaccurate or incomplete information you identify.

If you are unable to substantiate this account, please instruct all consumer reporting agencies to which you furnished this information to delete it, and confirm in writing once this has been completed.

Sincerely,

Marcus Webb
4410 Cedar Hollow Court
Charlotte, NC 28211

--- End of examples ---

Now write the requested letter, following the same tone, structure, and citation precision as the examples above.`;

export async function generateDisputeLetter(
  params: GenerateLetterParams
): Promise<{ content: string; tokensUsed: number; compliance: ComplianceResult }> {
  // No API key → return a realistic mock so the app is fully previewable.
  if (!process.env.ANTHROPIC_API_KEY) {
    const content = generateMockLetter(params);
    return {
      content,
      tokensUsed: 0,
      compliance: validateLetterCompliance(content, params.template.prompt_template),
    };
  }

  const variables = buildPromptVariables(params);
  const prompt = appendDisputeDirective(
    injectVariables(params.template.prompt_template, variables),
    params
  );

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      // Kept on Sonnet intentionally — this is client-facing legal
      // correspondence, not an internal tool. Sonnet 5 (claude-sonnet-5) has
      // introductory pricing of $2/$10 per MTok through 2026-08-31 vs Sonnet
      // 4.6's $3/$15, so it's a candidate for this constant — but run a
      // side-by-side accuracy test on citation correctness/formatting first.
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      // Static rules + few-shot examples are identical on every call, so
      // they're cached separately from `prompt` (per-client variables:
      // name, items, dates) below, which changes every call and must not
      // carry cache_control.
      system: [
        {
          type: "text",
          text: LETTER_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
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

  const usage = data.usage ?? {};
  console.log("[claude:usage] generate-letter", {
    model: "claude-sonnet-4-6",
    letter_type: params.dispute.letter_type,
    input_tokens: usage.input_tokens ?? 0,
    output_tokens: usage.output_tokens ?? 0,
    cache_read_input_tokens: usage.cache_read_input_tokens ?? 0,
    cache_creation_input_tokens: usage.cache_creation_input_tokens ?? 0,
  });

  const tokensUsed =
    (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);

  return {
    content,
    tokensUsed,
    compliance: validateLetterCompliance(content, params.template.prompt_template),
  };
}

/**
 * Deterministic variable-fill for an agency_static template — no API call.
 * The near-identical-to-template compliance check is skipped here on
 * purpose: a fill letter is *always* near-identical to its source template
 * by design, so that check would false-positive on every single one.
 */
export function fillTemplateLetter(
  params: GenerateLetterParams
): { content: string; compliance: ComplianceResult } {
  const variables = buildPromptVariables(params);
  const content = injectVariables(params.template.prompt_template, variables);
  return {
    content,
    compliance: validateLetterCompliance(
      content,
      params.template.prompt_template,
      { skipNearIdenticalCheck: true }
    ),
  };
}

export async function generateBulkLetters(
  params: GenerateLetterParams[]
): Promise<{ content: string; tokensUsed: number; compliance: ComplianceResult }[]> {
  // Process in parallel with concurrency limit
  const CONCURRENCY = 3;
  const results: { content: string; tokensUsed: number; compliance: ComplianceResult }[] = [];

  for (let i = 0; i < params.length; i += CONCURRENCY) {
    const batch = params.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.allSettled(
      batch.map((p) => generateDisputeLetter(p))
    );

    for (const result of batchResults) {
      if (result.status === "fulfilled") {
        results.push(result.value);
      } else {
        const content = `[ERROR: Letter generation failed — ${result.reason}]`;
        results.push({
          content,
          tokensUsed: 0,
          compliance: { status: "flagged", checks: [] },
        });
      }
    }
  }

  return results;
}
