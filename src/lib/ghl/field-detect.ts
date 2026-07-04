import type { GhlFieldKeys } from "@/types";

interface RawField {
  id?: string;
  name?: string;
  fieldKey?: string;
}

/** The CDP data keys we try to map, with name-matching heuristics (in order). */
const MATCHERS: { key: keyof GhlFieldKeys; test: RegExp }[] = [
  { key: "ssn_last4", test: /ssn|social security/i },
  { key: "dob", test: /birth|dob|date of birth/i },
  { key: "credit_report_eq", test: /(report).*(equifax|eq\b)|equifax.*report/i },
  { key: "credit_report_exp", test: /(report).*(experian)|experian.*report/i },
  { key: "credit_report_tu", test: /(report).*(transunion|trans union)|transunion.*report/i },
  { key: "score_eq", test: /equifax|\beq score\b/i },
  { key: "score_exp", test: /experian|\bexp score\b/i },
  { key: "score_tu", test: /transunion|trans union|\btu score\b/i },
  { key: "signed_at", test: /sign.*(date|at|on)|date.*sign/i },
  { key: "signature_status", test: /signature|signed/i },
  { key: "id_document", test: /\bid\b|identification|driver.?s? licen/i },
  { key: "proof_of_address", test: /address|utility bill|proof of/i },
];

/**
 * Best-effort mapping of an agency's GHL custom fields onto CDP data keys by
 * matching field names. Report/score matchers run before the looser score
 * matchers so a "Credit Report - Equifax" field maps to the report, not score.
 */
export function detectFieldKeys(fields: RawField[]): GhlFieldKeys {
  const result: GhlFieldKeys = {};
  const used = new Set<string>();

  for (const { key, test } of MATCHERS) {
    if (result[key]) continue;
    const match = fields.find((f) => {
      const id = f.fieldKey || f.id || "";
      return f.name && test.test(f.name) && !used.has(id);
    });
    if (match) {
      const id = match.fieldKey || match.id || "";
      if (id) {
        result[key] = id;
        used.add(id);
      }
    }
  }
  return result;
}
