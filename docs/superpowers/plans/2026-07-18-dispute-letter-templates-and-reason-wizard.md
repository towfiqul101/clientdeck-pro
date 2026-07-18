# Agency Static Templates, Letter-Source Choice & Dispute Reason/Instruction Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let agencies upload their own static (variable-fill, no-AI) letter templates, let staff choose AI-generation vs template-fill per letter at round creation, and inject a staff-picked standard dispute reason + instruction into whichever path is used.

**Architecture:** One new migration adds a `kind` column to `letter_templates` and two new small reference tables (`dispute_reasons`, `dispute_instructions`) plus three columns on `disputes`. The existing per-item picker in the round-creation flow (`round-builder.tsx`) grows three more controls (reason, instruction, AI-vs-template source) whose choices are persisted onto each `disputes` row at round creation. The existing generation endpoint (`/api/letters/generate`) branches on the stored `letter_source` to call either the existing Claude path or a new local variable-fill path, both funneling into the same review/compliance/send flow untouched.

**Tech Stack:** Next.js 16 App Router (Server Components + Server Actions), Supabase (Postgres + RLS), TypeScript. No new npm dependencies.

## Global Constraints

- **No automated test framework exists in this repo** (`package.json` has no
  Jest/Vitest/pytest, zero `*.test.ts` files anywhere). This plan does NOT
  follow classic red/green TDD with a test runner. Each task's verification
  step is `npx tsc --noEmit` (this repo's actual pre-existing safety net,
  per `npm run build` / `.claude/skills/verify/SKILL.md`) plus, where the
  code is a pure function, a throwaway manual check — not a permanent test
  file, since there's no runner to keep it in. This is a deliberate,
  flagged deviation from the writing-plans template's default TDD steps,
  not an oversight.
- **No new npm dependencies.** Everything here reuses libraries already in
  `package.json`.
- **The migration cannot be applied by the assistant.** There is no working
  Supabase MCP/CLI access to this project (see
  `docs/superpowers/specs/2026-07-18-dispute-letter-templates-and-reason-wizard-design.md`
  and the memory `supabase-access-constraint.md`). Task 1 produces the SQL
  file; the user must run it in the Supabase SQL editor before Tasks 9-13's
  new UI can be exercised against a real database. Tasks 2-8 and 10-13's
  code changes still compile and lint cleanly before that, since Supabase
  responses are consumed through type assertions (`as X`), not structural
  object literals, everywhere in this codebase.
- **Follow existing patterns exactly:** Server Components fetch data and
  pass typed props to Client Components; mutations go through `"use
  server"` action files colocated with the route (`actions.ts`); UI reuses
  `src/components/ui/{button,field,card,modal,toast}.tsx`; RLS policies
  mirror the existing `letter_templates` policies (see Task 1).
- **Never mark work verified without actually running the listed command
  and reading its output.**

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/038_dispute_reasons_and_template_kind.sql`

**Interfaces:**
- Produces: `letter_templates.kind` (`'ai_prompt' | 'agency_static'`, default `'ai_prompt'`); tables `dispute_reasons` and `dispute_instructions` (`id, agency_id, label, is_system, is_active, sort_order, created_at`); `disputes.dispute_reason_id`, `disputes.dispute_instruction_id`, `disputes.letter_source` (`'ai' | 'agency_template'`, default `'ai'`).

- [ ] **Step 1: Write the migration file**

```sql
-- ============================================
-- 038. DISPUTE REASONS, INSTRUCTIONS & TEMPLATE KIND
-- ============================================
-- Adds agency-static letter templates (variable-fill, no AI call) as an
-- alternative to AI-prompt templates, plus a standard dispute reason /
-- instruction picker that feeds both letter-generation paths.

-- 1. letter_templates: split AI-prompt vs agency-static templates
ALTER TABLE letter_templates
  ADD COLUMN kind TEXT NOT NULL DEFAULT 'ai_prompt'
    CHECK (kind IN ('ai_prompt', 'agency_static'));

-- 2. Standard dispute reasons (system defaults + agency custom additions)
CREATE TABLE dispute_reasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  is_system BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE dispute_reasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "See system and own dispute reasons" ON dispute_reasons
  FOR SELECT USING (
    is_system = true
    OR agency_id = get_user_agency_id()
  );

CREATE POLICY "Agency manages own dispute reasons" ON dispute_reasons
  FOR INSERT WITH CHECK (agency_id = get_user_agency_id() AND is_system = false);

CREATE POLICY "Agency deletes own dispute reasons" ON dispute_reasons
  FOR DELETE USING (agency_id = get_user_agency_id() AND is_system = false);

INSERT INTO dispute_reasons (label, is_system, sort_order) VALUES
  ('Inaccurate / Not Mine', true, 1),
  ('Not Mine', true, 2),
  ('Duplicate Account', true, 3),
  ('Obsolete (Past Reporting Period)', true, 4),
  ('Identity Theft / Fraudulent Account', true, 5),
  ('Incorrect Balance', true, 6),
  ('Incorrect Payment History', true, 7);

-- 3. Standard dispute instructions (system defaults + agency custom additions)
CREATE TABLE dispute_instructions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  is_system BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE dispute_instructions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "See system and own dispute instructions" ON dispute_instructions
  FOR SELECT USING (
    is_system = true
    OR agency_id = get_user_agency_id()
  );

CREATE POLICY "Agency manages own dispute instructions" ON dispute_instructions
  FOR INSERT WITH CHECK (agency_id = get_user_agency_id() AND is_system = false);

CREATE POLICY "Agency deletes own dispute instructions" ON dispute_instructions
  FOR DELETE USING (agency_id = get_user_agency_id() AND is_system = false);

INSERT INTO dispute_instructions (label, is_system, sort_order) VALUES
  ('Delete', true, 1),
  ('Correct', true, 2),
  ('Verify', true, 3);

-- 4. disputes: record the chosen reason/instruction + which letter path was used
ALTER TABLE disputes
  ADD COLUMN dispute_reason_id UUID REFERENCES dispute_reasons(id) ON DELETE SET NULL,
  ADD COLUMN dispute_instruction_id UUID REFERENCES dispute_instructions(id) ON DELETE SET NULL,
  ADD COLUMN letter_source TEXT NOT NULL DEFAULT 'ai'
    CHECK (letter_source IN ('ai', 'agency_template'));
```

- [ ] **Step 2: Review the file against the existing pattern**

Open `supabase/migrations/002_rls_policies.sql` and confirm section-by-section
that the new file's RLS policies for `dispute_reasons`/`dispute_instructions`
match the exact shape of the `letter_templates` policies there (same
`get_user_agency_id()` function, same `is_system = false` guard on
INSERT/DELETE, no UPDATE policy needed since neither this plan nor the spec
calls for in-place editing of reasons/instructions).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/038_dispute_reasons_and_template_kind.sql
git commit -m "feat: add dispute reasons/instructions and template kind migration"
```

**Note for the user:** this file needs to be run in the Supabase SQL editor
before Tasks 9 through 13 can be exercised against real data. Tasks 2-8 and
the rest of 10-13 compile without it.

---

### Task 2: Types & Constants

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/lib/constants.ts`

**Interfaces:**
- Produces: types `TemplateKind`, `LetterSource`, `DisputeReason`, `DisputeInstruction`; `LetterTemplate.kind: TemplateKind`; `Dispute.dispute_reason_id: string | null`, `Dispute.dispute_instruction_id: string | null`, `Dispute.letter_source: LetterSource`; constants `TEMPLATE_KINDS`, `LETTER_SOURCES`.

- [ ] **Step 1: Add the new types to `src/types/index.ts`**

Find this line (near the top, alongside the other type unions):

```ts
export type LetterType = "initial_dispute" | "method_of_verification" | "escalation" | "goodwill" | "debt_validation" | "cfpb_complaint" | "identity_theft" | "custom";
```

Add directly below it:

```ts
export type TemplateKind = "ai_prompt" | "agency_static";
export type LetterSource = "ai" | "agency_template";
```

Find the `Dispute` interface and add three fields (after `letter_type: LetterType;`):

```ts
export interface Dispute {
  id: string;
  round_id: string;
  client_id: string;
  agency_id: string;
  negative_item_id: string;
  bureau: Bureau;
  letter_type: LetterType;
  dispute_reason_id: string | null;
  dispute_instruction_id: string | null;
  letter_source: LetterSource;
  letter_content: string | null;
  letter_pdf_url: string | null;
  certified_mail_number: string | null;
  is_finalized: boolean;
  finalized_at: string | null;
  result: DisputeResult;
  result_date: string | null;
  result_notes: string | null;
  compliance_status: "pass" | "flagged" | null;
  compliance_checks: import("@/lib/compliance/validate-letter").ComplianceCheck[] | null;
  compliance_checked_at: string | null;
  created_at: string;
  updated_at: string;
}
```

Find the `LetterTemplate` interface and add `kind` (after `agency_id: string | null;`):

```ts
export interface LetterTemplate {
  id: string;
  agency_id: string | null;
  kind: TemplateKind;
  name: string;
  description: string | null;
  negative_type: string | null;
  letter_type: LetterType;
  round_suggestion: number | null;
  prompt_template: string;
  is_system: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
```

Add two new interfaces directly after `LetterTemplate`:

```ts
export interface DisputeReason {
  id: string;
  agency_id: string | null;
  label: string;
  is_system: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface DisputeInstruction {
  id: string;
  agency_id: string | null;
  label: string;
  is_system: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}
```

- [ ] **Step 2: Add constants to `src/lib/constants.ts`**

Change the top import block from:

```ts
import type {
  AccountType,
  Bureau,
  ClientStatus,
  CreditGoal,
  CreditScoreRange,
  DisputeStatus,
  EmploymentStatus,
  LetterType,
  NegativeType,
  PaymentStatus,
  ResultsTimeline,
} from "@/types";
```

to:

```ts
import type {
  AccountType,
  Bureau,
  ClientStatus,
  CreditGoal,
  CreditScoreRange,
  DisputeStatus,
  EmploymentStatus,
  LetterSource,
  LetterType,
  NegativeType,
  PaymentStatus,
  ResultsTimeline,
  TemplateKind,
} from "@/types";
```

Find the `LETTER_TYPES` constant and add two new constants directly after it:

```ts
export const TEMPLATE_KINDS: { value: TemplateKind; label: string }[] = [
  { value: "ai_prompt", label: "AI Prompt" },
  { value: "agency_static", label: "Agency Template" },
];

export const LETTER_SOURCES: { value: LetterSource; label: string }[] = [
  { value: "ai", label: "Generate with AI" },
  { value: "agency_template", label: "Use our template" },
];
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: no errors (every existing consumer of `LetterTemplate`/`Dispute`
reads DB rows through a type assertion, not a strict object literal, so
adding required fields to these interfaces doesn't break any existing call
site — confirmed by inspection of `templates/actions.ts`'s `previewClient()`
et al., which already cast `as unknown as X`).

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts src/lib/constants.ts
git commit -m "feat: add types/constants for template kind and dispute reason wizard"
```

---

### Task 3: Compliance — skip the near-identical check for template-fill letters

**Files:**
- Modify: `src/lib/compliance/validate-letter.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `validateLetterCompliance(letterContent, promptTemplate, opts?: { skipNearIdenticalCheck?: boolean })` — 3rd param is new and optional, so every existing call site (both in `generate-letter.ts` today) is unaffected.

- [ ] **Step 1: Modify the function signature and body**

Find:

```ts
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
```

Replace with:

```ts
export function validateLetterCompliance(
  letterContent: string,
  promptTemplate: string,
  opts?: { skipNearIdenticalCheck?: boolean }
): ComplianceResult {
  const checks = [
    checkCitation(letterContent, promptTemplate),
    checkPlaceholders(letterContent),
    checkLength(letterContent),
    ...(opts?.skipNearIdenticalCheck
      ? []
      : [checkVariableInjection(letterContent, promptTemplate)]),
  ];
  return {
    status: checks.every((c) => c.passed) ? "pass" : "flagged",
    checks,
  };
}
```

- [ ] **Step 2: Manual check (no test runner — verify with a throwaway script)**

`tsx` has no inline-eval flag (`-e` is not supported — confirmed against
this repo's actual `tsx v4.23.0`), so write a real temporary script file at
the repo root, run it, then delete it. `tsx` DOES resolve this project's
`@/*` path alias when run as a file from the repo root (confirmed: a
`@/lib/...` import ran clean here) — that's what makes this check
meaningful instead of just re-reading the diff.

Create `scratch-check.ts` at the repo root:

```ts
import { validateLetterCompliance } from "@/lib/compliance/validate-letter";

const template = "Dear Sir, RE: {{creditor_name}}. Please investigate under Section 611.";
const filled = "Dear Sir, RE: Capital One. Please investigate under Section 611. Sincerely, Jane Doe, 123 Main St, Austin TX. This letter continues with enough additional words to clear the fifty word minimum threshold for the compliance length check so it passes cleanly across every single one of the four checks that this function is capable of running against arbitrary letter content in this codebase today.";

const withCheck = validateLetterCompliance(filled, template);
const withoutCheck = validateLetterCompliance(filled, template, { skipNearIdenticalCheck: true });
console.log("checks with near-identical check:", withCheck.checks.length, withCheck.status);
console.log("checks with it skipped:", withoutCheck.checks.length, withoutCheck.status);
```

Run: `npx tsx scratch-check.ts`
Expected: first line shows `4 flagged` (the near-identical check fails
because `filled` is mostly copy-pasted from `template`), second line shows
`3 pass` (same content, but with only the 3 always-relevant checks run).

Then delete the scratch file: `rm scratch-check.ts` (it must never be
committed).

- [ ] **Step 3: Run the full type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/compliance/validate-letter.ts
git commit -m "feat: allow skipping the near-identical compliance check"
```

---

### Task 4: `generate-letter.ts` — reason/instruction variables + template-fill path

**Files:**
- Modify: `src/lib/claude/generate-letter.ts`

**Interfaces:**
- Consumes: `validateLetterCompliance(content, promptTemplate, opts?)` from Task 3.
- Produces: `GenerateLetterParams.reasonLabel?: string`, `GenerateLetterParams.instructionLabel?: string`; new export `fillTemplateLetter(params: GenerateLetterParams): { content: string; compliance: ComplianceResult }`.

- [ ] **Step 1: Add the two new params**

Find:

```ts
interface GenerateLetterParams {
  client: Client;
  item: NegativeItem;
  dispute: Dispute;
  template: LetterTemplate;
  agencyName: string;
  agencyAddress?: string;
  previousResult?: string;
}
```

Replace with:

```ts
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
```

- [ ] **Step 2: Inject the two new variables**

Find (the end of `buildPromptVariables`):

```ts
    agency_name: agencyName,
    ssn_last4: client.ssn_last4 || "XXXX",
  };
}
```

Replace with:

```ts
    agency_name: agencyName,
    ssn_last4: client.ssn_last4 || "XXXX",
    dispute_reason: params.reasonLabel || "N/A",
    instruction: params.instructionLabel || "N/A",
  };
}
```

- [ ] **Step 3: Add the `fillTemplateLetter` export**

Add directly after the closing brace of `generateDisputeLetter` (before
`export async function generateBulkLetters`):

```ts
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
```

- [ ] **Step 4: Manual check**

Same pattern as Task 3 Step 2 — write a temporary `scratch-check.ts` at the
repo root:

```ts
import { fillTemplateLetter } from "@/lib/claude/generate-letter";

const result = fillTemplateLetter({
  client: { first_name: "Jane", last_name: "Doe", address_line1: "123 Main St", address_line2: null, city: "Austin", state: "TX", zip: "78701", ssn_last4: "1234" } as any,
  item: { bureau: "equifax", creditor_name: "Capital One", account_type: "credit_card", account_number_last4: "4321", balance: 850, date_of_first_delinquency: "2023-01-15", negative_type: "collection" } as any,
  dispute: { round_id: "x", letter_type: "initial_dispute" } as any,
  template: { prompt_template: "RE: {{creditor_name}}. Reason: {{dispute_reason}}. Action requested: {{instruction}}." } as any,
  agencyName: "Test Agency",
  reasonLabel: "Inaccurate / Not Mine",
  instructionLabel: "Delete",
});
console.log(result.content);
console.log(result.compliance.checks.map((c) => c.id));
```

Run: `npx tsx scratch-check.ts`
Expected: prints `RE: Capital One. Reason: Inaccurate / Not Mine. Action
requested: Delete.` and a checks array WITHOUT `near_identical_to_template`
in it (3 entries: `missing_citation`, `unresolved_placeholder`,
`too_short`).

Then delete the scratch file: `rm scratch-check.ts`.

- [ ] **Step 5: Type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/claude/generate-letter.ts
git commit -m "feat: add dispute reason/instruction variables and template-fill letter path"
```

---

### Task 5: `template-matcher.ts` — kind-scoped matching

**Files:**
- Modify: `src/lib/claude/template-matcher.ts`

**Interfaces:**
- Consumes: `TemplateKind` type from `@/types`.
- Produces: `findBestTemplate(agencyId, negativeType, letterType, kind: TemplateKind = "ai_prompt")` — 4th param is new with a default, so the existing 3-arg call site in `api/letters/generate/route.ts` keeps compiling unchanged until Task 12 updates it.

- [ ] **Step 1: Add the `kind` parameter**

Find:

```ts
import { createAdminClient } from "@/lib/supabase/admin";
import type { LetterTemplate } from "@/types";
```

Replace with:

```ts
import { createAdminClient } from "@/lib/supabase/admin";
import type { LetterTemplate, TemplateKind } from "@/types";
```

Find:

```ts
export async function findBestTemplate(
  agencyId: string,
  negativeType: string,
  letterType: string
): Promise<LetterTemplate | null> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("letter_templates")
    .select("*")
    .eq("is_active", true)
    .or(`agency_id.eq.${agencyId},agency_id.is.null`);
```

Replace with:

```ts
export async function findBestTemplate(
  agencyId: string,
  negativeType: string,
  letterType: string,
  kind: TemplateKind = "ai_prompt"
): Promise<LetterTemplate | null> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("letter_templates")
    .select("*")
    .eq("is_active", true)
    .eq("kind", kind)
    .or(`agency_id.eq.${agencyId},agency_id.is.null`);
```

- [ ] **Step 2: Update the doc comment**

Find the line `* Uses the service-role client so it can read system templates (agency_id NULL)` and the line above it; directly below the existing 5-step priority list in the comment, add one line:

```ts
 * All of the above is additionally scoped to the requested `kind`
 * ('ai_prompt' or 'agency_static') — an agency_static request never
 * matches an ai_prompt template and vice versa.
```

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/claude/template-matcher.ts
git commit -m "feat: scope template matching by kind (ai_prompt vs agency_static)"
```

---

### Task 6: Templates settings — kind selector in `template-form.tsx`

**Files:**
- Modify: `src/app/(dashboard)/templates/template-form.tsx`

**Interfaces:**
- Consumes: `TEMPLATE_KINDS` from `@/lib/constants` (Task 2); `TemplateKind` from `@/types` (Task 2).
- Produces: the `submit()` input object now includes `kind`, consumed by Task 7's `createTemplate`/`updateTemplate`.

- [ ] **Step 1: Import the new constant and type**

Find:

```ts
import { LETTER_TYPES, NEGATIVE_TYPES } from "@/lib/constants";
import { createTemplate, updateTemplate, previewTemplateLetter } from "./actions";
import type { LetterTemplate, LetterType, NegativeType } from "@/types";
```

Replace with:

```ts
import { LETTER_TYPES, NEGATIVE_TYPES, TEMPLATE_KINDS } from "@/lib/constants";
import { createTemplate, updateTemplate, previewTemplateLetter } from "./actions";
import type { LetterTemplate, LetterType, NegativeType, TemplateKind } from "@/types";
```

- [ ] **Step 2: Add `dispute_reason`/`instruction` to the variables picker**

Find:

```ts
const VARIABLES = [
  "client_name",
  "client_address",
  "bureau_name",
  "bureau_address",
  "creditor_name",
  "account_type",
  "account_last4",
  "balance",
  "date_of_first_delinquency",
  "negative_type",
  "round_number",
  "letter_type",
  "previous_result",
  "today_date",
  "agency_name",
  "ssn_last4",
];
```

Replace with:

```ts
const VARIABLES = [
  "client_name",
  "client_address",
  "bureau_name",
  "bureau_address",
  "creditor_name",
  "account_type",
  "account_last4",
  "balance",
  "date_of_first_delinquency",
  "negative_type",
  "round_number",
  "letter_type",
  "previous_result",
  "today_date",
  "agency_name",
  "ssn_last4",
  "dispute_reason",
  "instruction",
];
```

- [ ] **Step 3: Add `kind` state and wire it into `submit()`**

Find:

```ts
  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
```

Replace with:

```ts
  const [name, setName] = useState(template?.name ?? "");
  const [kind, setKind] = useState<TemplateKind>(template?.kind ?? "ai_prompt");
  const [description, setDescription] = useState(template?.description ?? "");
```

Find:

```ts
  function submit() {
    setError(null);
    const input = {
      name,
      description,
      negativeType,
      letterType,
      roundSuggestion: roundSuggestion ? Number(roundSuggestion) : null,
      promptTemplate,
      isActive,
    };
```

Replace with:

```ts
  function submit() {
    setError(null);
    const input = {
      name,
      kind,
      description,
      negativeType,
      letterType,
      roundSuggestion: roundSuggestion ? Number(roundSuggestion) : null,
      promptTemplate,
      isActive,
    };
```

- [ ] **Step 4: Add the Kind field to the form and relabel the body field**

Find:

```tsx
        <Field label="Name" htmlFor="name">
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Description" htmlFor="description">
```

Replace with:

```tsx
        <Field label="Name" htmlFor="name">
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field
          label="Kind"
          htmlFor="kind"
          hint={
            kind === "agency_static"
              ? "The exact letter text, filled in with {{variables}} — no AI call."
              : "Instructions for Claude to draft the letter from."
          }
        >
          <Select
            id="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as TemplateKind)}
            options={TEMPLATE_KINDS}
          />
        </Field>
        <Field label="Description" htmlFor="description">
```

Find:

```tsx
        <Field label="Prompt" htmlFor="promptTemplate">
```

Replace with:

```tsx
        <Field
          label={kind === "agency_static" ? "Letter Body" : "Prompt"}
          htmlFor="promptTemplate"
        >
```

- [ ] **Step 5: Type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(dashboard)/templates/template-form.tsx"
git commit -m "feat: add template kind selector to the template form"
```

---

### Task 7: Templates settings — `actions.ts` kind wiring + static preview

**Files:**
- Modify: `src/app/(dashboard)/templates/actions.ts`

**Interfaces:**
- Consumes: `fillTemplateLetter` from `src/lib/claude/generate-letter.ts` (Task 4); `TemplateKind` from `@/types` (Task 2); `kind` field on the `submit()` input object (Task 6).
- Produces: `TemplateInput.kind: TemplateKind` — consumed by `template-form.tsx` (already wired in Task 6).

- [ ] **Step 1: Import `fillTemplateLetter` and `TemplateKind`**

Find:

```ts
import { generateDisputeLetter } from "@/lib/claude/generate-letter";
import type {
  Client,
  NegativeItem,
  Dispute,
  LetterTemplate,
  LetterType,
  NegativeType,
} from "@/types";
```

Replace with:

```ts
import { generateDisputeLetter, fillTemplateLetter } from "@/lib/claude/generate-letter";
import type {
  Client,
  NegativeItem,
  Dispute,
  LetterTemplate,
  LetterType,
  NegativeType,
  TemplateKind,
} from "@/types";
```

- [ ] **Step 2: Add `kind` to `TemplateInput` and the three insert/update call sites**

Find:

```ts
export interface TemplateInput {
  name: string;
  description: string;
  negativeType: NegativeType | "";
  letterType: LetterType;
  roundSuggestion: number | null;
  promptTemplate: string;
  isActive: boolean;
}
```

Replace with:

```ts
export interface TemplateInput {
  name: string;
  kind: TemplateKind;
  description: string;
  negativeType: NegativeType | "";
  letterType: LetterType;
  roundSuggestion: number | null;
  promptTemplate: string;
  isActive: boolean;
}
```

In `createTemplate`, find:

```ts
    .insert({
      agency_id: session.agency.id,
      name: input.name.trim(),
      description: input.description.trim() || null,
```

Replace with:

```ts
    .insert({
      agency_id: session.agency.id,
      name: input.name.trim(),
      kind: input.kind,
      description: input.description.trim() || null,
```

In `updateTemplate`, find:

```ts
    .update({
      name: input.name.trim(),
      description: input.description.trim() || null,
```

Replace with:

```ts
    .update({
      name: input.name.trim(),
      kind: input.kind,
      description: input.description.trim() || null,
```

In `duplicateTemplate`, find:

```ts
    .insert({
      agency_id: session.agency.id,
      name: `${source.name} (Copy)`,
      description: source.description,
```

Replace with:

```ts
    .insert({
      agency_id: session.agency.id,
      name: `${source.name} (Copy)`,
      kind: source.kind,
      description: source.description,
```

- [ ] **Step 3: Branch `previewTemplateLetter` on kind**

Find:

```ts
  const t = template as LetterTemplate;
  try {
    const { content } = await generateDisputeLetter({
      client: previewClient(),
      item: previewItem(t.negative_type as NegativeType | null),
      dispute: previewDispute(t.letter_type),
      template: t,
      agencyName: session.agency.name,
    });
    return { success: true, content };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Preview failed." };
  }
```

Replace with:

```ts
  const t = template as LetterTemplate;
  try {
    const params = {
      client: previewClient(),
      item: previewItem(t.negative_type as NegativeType | null),
      dispute: previewDispute(t.letter_type),
      template: t,
      agencyName: session.agency.name,
      reasonLabel: "Inaccurate / Not Mine",
      instructionLabel: "Delete",
    };
    const { content } =
      t.kind === "agency_static"
        ? fillTemplateLetter(params)
        : await generateDisputeLetter(params);
    return { success: true, content };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Preview failed." };
  }
```

- [ ] **Step 4: Type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/templates/actions.ts"
git commit -m "feat: persist template kind and preview agency_static templates locally"
```

---

### Task 8: Templates settings — kind badge + tab nav shell

**Files:**
- Create: `src/app/(dashboard)/templates/templates-nav.tsx`
- Create: `src/app/(dashboard)/templates/layout.tsx`
- Modify: `src/app/(dashboard)/templates/templates-list.tsx`

**Interfaces:**
- Produces: `<TemplatesNav />` component, reused by Task 9's `/templates/reasons` page (both routes now share this layout).

- [ ] **Step 1: Create the tab nav**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/helpers";
import { FileText, ListChecks } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const TABS: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Templates", href: "/templates", icon: FileText },
  { label: "Dispute Reasons", href: "/templates/reasons", icon: ListChecks },
];

export function TemplatesNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 border-b border-white/10">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "border-blue-600 text-blue-400"
                : "border-transparent text-slate-500 hover:border-white/10 hover:text-slate-300"
            )}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: Create the shared layout**

```tsx
import { TemplatesNav } from "./templates-nav";

export default function TemplatesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-slate-100">Templates</h2>
        <p className="text-sm text-slate-500">
          Manage letter templates and the standard dispute reasons and
          instructions used to generate them.
        </p>
      </div>
      <TemplatesNav />
      {children}
    </div>
  );
}
```

This wraps `templates/page.tsx`, `templates/new/page.tsx`,
`templates/[id]/edit/page.tsx`, and the new `templates/reasons/page.tsx`
(Task 9) automatically — Next.js applies a segment's `layout.tsx` to every
descendant route. `templates/page.tsx` keeps its own `<Card><CardHeader
title="Letter Templates" .../>` untouched; that's the card-level title, not
a duplicate of the new page-level "Templates" heading.

- [ ] **Step 3: Add the kind badge to template cards**

In `templates-list.tsx`, find:

```tsx
                    <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-xs font-medium text-slate-400">
                      {LETTER_TYPE_LABEL.get(t.letter_type) ?? t.letter_type}
                    </span>
                    {t.is_system ? (
```

Replace with:

```tsx
                    <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-xs font-medium text-slate-400">
                      {LETTER_TYPE_LABEL.get(t.letter_type) ?? t.letter_type}
                    </span>
                    <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-xs font-medium text-slate-400">
                      {t.kind === "agency_static" ? "Agency Template" : "AI Prompt"}
                    </span>
                    {t.is_system ? (
```

- [ ] **Step 4: Type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/templates/templates-nav.tsx" "src/app/(dashboard)/templates/layout.tsx" "src/app/(dashboard)/templates/templates-list.tsx"
git commit -m "feat: add templates/dispute-reasons tab nav and template kind badge"
```

---

### Task 9: Dispute Reasons & Instructions management UI

**Files:**
- Create: `src/app/(dashboard)/templates/reasons/actions.ts`
- Create: `src/app/(dashboard)/templates/reasons/page.tsx`
- Create: `src/app/(dashboard)/templates/reasons/reasons-manager.tsx`

**Interfaces:**
- Consumes: `DisputeReason`, `DisputeInstruction` types (Task 2); `TemplatesLayout` (Task 8) wraps this route automatically.
- Produces: server actions `createDisputeReason(label)`, `deleteDisputeReason(id)`, `createDisputeInstruction(label)`, `deleteDisputeInstruction(id)`, each returning `{ success: boolean; error?: string; id?: string }` — consumed by Task 10's `round-builder.tsx` only indirectly (it reads the tables directly, not these actions).

- [ ] **Step 1: Write the server actions**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";

export interface ActionResult {
  success: boolean;
  error?: string;
}

export async function createDisputeReason(
  label: string
): Promise<ActionResult & { id?: string }> {
  const session = await getSessionContext();
  if (!session) return { success: false, error: "Not authenticated." };
  if (!label.trim()) return { success: false, error: "Label is required." };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("dispute_reasons")
    .insert({ agency_id: session.agency.id, label: label.trim(), is_system: false })
    .select("id")
    .single();
  if (error || !data) {
    return { success: false, error: error?.message ?? "Could not create reason." };
  }

  revalidatePath("/templates/reasons");
  return { success: true, id: data.id };
}

export async function deleteDisputeReason(id: string): Promise<ActionResult> {
  const session = await getSessionContext();
  if (!session) return { success: false, error: "Not authenticated." };

  const supabase = await createServerSupabaseClient();
  const { data: existing } = await supabase
    .from("dispute_reasons")
    .select("agency_id, is_system")
    .eq("id", id)
    .single();
  if (!existing) return { success: false, error: "Reason not found." };
  if (existing.is_system || existing.agency_id !== session.agency.id) {
    return { success: false, error: "System reasons can't be deleted." };
  }

  const { error } = await supabase.from("dispute_reasons").delete().eq("id", id);
  if (error) return { success: false, error: error.message };

  revalidatePath("/templates/reasons");
  return { success: true };
}

export async function createDisputeInstruction(
  label: string
): Promise<ActionResult & { id?: string }> {
  const session = await getSessionContext();
  if (!session) return { success: false, error: "Not authenticated." };
  if (!label.trim()) return { success: false, error: "Label is required." };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("dispute_instructions")
    .insert({ agency_id: session.agency.id, label: label.trim(), is_system: false })
    .select("id")
    .single();
  if (error || !data) {
    return { success: false, error: error?.message ?? "Could not create instruction." };
  }

  revalidatePath("/templates/reasons");
  return { success: true, id: data.id };
}

export async function deleteDisputeInstruction(id: string): Promise<ActionResult> {
  const session = await getSessionContext();
  if (!session) return { success: false, error: "Not authenticated." };

  const supabase = await createServerSupabaseClient();
  const { data: existing } = await supabase
    .from("dispute_instructions")
    .select("agency_id, is_system")
    .eq("id", id)
    .single();
  if (!existing) return { success: false, error: "Instruction not found." };
  if (existing.is_system || existing.agency_id !== session.agency.id) {
    return { success: false, error: "System instructions can't be deleted." };
  }

  const { error } = await supabase.from("dispute_instructions").delete().eq("id", id);
  if (error) return { success: false, error: error.message };

  revalidatePath("/templates/reasons");
  return { success: true };
}
```

- [ ] **Step 2: Write the page**

```tsx
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { Card, CardHeader } from "@/components/ui/card";
import { ReasonsManager } from "./reasons-manager";
import type { DisputeReason, DisputeInstruction } from "@/types";

export default async function DisputeReasonsPage() {
  const session = await getSessionContext();
  if (!session) redirect("/login");

  const supabase = await createServerSupabaseClient();
  const [reasonsRes, instructionsRes] = await Promise.all([
    supabase
      .from("dispute_reasons")
      .select("*")
      .eq("is_active", true)
      .order("is_system", { ascending: false })
      .order("sort_order"),
    supabase
      .from("dispute_instructions")
      .select("*")
      .eq("is_active", true)
      .order("is_system", { ascending: false })
      .order("sort_order"),
  ]);

  return (
    <Card>
      <CardHeader
        title="Dispute Reasons & Instructions"
        description="Standard reasons and instructions injected into every dispute letter. System defaults ship with RoundTrack Pro; add your own custom entries below."
      />
      <div className="p-5">
        <ReasonsManager
          reasons={(reasonsRes.data ?? []) as DisputeReason[]}
          instructions={(instructionsRes.data ?? []) as DisputeInstruction[]}
        />
      </div>
    </Card>
  );
}
```

- [ ] **Step 3: Write the manager component**

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import {
  createDisputeReason,
  deleteDisputeReason,
  createDisputeInstruction,
  deleteDisputeInstruction,
} from "./actions";
import type { DisputeReason, DisputeInstruction } from "@/types";

function OptionList({
  title,
  items,
  onAdd,
  onDelete,
}: {
  title: string;
  items: (DisputeReason | DisputeInstruction)[];
  onAdd: (label: string) => Promise<{ success: boolean; error?: string }>;
  onDelete: (id: string) => Promise<{ success: boolean; error?: string }>;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [newLabel, setNewLabel] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  function handleAdd() {
    if (!newLabel.trim()) return;
    start(async () => {
      const res = await onAdd(newLabel);
      if (res.success) {
        setNewLabel("");
        router.refresh();
      } else {
        toast(res.error ?? "Could not add.", "error");
      }
    });
  }

  async function handleDelete(id: string) {
    setBusyId(id);
    const res = await onDelete(id);
    setBusyId(null);
    if (res.success) {
      router.refresh();
    } else {
      toast(res.error ?? "Could not delete.", "error");
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</p>
      <ul className="divide-y divide-white/[0.06] rounded-lg border border-white/10">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-2 px-3 py-2">
            <span className="flex items-center gap-2 text-sm text-slate-200">
              {item.label}
              {item.is_system && (
                <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-400">
                  System
                </span>
              )}
            </span>
            {!item.is_system && (
              <button
                disabled={busyId === item.id}
                onClick={() => handleDelete(item.id)}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-400 hover:bg-red-500/10 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2">
        <Input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder={`Add custom ${title.toLowerCase().replace(/s$/, "")}…`}
          className="flex-1"
        />
        <Button size="sm" onClick={handleAdd} loading={pending}>
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>
    </div>
  );
}

export function ReasonsManager({
  reasons,
  instructions,
}: {
  reasons: DisputeReason[];
  instructions: DisputeInstruction[];
}) {
  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
      <OptionList
        title="Reasons"
        items={reasons}
        onAdd={createDisputeReason}
        onDelete={deleteDisputeReason}
      />
      <OptionList
        title="Instructions"
        items={instructions}
        onAdd={createDisputeInstruction}
        onDelete={deleteDisputeInstruction}
      />
    </div>
  );
}
```

- [ ] **Step 4: Type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/templates/reasons/"
git commit -m "feat: add dispute reasons/instructions management UI"
```

---

### Task 10: Round creation — fetch reasons/instructions + round-builder UI

**Files:**
- Modify: `src/app/(dashboard)/clients/[id]/rounds/new/page.tsx`
- Modify: `src/app/(dashboard)/clients/[id]/rounds/new/round-builder.tsx`

**Interfaces:**
- Consumes: `DisputeReason`, `DisputeInstruction`, `LetterSource` types (Task 2); `LETTER_SOURCES` constant (Task 2).
- Produces: `RoundBuilderProps.reasons`, `RoundBuilderProps.instructions`; extends the `RoundItemSelection` object built in `handleCreate()` with `reasonId`, `instructionId`, `useTemplate` — consumed by Task 11's `createRound()`.

- [ ] **Step 1: Fetch reasons/instructions in the page and pass them down**

Find:

```tsx
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { RoundBuilder, type BuilderItem } from "./round-builder";
import type { DisputeResult, NegativeItem } from "@/types";
```

Replace with:

```tsx
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { RoundBuilder, type BuilderItem } from "./round-builder";
import type { DisputeResult, NegativeItem, DisputeReason, DisputeInstruction } from "@/types";
```

Find:

```tsx
  const [itemsRes, roundRes, priorRes] = await Promise.all([
    // Active items — anything not already deleted can still be disputed.
    supabase
      .from("negative_items")
      .select("*")
      .eq("client_id", id)
      .neq("dispute_status", "deleted")
      .order("bureau", { ascending: true })
      .order("creditor_name", { ascending: true }),
    supabase
      .from("dispute_rounds")
      .select("round_number")
      .eq("client_id", id)
      .order("round_number", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("disputes")
      .select(
        "negative_item_id, result, created_at, round:dispute_rounds(round_number)"
      )
      .eq("client_id", id)
      .order("created_at", { ascending: false }),
  ]);
```

Replace with:

```tsx
  const [itemsRes, roundRes, priorRes, reasonsRes, instructionsRes] = await Promise.all([
    // Active items — anything not already deleted can still be disputed.
    supabase
      .from("negative_items")
      .select("*")
      .eq("client_id", id)
      .neq("dispute_status", "deleted")
      .order("bureau", { ascending: true })
      .order("creditor_name", { ascending: true }),
    supabase
      .from("dispute_rounds")
      .select("round_number")
      .eq("client_id", id)
      .order("round_number", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("disputes")
      .select(
        "negative_item_id, result, created_at, round:dispute_rounds(round_number)"
      )
      .eq("client_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("dispute_reasons")
      .select("*")
      .eq("is_active", true)
      .order("is_system", { ascending: false })
      .order("sort_order"),
    supabase
      .from("dispute_instructions")
      .select("*")
      .eq("is_active", true)
      .order("is_system", { ascending: false })
      .order("sort_order"),
  ]);
```

Find:

```tsx
  return <RoundBuilder clientId={id} roundNumber={roundNumber} items={items} />;
```

Replace with:

```tsx
  return (
    <RoundBuilder
      clientId={id}
      roundNumber={roundNumber}
      items={items}
      reasons={(reasonsRes.data ?? []) as DisputeReason[]}
      instructions={(instructionsRes.data ?? []) as DisputeInstruction[]}
    />
  );
```

- [ ] **Step 2: Add props, state, and defaults to `round-builder.tsx`**

Find:

```tsx
import { BUREAUS, LETTER_TYPES, BUREAU_STYLES } from "@/lib/constants";
import { createRound, type RoundItemSelection } from "../actions";
import type { Bureau, DisputeResult, LetterType, NegativeItem } from "@/types";
```

Replace with:

```tsx
import { BUREAUS, LETTER_TYPES, LETTER_SOURCES, BUREAU_STYLES } from "@/lib/constants";
import { createRound, type RoundItemSelection } from "../actions";
import type {
  Bureau,
  DisputeReason,
  DisputeInstruction,
  DisputeResult,
  LetterSource,
  LetterType,
  NegativeItem,
} from "@/types";
```

Find:

```tsx
interface RoundBuilderProps {
  clientId: string;
  roundNumber: number;
  items: BuilderItem[];
}

export function RoundBuilder({
  clientId,
  roundNumber,
  items,
}: RoundBuilderProps) {
```

Replace with:

```tsx
interface RoundBuilderProps {
  clientId: string;
  roundNumber: number;
  items: BuilderItem[];
  reasons: DisputeReason[];
  instructions: DisputeInstruction[];
}

export function RoundBuilder({
  clientId,
  roundNumber,
  items,
  reasons,
  instructions,
}: RoundBuilderProps) {
```

Find:

```tsx
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [letterTypes, setLetterTypes] = useState<Record<string, LetterType>>(
    () => Object.fromEntries(items.map((i) => [i.id, defaultType(i)]))
  );
  const [submitting, setSubmitting] = useState(false);
```

Replace with:

```tsx
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [letterTypes, setLetterTypes] = useState<Record<string, LetterType>>(
    () => Object.fromEntries(items.map((i) => [i.id, defaultType(i)]))
  );
  const [reasonIds, setReasonIds] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map((i) => [i.id, reasons[0]?.id ?? ""]))
  );
  const [instructionIds, setInstructionIds] = useState<Record<string, string>>(
    () => Object.fromEntries(items.map((i) => [i.id, instructions[0]?.id ?? ""]))
  );
  const [sources, setSources] = useState<Record<string, LetterSource>>(() =>
    Object.fromEntries(items.map((i) => [i.id, "ai" as LetterSource]))
  );
  const [submitting, setSubmitting] = useState(false);
```

- [ ] **Step 3: Include the new fields in `handleCreate()`**

Find:

```tsx
    const selections: RoundItemSelection[] = selectedItems.map((i) => ({
      negativeItemId: i.id,
      bureau: i.bureau,
      letterType: letterTypes[i.id],
    }));
```

Replace with:

```tsx
    const selections: RoundItemSelection[] = selectedItems.map((i) => ({
      negativeItemId: i.id,
      bureau: i.bureau,
      letterType: letterTypes[i.id],
      reasonId: reasonIds[i.id],
      instructionId: instructionIds[i.id],
      useTemplate: sources[i.id] === "agency_template",
    }));
```

- [ ] **Step 4: Replace the per-item control block with reason/instruction/source**

Find:

```tsx
                      {isSelected && (
                        <div className="sm:w-56">
                          <Select
                            aria-label="Letter type"
                            value={letterTypes[item.id]}
                            onChange={(e) =>
                              setLetterTypes((prev) => ({
                                ...prev,
                                [item.id]: e.target.value as LetterType,
                              }))
                            }
                            options={LETTER_TYPES}
                          />
                        </div>
                      )}
```

Replace with:

```tsx
                      {isSelected && (
                        <div className="grid grid-cols-1 gap-2 sm:w-[34rem] sm:grid-cols-2">
                          <Select
                            aria-label="Letter type"
                            value={letterTypes[item.id]}
                            onChange={(e) =>
                              setLetterTypes((prev) => ({
                                ...prev,
                                [item.id]: e.target.value as LetterType,
                              }))
                            }
                            options={LETTER_TYPES}
                          />
                          <Select
                            aria-label="Dispute reason"
                            value={reasonIds[item.id]}
                            onChange={(e) =>
                              setReasonIds((prev) => ({
                                ...prev,
                                [item.id]: e.target.value,
                              }))
                            }
                            options={reasons.map((r) => ({ value: r.id, label: r.label }))}
                          />
                          <Select
                            aria-label="Instruction"
                            value={instructionIds[item.id]}
                            onChange={(e) =>
                              setInstructionIds((prev) => ({
                                ...prev,
                                [item.id]: e.target.value,
                              }))
                            }
                            options={instructions.map((r) => ({ value: r.id, label: r.label }))}
                          />
                          <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-[#1a1a2e] p-1">
                            {LETTER_SOURCES.map((s) => (
                              <button
                                key={s.value}
                                type="button"
                                onClick={() =>
                                  setSources((prev) => ({ ...prev, [item.id]: s.value }))
                                }
                                className={cn(
                                  "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                                  sources[item.id] === s.value
                                    ? "bg-blue-600 text-white"
                                    : "text-slate-400 hover:bg-white/[0.03]"
                                )}
                              >
                                {s.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
```

- [ ] **Step 5: Align the row to the top for the taller control block**

Find:

```tsx
                    <li
                      key={item.id}
                      className={cn(
                        "flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center",
                        isSelected && "bg-blue-50/40"
                      )}
                    >
```

Replace with:

```tsx
                    <li
                      key={item.id}
                      className={cn(
                        "flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-start",
                        isSelected && "bg-blue-50/40"
                      )}
                    >
```

- [ ] **Step 6: Type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(dashboard)/clients/[id]/rounds/new/page.tsx" "src/app/(dashboard)/clients/[id]/rounds/new/round-builder.tsx"
git commit -m "feat: add reason/instruction/source picker to round creation"
```

---

### Task 11: `createRound()` persists the new fields

**Files:**
- Modify: `src/app/(dashboard)/clients/[id]/rounds/actions.ts`

**Interfaces:**
- Consumes: `RoundItemSelection.reasonId`, `.instructionId`, `.useTemplate` from Task 10.
- Produces: `disputes` rows now carry `dispute_reason_id`, `dispute_instruction_id`, `letter_source` — consumed by Task 12's `api/letters/generate/route.ts`.

- [ ] **Step 1: Extend `RoundItemSelection`**

Find:

```ts
export interface RoundItemSelection {
  negativeItemId: string;
  bureau: Bureau;
  letterType: LetterType;
}
```

Replace with:

```ts
export interface RoundItemSelection {
  negativeItemId: string;
  bureau: Bureau;
  letterType: LetterType;
  reasonId: string;
  instructionId: string;
  useTemplate: boolean;
}
```

- [ ] **Step 2: Write the new columns on insert**

Find:

```ts
  const disputeRows = selections.map((s) => ({
    round_id: round.id,
    client_id: clientId,
    agency_id: session.agency.id,
    negative_item_id: s.negativeItemId,
    bureau: s.bureau,
    letter_type: s.letterType,
    result: "pending" as DisputeResult,
  }));
```

Replace with:

```ts
  const disputeRows = selections.map((s) => ({
    round_id: round.id,
    client_id: clientId,
    agency_id: session.agency.id,
    negative_item_id: s.negativeItemId,
    bureau: s.bureau,
    letter_type: s.letterType,
    dispute_reason_id: s.reasonId,
    dispute_instruction_id: s.instructionId,
    letter_source: s.useTemplate ? "agency_template" : "ai",
    result: "pending" as DisputeResult,
  }));
```

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/clients/[id]/rounds/actions.ts"
git commit -m "feat: persist dispute reason/instruction/source on round creation"
```

---

### Task 12: Generation pipeline — branch on `letter_source`, support AI fallback

**Files:**
- Modify: `src/app/api/letters/generate/route.ts`

**Interfaces:**
- Consumes: `fillTemplateLetter` (Task 4), `findBestTemplate(..., kind)` (Task 5), `disputes.letter_source`/`.dispute_reason_id`/`.dispute_instruction_id` (Task 1/2/11).
- Produces: `POST /api/letters/generate` now accepts an optional `forceSource: "ai" | "agency_template"` in the request body alongside `disputeId` — consumed by Task 13's `round-workspace.tsx`.

- [ ] **Step 1: Import `fillTemplateLetter`, join reason/instruction, extend the row type**

Find:

```ts
import { findBestTemplate } from "@/lib/claude/template-matcher";
import { generateDisputeLetter } from "@/lib/claude/generate-letter";
import type { ComplianceResult } from "@/lib/compliance/validate-letter";
import type { Client, Dispute, NegativeItem } from "@/types";

export const maxDuration = 300; // letter generation can take a while for big rounds

interface DisputeWithJoins extends Dispute {
  negative_item: NegativeItem;
  client: Client;
}
```

Replace with:

```ts
import { findBestTemplate } from "@/lib/claude/template-matcher";
import { generateDisputeLetter, fillTemplateLetter } from "@/lib/claude/generate-letter";
import type { ComplianceResult } from "@/lib/compliance/validate-letter";
import type { Client, Dispute, LetterSource, NegativeItem } from "@/types";

export const maxDuration = 300; // letter generation can take a while for big rounds

interface DisputeWithJoins extends Dispute {
  negative_item: NegativeItem;
  client: Client;
  dispute_reason: { label: string } | null;
  dispute_instruction: { label: string } | null;
}
```

Find:

```ts
const DISPUTE_SELECT =
  "*, negative_item:negative_items(*), client:clients(*)";
```

Replace with:

```ts
const DISPUTE_SELECT =
  "*, negative_item:negative_items(*), client:clients(*), dispute_reason:dispute_reasons(label), dispute_instruction:dispute_instructions(label)";
```

- [ ] **Step 2: Branch `generateForDispute` on effective source**

Find:

```ts
async function generateForDispute(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  dispute: DisputeWithJoins,
  agencyId: string,
  agencyName: string
): Promise<{ disputeId: string; ok: true; content: string; compliance: ComplianceResult } | {
  disputeId: string;
  ok: false;
  error: string;
}> {
  try {
    const template = await findBestTemplate(
      agencyId,
      dispute.negative_item.negative_type,
      dispute.letter_type
    );
    if (!template) {
      return {
        disputeId: dispute.id,
        ok: false,
        error: "No matching letter template found.",
      };
    }

    const previousResult = await priorResult(
      supabase,
      dispute.client_id,
      dispute.negative_item_id,
      dispute.round_id
    );

    const { content, compliance } = await generateDisputeLetter({
      client: dispute.client,
      item: dispute.negative_item,
      dispute,
      template,
      agencyName,
      previousResult,
    });

    const { error } = await supabase
      .from("disputes")
      .update({
        letter_content: content,
        compliance_status: compliance.status,
        compliance_checks: compliance.checks,
        compliance_checked_at: new Date().toISOString(),
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
```

Replace with:

```ts
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

    const template = await findBestTemplate(
      agencyId,
      dispute.negative_item.negative_type,
      dispute.letter_type,
      effectiveSource === "agency_template" ? "agency_static" : "ai_prompt"
    );
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
```

- [ ] **Step 3: Accept `forceSource` in the request body and pass it through**

Find:

```ts
  let body: { disputeId?: string; roundId?: string };
```

Replace with:

```ts
  let body: { disputeId?: string; roundId?: string; forceSource?: LetterSource };
```

Find:

```ts
    const result = await generateForDispute(
      supabase,
      dispute,
      agencyId,
      agencyName
    );
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }
    await maybeMarkGenerated(supabase, dispute.round_id, agencyId);
```

Replace with:

```ts
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
```

The bulk (`body.roundId`) branch is intentionally left calling
`generateForDispute(supabase, d, agencyId, agencyName)` with no 5th
argument — bulk generation always uses each dispute's own stored
`letter_source`; the AI-fallback override is only ever a single-dispute,
staff-initiated action (Task 13).

- [ ] **Step 4: Type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/letters/generate/route.ts
git commit -m "feat: branch letter generation on stored source, support AI fallback override"
```

---

### Task 13: Round workspace — source badges + AI-fallback button

**Files:**
- Modify: `src/app/(dashboard)/clients/[id]/rounds/[roundId]/page.tsx`
- Modify: `src/app/(dashboard)/clients/[id]/rounds/[roundId]/round-workspace.tsx`

**Interfaces:**
- Consumes: `POST /api/letters/generate` with optional `forceSource` (Task 12).
- Produces: nothing consumed further — this is the leaf of the chain.

- [ ] **Step 1: Select and map the new fields in `page.tsx`**

Find:

```tsx
import type { Bureau, DisputeResult, LetterType } from "@/types";
import type { ComplianceCheck } from "@/lib/compliance/validate-letter";

interface DisputeJoinRow {
  id: string;
  bureau: Bureau;
  letter_type: LetterType;
  letter_content: string | null;
  certified_mail_number: string | null;
  is_finalized: boolean;
  result: DisputeResult;
  result_notes: string | null;
  negative_item_id: string;
  compliance_status: "pass" | "flagged" | null;
  compliance_checks: ComplianceCheck[] | null;
  negative_item: { creditor_name: string } | null;
}
```

Replace with:

```tsx
import type { Bureau, DisputeResult, LetterSource, LetterType } from "@/types";
import type { ComplianceCheck } from "@/lib/compliance/validate-letter";

interface DisputeJoinRow {
  id: string;
  bureau: Bureau;
  letter_type: LetterType;
  letter_source: LetterSource;
  letter_content: string | null;
  certified_mail_number: string | null;
  is_finalized: boolean;
  result: DisputeResult;
  result_notes: string | null;
  negative_item_id: string;
  compliance_status: "pass" | "flagged" | null;
  compliance_checks: ComplianceCheck[] | null;
  negative_item: { creditor_name: string } | null;
}
```

Find:

```tsx
  const { data: disputeRows } = await supabase
    .from("disputes")
    .select(
      "id, bureau, letter_type, letter_content, certified_mail_number, is_finalized, result, result_notes, negative_item_id, compliance_status, compliance_checks, negative_item:negative_items(creditor_name)"
    )
    .eq("round_id", roundId)
    .order("bureau", { ascending: true });

  const disputes: RoundDispute[] = (
    (disputeRows ?? []) as unknown as DisputeJoinRow[]
  ).map((d) => ({
    id: d.id,
    bureau: d.bureau,
    letter_type: d.letter_type,
    letter_content: d.letter_content,
    certified_mail_number: d.certified_mail_number,
    is_finalized: d.is_finalized,
    result: d.result,
    result_notes: d.result_notes,
    negative_item_id: d.negative_item_id,
    compliance_status: d.compliance_status,
    compliance_checks: d.compliance_checks,
    creditor_name: d.negative_item?.creditor_name ?? "Unknown creditor",
  }));
```

Replace with:

```tsx
  const { data: disputeRows } = await supabase
    .from("disputes")
    .select(
      "id, bureau, letter_type, letter_source, letter_content, certified_mail_number, is_finalized, result, result_notes, negative_item_id, compliance_status, compliance_checks, negative_item:negative_items(creditor_name)"
    )
    .eq("round_id", roundId)
    .order("bureau", { ascending: true });

  const disputes: RoundDispute[] = (
    (disputeRows ?? []) as unknown as DisputeJoinRow[]
  ).map((d) => ({
    id: d.id,
    bureau: d.bureau,
    letter_type: d.letter_type,
    letter_source: d.letter_source,
    letter_content: d.letter_content,
    certified_mail_number: d.certified_mail_number,
    is_finalized: d.is_finalized,
    result: d.result,
    result_notes: d.result_notes,
    negative_item_id: d.negative_item_id,
    compliance_status: d.compliance_status,
    compliance_checks: d.compliance_checks,
    creditor_name: d.negative_item?.creditor_name ?? "Unknown creditor",
  }));
```

- [ ] **Step 2: Add `letter_source` to `RoundDispute`, import `FileText`/`LetterSource`**

In `round-workspace.tsx`, find:

```tsx
import type {
  Bureau,
  DisputeResult,
  LetterType,
  RoundStatus,
} from "@/types";
import type { ComplianceCheck } from "@/lib/compliance/validate-letter";
import {
  Sparkles,
  RefreshCw,
  Check,
  Download,
  Send,
  ClipboardList,
  Loader2,
  PartyPopper,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";

export interface RoundDispute {
  id: string;
  bureau: Bureau;
  letter_type: LetterType;
  letter_content: string | null;
  certified_mail_number: string | null;
  is_finalized: boolean;
  result: DisputeResult;
  result_notes: string | null;
  negative_item_id: string;
  compliance_status: "pass" | "flagged" | null;
  compliance_checks: ComplianceCheck[] | null;
  creditor_name: string;
}
```

Replace with:

```tsx
import type {
  Bureau,
  DisputeResult,
  LetterSource,
  LetterType,
  RoundStatus,
} from "@/types";
import type { ComplianceCheck } from "@/lib/compliance/validate-letter";
import {
  Sparkles,
  RefreshCw,
  Check,
  Download,
  Send,
  ClipboardList,
  Loader2,
  PartyPopper,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  FileText,
} from "lucide-react";

export interface RoundDispute {
  id: string;
  bureau: Bureau;
  letter_type: LetterType;
  letter_source: LetterSource;
  letter_content: string | null;
  certified_mail_number: string | null;
  is_finalized: boolean;
  result: DisputeResult;
  result_notes: string | null;
  negative_item_id: string;
  compliance_status: "pass" | "flagged" | null;
  compliance_checks: ComplianceCheck[] | null;
  creditor_name: string;
}
```

- [ ] **Step 3: Support `forceSource` in `generateOne`, add `generateWithAiInstead`**

Find:

```tsx
  async function generateOne(disputeId: string): Promise<boolean> {
    patchLetter(disputeId, { state: "generating", error: undefined });
    try {
      const res = await fetch("/api/letters/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disputeId }),
      });
```

Replace with:

```tsx
  async function generateOne(
    disputeId: string,
    forceSource?: LetterSource
  ): Promise<boolean> {
    patchLetter(disputeId, { state: "generating", error: undefined });
    try {
      const res = await fetch("/api/letters/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disputeId, forceSource }),
      });
```

Find:

```tsx
  async function regenerate(disputeId: string) {
    const ok = await generateOne(disputeId);
    if (ok) {
      // A regenerated letter must be re-reviewed, so un-finalize it (DB + UI).
      patchLetter(disputeId, { finalized: false });
      if (letters[disputeId]?.finalized) {
        await setLetterFinalized(clientId, round.id, disputeId, false);
      }
      toast("Letter regenerated.", "success");
    } else {
      toast("Could not regenerate.", "error");
    }
  }
```

Replace with:

```tsx
  async function regenerate(disputeId: string) {
    const ok = await generateOne(disputeId);
    if (ok) {
      // A regenerated letter must be re-reviewed, so un-finalize it (DB + UI).
      patchLetter(disputeId, { finalized: false });
      if (letters[disputeId]?.finalized) {
        await setLetterFinalized(clientId, round.id, disputeId, false);
      }
      toast("Letter regenerated.", "success");
    } else {
      toast("Could not regenerate.", "error");
    }
  }

  // Escape hatch for a dispute whose stored source is 'agency_template' but
  // has no matching agency template — switches just this one letter to AI
  // and persists the corrected source server-side.
  async function generateWithAiInstead(disputeId: string) {
    const ok = await generateOne(disputeId, "ai");
    if (ok) {
      patchLetter(disputeId, { finalized: false });
      toast("Generated with AI.", "success");
      router.refresh();
    } else {
      toast("Could not generate with AI.", "error");
    }
  }
```

- [ ] **Step 4: Add the source badge to `LetterCardHeader`**

Find:

```tsx
function LetterCardHeader({ dispute }: { dispute: RoundDispute }) {
  const style = BUREAU_STYLES[dispute.bureau];
  return (
    <div className="flex items-center gap-2">
      <span className={cn("h-2 w-2 rounded-full", style.dot)} />
      <span className="font-medium text-slate-100">{dispute.creditor_name}</span>
      <span className={cn("text-xs font-medium", style.text)}>
        {getBureauLabel(dispute.bureau)}
      </span>
      <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-xs font-medium text-slate-400">
        {getLetterTypeLabel(dispute.letter_type)}
      </span>
    </div>
  );
}
```

Replace with:

```tsx
function LetterCardHeader({ dispute }: { dispute: RoundDispute }) {
  const style = BUREAU_STYLES[dispute.bureau];
  return (
    <div className="flex items-center gap-2">
      <span className={cn("h-2 w-2 rounded-full", style.dot)} />
      <span className="font-medium text-slate-100">{dispute.creditor_name}</span>
      <span className={cn("text-xs font-medium", style.text)}>
        {getBureauLabel(dispute.bureau)}
      </span>
      <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-xs font-medium text-slate-400">
        {getLetterTypeLabel(dispute.letter_type)}
      </span>
      <span
        className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-0.5 text-xs font-medium text-slate-400"
        title={dispute.letter_source === "agency_template" ? "Agency template" : "AI generated"}
      >
        {dispute.letter_source === "agency_template" ? (
          <FileText className="h-3 w-3" />
        ) : (
          <Sparkles className="h-3 w-3" />
        )}
      </span>
    </div>
  );
}
```

- [ ] **Step 5: Add the fallback button to the failed-card state**

Find:

```tsx
                {l.state === "error" ? (
                  <div className="flex items-center gap-2 px-5 py-4 text-sm text-red-400">
                    <AlertTriangle className="h-4 w-4" />
                    {l.error ?? "Generation failed."}
                  </div>
                ) : (
```

Replace with:

```tsx
                {l.state === "error" ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                    <span className="flex items-center gap-2 text-sm text-red-400">
                      <AlertTriangle className="h-4 w-4" />
                      {l.error ?? "Generation failed."}
                    </span>
                    {d.letter_source === "agency_template" && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => generateWithAiInstead(d.id)}
                      >
                        <Sparkles className="h-4 w-4" />
                        Generate with AI instead
                      </Button>
                    )}
                  </div>
                ) : (
```

- [ ] **Step 6: Type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(dashboard)/clients/[id]/rounds/[roundId]/page.tsx" "src/app/(dashboard)/clients/[id]/rounds/[roundId]/round-workspace.tsx"
git commit -m "feat: show letter source badge and AI-fallback button in round workspace"
```

---

### Task 14: Full build + manual end-to-end verification

**Files:** none (verification only).

**Interfaces:** none.

- [ ] **Step 1: Full type check and production build**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed with no errors.

- [ ] **Step 2: Confirm the migration has been applied**

Ask the user to run
`supabase/migrations/038_dispute_reasons_and_template_kind.sql` in the
Supabase SQL editor if they haven't already (Task 1). Nothing past this
point can be verified against real data without it.

- [ ] **Step 3: Launch the app per the project's verify skill**

Run: `npm run build` then `npx next start -p 3001` (background). Confirm
`GET /login` returns 200 within a few seconds, per
`.claude/skills/verify/SKILL.md`.

- [ ] **Step 4: Drive the Templates settings flow**

Log in as the seeded demo user (`npm run seed` if not already done). Visit
`/templates`:
- Confirm the "Templates" / "Dispute Reasons" tabs render.
- Click "Create Template", switch Kind to "Agency Template", enter a body
  containing `{{creditor_name}}`, `{{dispute_reason}}`, `{{instruction}}`,
  save, then click "Preview Letter" — confirm it fills instantly (no
  loading spinner tied to an API call) and shows "Inaccurate / Not Mine" /
  "Delete" in place of those two variables.
- Visit `/templates/reasons` — add a custom reason and a custom instruction,
  confirm both appear with no "System" badge and have a working delete
  button; confirm the 7 seeded reasons and 3 seeded instructions show a
  "System" badge with no delete button.

- [ ] **Step 5: Drive the round-creation → generation → review flow**

On a seeded client with active negative items, start a new round:
- Confirm each selected item shows Letter Type, Reason (defaulting to
  "Inaccurate / Not Mine"), Instruction (defaulting to "Delete"), and a
  Generate-with-AI/Use-our-template toggle (defaulting to AI).
- Set at least one item to "Use our template" where a matching
  `agency_static` template exists (from Step 4), and at least one to
  "Use our template" where none exists (to exercise the failure path).
- Create the round, then "Generate All Letters with AI" on the preparing
  screen.
- Confirm: the AI-path letters generate normally; the matched
  agency_template letter fills instantly and shows the FileText badge; the
  unmatched agency_template letter shows the failed state with a
  "Generate with AI instead" button — click it and confirm it succeeds and
  the badge flips to the Sparkles/AI icon after the page refresh.

- [ ] **Step 6: Verify via DB REST read (read-only, per the verify skill)**

```bash
SUPA_URL=$(grep '^NEXT_PUBLIC_SUPABASE_URL=' .env.local | cut -d= -f2- | tr -d '\r' | xargs)
SERVICE_KEY=$(grep '^SUPABASE_SERVICE_ROLE_KEY=' .env.local | cut -d= -f2- | tr -d '\r' | xargs)
curl -s "$SUPA_URL/rest/v1/disputes?select=id,letter_source,dispute_reason_id,dispute_instruction_id&order=created_at.desc&limit=5" \
  -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY"
```

Expected: the 5 most recent disputes show non-null `dispute_reason_id`/
`dispute_instruction_id` and a `letter_source` of either `ai` or
`agency_template` matching what was picked in Step 5.

- [ ] **Step 7: Shut down**

Kill the `next start` background process.
