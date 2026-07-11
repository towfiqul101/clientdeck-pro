/**
 * Rule-based (non-AI) pre-send compliance checks for generated dispute
 * letters. Deliberately simple/deterministic — this is a safety net that
 * catches generation failures (truncation, unresolved template variables,
 * a missing statutory citation), not a substitute for staff review. Staff
 * always has final judgment on whether a flagged letter is actually fine.
 */

export type ComplianceCheckId =
  | "missing_citation"
  | "unresolved_placeholder"
  | "too_short"
  | "near_identical_to_template";

export interface ComplianceCheck {
  id: ComplianceCheckId;
  passed: boolean;
  detail: string;
}

export interface ComplianceResult {
  status: "pass" | "flagged";
  checks: ComplianceCheck[];
}

const MIN_WORD_COUNT = 50;
// Word-level Jaccard similarity above this against the raw (unfilled)
// template is treated as "basically the same text" — a properly generated
// letter reads nothing like the template's own instructions, so only a
// genuine injection/generation failure should land this high.
const NEAR_IDENTICAL_THRESHOLD = 0.6;

/** Section numbers the template instructs the writer to cite, e.g. "Section 611" -> "611". */
function extractExpectedSections(promptTemplate: string): string[] {
  const matches = [...promptTemplate.matchAll(/Section\s+(\d{3}[A-Za-z]?)/gi)];
  return [...new Set(matches.map((m) => m[1]))];
}

function checkCitation(letterContent: string, promptTemplate: string): ComplianceCheck {
  const expected = extractExpectedSections(promptTemplate);
  if (expected.length === 0) {
    return {
      id: "missing_citation",
      passed: true,
      detail: "Template doesn't specify a particular FCRA section to cite.",
    };
  }
  const found = expected.some((num) => letterContent.includes(num));
  return {
    id: "missing_citation",
    passed: found,
    detail: found
      ? `Contains the expected citation (Section ${expected.join(" or ")}).`
      : `Template expects a citation to Section ${expected.join(" or ")}, but it wasn't found in the letter.`,
  };
}

function checkPlaceholders(letterContent: string): ComplianceCheck {
  const matches = letterContent.match(/\{\{\s*\w+\s*\}\}/g);
  return {
    id: "unresolved_placeholder",
    passed: !matches,
    detail: matches
      ? `Unresolved template placeholder(s): ${matches.join(", ")}`
      : "No unresolved template placeholders.",
  };
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function checkLength(letterContent: string): ComplianceCheck {
  const count = wordCount(letterContent);
  return {
    id: "too_short",
    passed: count >= MIN_WORD_COUNT,
    detail:
      count >= MIN_WORD_COUNT
        ? `${count} words.`
        : `Only ${count} word(s) — generation may have failed or truncated.`,
  };
}

function wordSet(text: string): Set<string> {
  return new Set(text.toLowerCase().match(/[a-z0-9]+/g) ?? []);
}

function jaccardSimilarity(a: string, b: string): number {
  const setA = wordSet(a);
  const setB = wordSet(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const w of setA) if (setB.has(w)) intersection++;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function checkVariableInjection(letterContent: string, promptTemplate: string): ComplianceCheck {
  const similarity = jaccardSimilarity(letterContent, promptTemplate);
  const passed = similarity < NEAR_IDENTICAL_THRESHOLD;
  return {
    id: "near_identical_to_template",
    passed,
    detail: passed
      ? "Content reads distinctly from the raw template."
      : `Letter is ~${Math.round(similarity * 100)}% similar to the unfilled template — variables may not have been injected.`,
  };
}

export function validateLetterCompliance(
  letterContent: string,
  promptTemplate: string
): ComplianceResult {
  const checks = [
    checkCitation(letterContent, promptTemplate),
    checkPlaceholders(letterContent),
    checkLength(letterContent),
    checkVariableInjection(letterContent, promptTemplate),
  ];
  return {
    status: checks.every((c) => c.passed) ? "pass" : "flagged",
    checks,
  };
}
