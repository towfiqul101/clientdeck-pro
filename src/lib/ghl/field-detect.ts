import type { GhlFieldKeys } from "@/types";

export interface RawField {
  id?: string;
  name?: string;
  fieldKey?: string;
  dataType?: string;
}

export interface FieldProposal {
  /** Our internal key — only the 3 bureau scores are mappable now. */
  key: keyof GhlFieldKeys;
  label: string;
  /** The GHL fieldKey (or id) we'd map to. */
  ghlKey: string;
  /** Human-readable GHL field name, so the user can see WHAT they're approving. */
  ghlName: string;
  dataType: string;
}

/**
 * Only the three bureau scores remain agency-configurable. Every identity /
 * intake field is now an RTP-owned fixed `rtp__` key (see RTP_IDENTITY_FIELDS)
 * and is not mapped at all.
 *
 * Why: in a GHL location shared with TaxIntake Pro (`ti__*`) and Due Diligence
 * Pro (`dd_*`), name-matching produced real cross-product contamination — the
 * old `/equifax/i` matcher resolved "Equifax Score" to a field named **"Equifax
 * Password"**, `/ssn/i` resolved "SSN Last 4" to a **dependent's** SSN, and
 * `/address/i` resolved "Proof of Address" to a yes/no radio ("DD Address
 * Changed"). Confirmed against a live 367-field location.
 */
const MATCHERS: { key: keyof GhlFieldKeys; label: string; test: RegExp }[] = [
  { key: "score_eq", label: "Equifax Score", test: /equifax|\beq\b.*score|score.*\beq\b/i },
  { key: "score_exp", label: "Experian Score", test: /experian|\bexp\b.*score|score.*\bexp\b/i },
  { key: "score_tu", label: "TransUnion Score", test: /transunion|trans union|\btu\b.*score|score.*\btu\b/i },
];

/**
 * Gate 1 — credentials. A bureau's *password*, login, PIN, or security answer
 * shares every keyword with its score ("Equifax Password" contains "Equifax").
 * Nothing matching this may ever be mapped, regardless of keyword overlap.
 */
const CREDENTIAL_DENYLIST =
  /password|passwd|\bpw\b|login|credential|username|user name|\bpin\b|security question|security answer|secret|answer/i;

/**
 * Gate 2 — other people. A dependent's or spouse's field is the *wrong human*.
 * No format check can catch this (a dependent's "SSN Last 4" is a perfectly
 * well-formed 4 digits), so it must be excluded by name.
 */
const OTHER_PERSON = /dep(endent)?\s*[\s_-]*\d|dependent|spouse/i;

/** Gate 3 — never resolve anything SSN-adjacent to a FULL SSN field. */
const FULL_VALUE = /\bfull\b/i;

/** Gate 4 — scores are numbers. This alone rejects "Equifax Password" [TEXT]. */
const REQUIRED_DATA_TYPE = "NUMERICAL";

/** Foreign products sharing the same GHL location. Deprioritized, not banned. */
const FOREIGN_PREFIX = /^(contact\.)?(dd_|ti__)/i;
/** Our own fields — always preferred when several candidates pass the gates. */
const OWN_PREFIX = /^(contact\.)?rtp__/i;

function fieldId(f: RawField): string {
  return f.fieldKey || f.id || "";
}

/** True when a field is categorically ineligible, whatever it's named. */
function isDisqualified(f: RawField): boolean {
  const haystack = `${f.name ?? ""} ${fieldId(f)}`;
  if (CREDENTIAL_DENYLIST.test(haystack)) return true;
  if (OTHER_PERSON.test(haystack)) return true;
  if (FULL_VALUE.test(haystack)) return true;
  // Type gating: a score must be NUMERICAL. GHL omits dataType on some legacy
  // fields — treat unknown as ineligible rather than guessing (see below).
  if ((f.dataType ?? "").toUpperCase() !== REQUIRED_DATA_TYPE) return true;
  return false;
}

/** Prefer our own `rtp__` fields, then neutral ones, then foreign `dd_`/`ti__`. */
function preference(f: RawField): number {
  const id = fieldId(f);
  if (OWN_PREFIX.test(id)) return 0;
  if (FOREIGN_PREFIX.test(id)) return 2;
  return 1;
}

/**
 * Proposes mappings for the 3 score rows. Never guesses: a row with no
 * candidate passing every gate is simply left out, because a wrong mapping is
 * invisible corruption while a blank row is a visible gap.
 *
 * Returns proposals for the user to APPROVE — callers must not persist these
 * without explicit confirmation.
 */
export function detectFieldProposals(fields: RawField[]): FieldProposal[] {
  const proposals: FieldProposal[] = [];
  const used = new Set<string>();

  for (const { key, label, test } of MATCHERS) {
    const candidates = fields
      .filter((f) => f.name && test.test(f.name))
      .filter((f) => !isDisqualified(f))
      .filter((f) => fieldId(f) && !used.has(fieldId(f)))
      .sort((a, b) => preference(a) - preference(b));

    const best = candidates[0];
    if (!best) continue; // prefer no match over a wrong match

    const id = fieldId(best);
    used.add(id);
    proposals.push({
      key,
      label,
      ghlKey: id,
      ghlName: best.name ?? id,
      dataType: best.dataType ?? "",
    });
  }

  return proposals;
}
