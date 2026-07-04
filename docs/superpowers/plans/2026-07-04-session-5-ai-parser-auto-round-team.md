# Session 5 — AI Credit Report Parser + Auto Round + Team Assignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add AI credit-report PDF parsing, auto-round scheduling, client→team-member assignment, bureau/type reporting, an AI strategy advisor, case-completion review automation, two new negative-item types, and a payment gate to ClientDeck Pro.

**Architecture:** Follows the established codebase split — RLS-scoped server actions (`createServerSupabaseClient()` + `getSessionContext()`) for staff-triggered mutations, service-role routes (`createAdminClient()` + `isAuthorizedCron()`) for cron/webhook work, and Claude via raw `fetch` (no SDK). New AI features are additive route handlers under `src/app/api/ai/`. UI reuses existing `Modal`/`Button`/`Select`/`useToast` primitives and `lucide-react` icons. All GHL and Google Drive calls stay best-effort/non-blocking exactly like existing code.

**Tech Stack:** Next.js 16 (App Router, React 19, TS), Supabase (RLS), Tailwind, Claude API (`claude-sonnet-4-6` via fetch), Recharts, `@react-pdf/renderer`, Lucide.

## Global Constraints

- TypeScript, zero errors: `npx tsc --noEmit` must pass. Final gate: `npm run build`.
- **No unit-test runner exists in this repo.** Verification per step = `npx tsc --noEmit`, then `npm run lint`, then a manual smoke test in preview mode (`npm run seed` seeds demo data; app runs with no Stripe/Anthropic/Resend keys). "Expected" outputs below describe typecheck/build/manual results, not test assertions.
- Vercel Hobby: every route handler doing AI/PDF work sets `export const maxDuration = 60` (never higher). Crons are daily-only.
- Long/after-response work uses Next 16 `after()` from `next/server`, never bare `.catch()`.
- Model id is `claude-sonnet-4-6`. Claude calls use `fetch("https://api.anthropic.com/v1/messages")` with headers `x-api-key`, `anthropic-version: 2023-06-01`.
- When `ANTHROPIC_API_KEY` is unset, AI features must degrade gracefully (return a clear "AI unavailable" message, never crash) — mirrors `generate-letter.ts`.
- Server actions use `"use server"`, return `{ success: boolean; error?: string }`-shaped results, call `revalidatePath()`, and write an `activity_log` row for meaningful mutations.
- Cron routes validate `isAuthorizedCron(req)` and return 401 otherwise.
- Route-group URLs: pages live at `/clients`, `/team`, `/reports`, `/settings` (NOT `/dashboard/...`).
- Deploy branch: local `master` → `git push origin master:main`. Do NOT push unless the user asks.
- Migrations 013 + 014 SQL already ran in Supabase (per spec). We still commit the `.sql` files for the record AND must update TypeScript types to match.
- Never store full SSN / raw credit-report data in the DB. The uploaded PDF goes to Supabase Storage + Drive as a file, and only extracted structured items are persisted to `negative_items`.

---

## File Structure

**New files**
- `supabase/migrations/013_client_assignment.sql` — assignment columns (record only; already applied)
- `supabase/migrations/014_personal_info_types.sql` — new negative_type constraint + settings defaults (record only; already applied)
- `supabase/migrations/015_personal_info_template.sql` — personal-info-correction letter template
- `src/lib/claude/parse-credit-report.ts` — Claude PDF→items extraction + validation/coercion
- `src/lib/claude/strategy.ts` — Claude dispute-strategy prompt builder + caller
- `src/app/api/ai/parse-credit-report/route.ts` — multipart upload → extracted items
- `src/app/api/ai/strategy/route.ts` — client context → strategy text
- `src/app/api/cron/auto-create-rounds/route.ts` — daily auto-round cron
- `src/app/api/ghl/send-review-request/route.ts` — review-request tag trigger
- `src/app/(dashboard)/clients/[id]/items/credit-report-parser.tsx` — upload/review modal (client component)
- `src/app/(dashboard)/clients/[id]/ai-strategy-panel.tsx` — strategy advisor side panel (client component)
- `src/app/(dashboard)/clients/[id]/assign-client.tsx` — assignment dropdown (client component)
- `src/app/(dashboard)/clients/[id]/assign-actions.ts` — `assignClient` server action
- `src/app/(dashboard)/clients/[id]/completion-actions.ts` — `sendReviewRequest` server action wrapper (client-side calls the API route)
- `src/lib/reports/metrics.ts` — bureau/type/retention aggregation helpers (pure functions over rows)

**Modified files**
- `src/types/index.ts` — extend `NegativeType`, `Client`, `AgencySettings`
- `src/lib/constants.ts` — add two `NEGATIVE_TYPES` entries
- `src/lib/utils/helpers.ts` — add labels for new negative types
- `src/app/(dashboard)/clients/[id]/items/items-manager.tsx` — add "Parse Credit Report with AI" button + parser modal mount
- `src/app/(dashboard)/clients/[id]/rounds/actions.ts` — payment gate in `createRound`
- `src/app/(dashboard)/clients/[id]/client-header.tsx` — assigned specialist + payment-failed warning + AI Strategy button
- `src/app/(dashboard)/clients/page.tsx` + `clients-filters.tsx` — "Assigned To" column + filter
- `src/app/(dashboard)/team/page.tsx` — team caseload dashboard
- `src/app/(dashboard)/clients/actions.ts` — auto-assign on client create
- `src/app/(dashboard)/reports/page.tsx` — bureau/type/retention report sections
- `src/app/(dashboard)/settings/general-form.tsx` + `settings/actions.ts` — automation + review/referral settings
- `src/app/portal/(client)/dashboard/page.tsx` — completion celebration + review/referral links
- `src/lib/ghl/api.ts` — extend `syncClientCompleted` (review-requested + upsell tags + follow-up task)
- `vercel.json` — add `auto-create-rounds` cron

---

## Task 1: Schema types + constants + labels (foundation)

Migrations 013/014 already ran; this task syncs TypeScript + shared constants so every later task compiles. Also writes the `.sql` files for the record.

**Files:**
- Create: `supabase/migrations/013_client_assignment.sql`
- Create: `supabase/migrations/014_personal_info_types.sql`
- Modify: `src/types/index.ts` (lines 15, 94-102, 116-162)
- Modify: `src/lib/constants.ts` (NEGATIVE_TYPES, ~line 74-86)
- Modify: `src/lib/utils/helpers.ts` (getNegativeTypeLabel, ~line 106-121)

**Interfaces:**
- Produces: `NegativeType` now includes `"personal_info_error" | "duplicate_account"`. `Client` gains `assigned_to: string | null; assigned_at: string | null`. `AgencySettings` gains `auto_create_rounds?: boolean; auto_round_delay_days?: number; google_review_link?: string; referral_bonus?: string; referral_link?: string`.

- [ ] **Step 1: Write migration 013 file (record of applied SQL)**

Create `supabase/migrations/013_client_assignment.sql`:

```sql
-- 013_client_assignment.sql — client → team-member assignment
ALTER TABLE clients ADD COLUMN IF NOT EXISTS
  assigned_to UUID REFERENCES team_members(id) ON DELETE SET NULL;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS
  assigned_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_clients_assigned ON clients(agency_id, assigned_to);
```

- [ ] **Step 2: Write migration 014 file (record of applied SQL)**

Create `supabase/migrations/014_personal_info_types.sql`:

```sql
-- 014_personal_info_types.sql — new negative types + agency settings defaults
ALTER TABLE negative_items DROP CONSTRAINT IF EXISTS negative_items_negative_type_check;
ALTER TABLE negative_items ADD CONSTRAINT negative_items_negative_type_check
  CHECK (negative_type IN (
    'late_payment', 'collection', 'charge_off', 'repossession',
    'bankruptcy', 'foreclosure', 'tax_lien', 'judgment',
    'inquiry', 'identity_theft', 'personal_info_error', 'duplicate_account', 'other'
  ));

UPDATE agencies SET settings = settings || '{
  "auto_create_rounds": false,
  "auto_round_delay_days": 5,
  "google_review_link": "",
  "referral_bonus": "$50",
  "referral_link": ""
}'::jsonb WHERE settings IS NOT NULL;
```

- [ ] **Step 3: Extend the `NegativeType` union in types**

In `src/types/index.ts` line 15, replace the `NegativeType` line with:

```ts
export type NegativeType = "late_payment" | "collection" | "charge_off" | "repossession" | "bankruptcy" | "foreclosure" | "tax_lien" | "judgment" | "inquiry" | "identity_theft" | "personal_info_error" | "duplicate_account" | "other";
```

- [ ] **Step 4: Extend `AgencySettings`**

In `src/types/index.ts`, add these optional fields inside `interface AgencySettings` (after line 101 `onboarding_steps?: OnboardingSteps;`):

```ts
  // Automation + completion (Session 5)
  auto_create_rounds?: boolean;
  auto_round_delay_days?: number;
  google_review_link?: string;
  referral_bonus?: string;
  referral_link?: string;
```

- [ ] **Step 5: Extend `Client` with assignment fields**

In `src/types/index.ts`, inside `interface Client`, add after line 159 `ghl_drive_folder_id: string | null;`:

```ts
  assigned_to: string | null;
  assigned_at: string | null;
```

- [ ] **Step 6: Add the two negative types to constants**

In `src/lib/constants.ts`, inside the `NEGATIVE_TYPES` array, add before the `{ value: "other", ... }` entry:

```ts
  { value: "personal_info_error", label: "Personal Info Error" },
  { value: "duplicate_account", label: "Duplicate Account" },
```

- [ ] **Step 7: Add labels in helpers**

In `src/lib/utils/helpers.ts`, inside `getNegativeTypeLabel`'s `labels` map, add before `other: "Other",`:

```ts
    personal_info_error: "Personal Info Error",
    duplicate_account: "Duplicate Account",
```

- [ ] **Step 8: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (no errors). The new `Client` fields and union members resolve everywhere.

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/013_client_assignment.sql supabase/migrations/014_personal_info_types.sql src/types/index.ts src/lib/constants.ts src/lib/utils/helpers.ts
git commit -m "feat: schema types for assignment + personal-info negative types"
```

---

## Task 2: AI Credit Report Parser — extraction lib + route

The biggest feature. Route accepts a PDF, sends it to Claude as a `document` block, and returns validated, enum-coerced items for staff review. It does NOT persist (persistence reuses the existing `addItems` action in Task 3's UI step).

**Files:**
- Create: `src/lib/claude/parse-credit-report.ts`
- Create: `src/app/api/ai/parse-credit-report/route.ts`

**Interfaces:**
- Produces: `parseCreditReport(base64Pdf: string, bureau: Bureau): Promise<{ items: ParsedItem[]; note?: string }>` where `ParsedItem = { creditor_name: string; account_number_last4: string | null; account_type: AccountType | null; negative_type: NegativeType; balance: number | null; date_opened: string | null; date_of_first_delinquency: string | null }`.
- Produces: `POST /api/ai/parse-credit-report` — multipart form `{ clientId, bureau, file }` → JSON `{ ok: true; items: ParsedItem[]; note?: string }` or `{ ok: false; error: string }`.

- [ ] **Step 1: Write the extraction lib**

Create `src/lib/claude/parse-credit-report.ts`:

```ts
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

  const balNum = typeof o.balance === "number" ? o.balance : Number(o.balance);
  const balance = Number.isFinite(balNum) ? balNum : null;

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
  _bureau: Bureau
): Promise<{ items: ParsedItem[]; note?: string }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { items: [], note: "AI parsing unavailable — ANTHROPIC_API_KEY is not set." };
  }

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
            { type: "text", text: PARSE_PROMPT },
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
```

- [ ] **Step 2: Write the route handler**

Create `src/app/api/ai/parse-credit-report/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { parseCreditReport } from "@/lib/claude/parse-credit-report";
import type { Bureau } from "@/types";

export const maxDuration = 60;

const VALID_BUREAUS: Bureau[] = ["equifax", "experian", "transunion"];
const MAX_BYTES = 10 * 1024 * 1024; // 10MB

export async function POST(req: Request) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid upload." }, { status: 400 });
  }

  const clientId = String(form.get("clientId") ?? "");
  const bureau = String(form.get("bureau") ?? "") as Bureau;
  const file = form.get("file");

  if (!clientId) return NextResponse.json({ ok: false, error: "Missing client." }, { status: 400 });
  if (!VALID_BUREAUS.includes(bureau)) {
    return NextResponse.json({ ok: false, error: "Select a bureau." }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Attach a PDF." }, { status: 400 });
  }
  if (file.type !== "application/pdf") {
    return NextResponse.json({ ok: false, error: "File must be a PDF." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "PDF exceeds 10MB." }, { status: 400 });
  }

  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");

  try {
    const { items, note } = await parseCreditReport(base64, bureau);
    return NextResponse.json({ ok: true, items, note });
  } catch (e) {
    console.error("[parse-credit-report] failed:", e);
    return NextResponse.json(
      { ok: false, error: "Analysis failed. Try again or add items manually." },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Verify typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS. (`Buffer` is available — Node runtime; route is not `edge`.)

- [ ] **Step 4: Manual smoke (no key path)**

With `ANTHROPIC_API_KEY` unset, POST any small PDF via the UI (built in Task 3) — expect `{ ok: true, items: [], note: "AI parsing unavailable…" }`. Confirms graceful degradation.

- [ ] **Step 5: Commit**

```bash
git add src/lib/claude/parse-credit-report.ts src/app/api/ai/parse-credit-report/route.ts
git commit -m "feat: AI credit-report PDF parser route + extraction lib"
```

---

## Task 3: Credit Report Parser UI (upload → review → confirm)

Client component with the 3-step flow (upload → analyzing → review). On confirm it reuses the existing `addItems` server action (DRY) to bulk-insert, then uploads the original PDF via the existing documents flow.

**Files:**
- Create: `src/app/(dashboard)/clients/[id]/items/credit-report-parser.tsx`
- Modify: `src/app/(dashboard)/clients/[id]/items/items-manager.tsx` (toolbar button + mount)
- Reference (reuse, do not modify): `items/actions.ts` `addItems(clientId, NewItemInput[])`; `documents/actions.ts` upload action; `components/ui/{modal,button,field,toast}`.

**Interfaces:**
- Consumes: `POST /api/ai/parse-credit-report` (Task 2); `addItems` (existing); `ParsedItem` (Task 2).
- Produces: `<CreditReportParser clientId open onClose onAdded />` React component.

- [ ] **Step 1: Read the existing documents upload action to reuse it**

Run: read `src/app/(dashboard)/clients/[id]/documents/actions.ts` to get the exact upload action signature (Storage + Drive). Use it to attach the original PDF as a `credit_report` category document after items are confirmed. If its signature doesn't accept a raw File from a client component cleanly, upload via a small `FormData` POST to that action; otherwise skip the file-save sub-step and note it as a follow-up (items insert is the critical path).

- [ ] **Step 2: Build the parser component**

Create `src/app/(dashboard)/clients/[id]/items/credit-report-parser.tsx`. Key structure (reuse `Modal`, `Button`, `Select`, `useToast`; icons `Bot`, `UploadCloud`, `Loader2`, `AlertTriangle`):

```tsx
"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { BUREAUS } from "@/lib/constants";
import { getNegativeTypeLabel, getBureauLabel, formatCurrency } from "@/lib/utils/helpers";
import { addItems, type NewItemInput } from "./actions";
import type { Bureau } from "@/types";
import type { ParsedItem } from "@/lib/claude/parse-credit-report";
import { Bot, UploadCloud, Loader2, AlertTriangle } from "lucide-react";

type Phase = "upload" | "analyzing" | "review";

function toDraft(item: ParsedItem, bureau: Bureau): NewItemInput {
  return {
    bureau,
    creditor_name: item.creditor_name,
    account_number_last4: item.account_number_last4 ?? "",
    account_type: item.account_type ?? "",
    negative_type: item.negative_type,
    balance: item.balance != null ? String(item.balance) : "",
    date_opened: item.date_opened ?? "",
    date_of_first_delinquency: item.date_of_first_delinquency ?? "",
  };
}

export function CreditReportParser({
  clientId, open, onClose,
}: { clientId: string; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const [phase, setPhase] = useState<Phase>("upload");
  const [bureau, setBureau] = useState<Bureau>("equifax");
  const [file, setFile] = useState<File | null>(null);
  const [items, setItems] = useState<ParsedItem[]>([]);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setPhase("upload"); setFile(null); setItems([]); setChecked(new Set());
  }

  async function analyze() {
    if (!file) { toast("Attach a PDF first.", "error"); return; }
    if (file.size > 10 * 1024 * 1024) { toast("PDF exceeds 10MB.", "error"); return; }
    setPhase("analyzing");
    const fd = new FormData();
    fd.set("clientId", clientId); fd.set("bureau", bureau); fd.set("file", file);
    const res = await fetch("/api/ai/parse-credit-report", { method: "POST", body: fd });
    const data = await res.json();
    if (!data.ok) { toast(data.error ?? "Analysis failed.", "error"); setPhase("upload"); return; }
    if (data.note) toast(data.note, "info");
    setItems(data.items as ParsedItem[]);
    setChecked(new Set((data.items as ParsedItem[]).map((_: ParsedItem, i: number) => i)));
    setPhase("review");
  }

  async function confirm() {
    const drafts = items.filter((_, i) => checked.has(i)).map((it) => toDraft(it, bureau));
    if (drafts.length === 0) { toast("Select at least one item.", "error"); return; }
    setSaving(true);
    const result = await addItems(clientId, drafts);
    setSaving(false);
    if (!result.success) { toast(result.error ?? "Could not add items.", "error"); return; }
    toast(`${drafts.length} item${drafts.length === 1 ? "" : "s"} added from ${getBureauLabel(bureau)}.`, "success");
    onClose(); reset(); router.refresh();
    // Optional (Step 1 outcome): POST `file` to the documents upload action as a
    // `credit_report` document so the original PDF is stored + Drive-synced.
  }

  // Render by `phase`: upload dropzone + bureau Select; analyzing spinner; review
  // checklist of items (checkbox, creditor, type via getNegativeTypeLabel, balance
  // via formatCurrency) with a prominent "Review each item — AI may miss or misread"
  // warning. Footer buttons per the spec mockups.
  return (
    <Modal open={open} onClose={() => { onClose(); reset(); }} title="AI Credit Report Parser" size="lg" /* … */>
      {/* phase-based body as described above */}
    </Modal>
  );
}
```

Implement the three `phase` bodies faithfully to the spec mockups (upload/analyzing/review), using existing primitives. The analyzing state shows `<Loader2 className="animate-spin" />` and the "10–20 seconds" copy. Review shows a bordered checklist with a "Check All / Uncheck All" control and the amber warning banner.

- [ ] **Step 3: Mount the button in items-manager**

In `src/app/(dashboard)/clients/[id]/items/items-manager.tsx`:
- Add import: `import { CreditReportParser } from "./credit-report-parser";` and add `Bot` to the `lucide-react` import.
- Add state near the other add-flow state (~line 57): `const [parserOpen, setParserOpen] = useState(false);`
- In the toolbar action group (next to "Quick Add", ~line 189-206), add a button before `<Button onClick={() => setModalOpen(true)}>`:

```tsx
<button
  onClick={() => setParserOpen(true)}
  className="inline-flex items-center gap-1.5 rounded-md border border-blue-600 bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
>
  <Bot className="h-4 w-4" />
  Parse Credit Report with AI
</button>
```

- Mount at the end of the returned JSX (before the closing `</div>` of the root, alongside the other modals):

```tsx
<CreditReportParser
  clientId={clientId}
  open={parserOpen}
  onClose={() => setParserOpen(false)}
/>
```

- [ ] **Step 4: Verify typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 5: Manual smoke**

`npm run dev`, open a seeded client's Items tab, click "Parse Credit Report with AI", pick a bureau, upload a PDF. With no key: toast "AI parsing unavailable", returns to upload. With a key: review list appears; confirming inserts items and refreshes the table.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(dashboard)/clients/[id]/items/credit-report-parser.tsx" "src/app/(dashboard)/clients/[id]/items/items-manager.tsx"
git commit -m "feat: AI credit-report parser upload/review UI"
```

---

## Task 4: Client → Team-Member Assignment

Migration 013 already applied. Add the assign server action, header UI, list column/filter, auto-assign on create, and the team caseload dashboard.

**Files:**
- Create: `src/app/(dashboard)/clients/[id]/assign-actions.ts`
- Create: `src/app/(dashboard)/clients/[id]/assign-client.tsx`
- Modify: `src/app/(dashboard)/clients/[id]/client-header.tsx`
- Modify: `src/app/(dashboard)/clients/actions.ts` (auto-assign on create)
- Modify: `src/app/(dashboard)/clients/page.tsx` + `clients-filters.tsx`
- Modify: `src/app/(dashboard)/team/page.tsx`

**Interfaces:**
- Produces: `assignClient(clientId: string, teamMemberId: string | null): Promise<{ success: boolean; error?: string }>`.

- [ ] **Step 1: Read the surfaces to modify**

Read `client-header.tsx`, `clients/page.tsx`, `clients-filters.tsx`, `clients/actions.ts` (the `createClient` action), and `team/page.tsx` to match their exact props, query shapes, and filter/URL-param patterns before editing.

- [ ] **Step 2: Write the assign action**

Create `src/app/(dashboard)/clients/[id]/assign-actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { createGHLTask } from "@/lib/ghl/api";

export async function assignClient(
  clientId: string,
  teamMemberId: string | null
): Promise<{ success: boolean; error?: string }> {
  const session = await getSessionContext();
  if (!session) return { success: false, error: "Not authenticated." };

  const supabase = await createServerSupabaseClient();

  const { error } = await supabase
    .from("clients")
    .update({
      assigned_to: teamMemberId,
      assigned_at: teamMemberId ? new Date().toISOString() : null,
    })
    .eq("id", clientId);
  if (error) return { success: false, error: error.message };

  let memberName = "Unassigned";
  if (teamMemberId) {
    const { data: m } = await supabase
      .from("team_members").select("name").eq("id", teamMemberId).maybeSingle();
    memberName = m?.name ?? "a team member";
  }

  await supabase.from("activity_log").insert({
    agency_id: session.agency.id,
    client_id: clientId,
    actor_type: "staff",
    actor_id: session.userId,
    action: "Client assigned",
    description: teamMemberId
      ? `Client assigned to ${memberName}.`
      : "Client unassigned.",
  });

  // Best-effort GHL task for the newly assigned specialist.
  if (teamMemberId) {
    const { ghl_api_key, ghl_location_id } = session.agency;
    if (ghl_api_key && ghl_location_id) {
      const { data: c } = await supabase
        .from("clients").select("ghl_contact_id, first_name, last_name")
        .eq("id", clientId).maybeSingle();
      if (c?.ghl_contact_id) {
        try {
          await createGHLTask(
            c.ghl_contact_id,
            `You've been assigned ${c.first_name} ${c.last_name} (${memberName})`,
            new Date().toISOString(),
            { apiKey: ghl_api_key, locationId: ghl_location_id }
          );
        } catch (e) { console.error("assignClient: GHL task failed", e); }
      }
    }
  }

  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/clients");
  revalidatePath("/team");
  return { success: true };
}
```

- [ ] **Step 3: Build the assignment dropdown component**

Create `src/app/(dashboard)/clients/[id]/assign-client.tsx` — a `"use client"` component taking `clientId`, `assignedTo: string | null`, and `members: { id: string; name: string }[]`. Render a `Select` (from `@/components/ui/field`) with an "Unassigned" option + one option per member; on change call `assignClient` and `router.refresh()`, toasting the result. Match the visual pattern in `notes-editor.tsx` for inline save UX.

- [ ] **Step 4: Wire it into the client header**

In `client-header.tsx`: the layout for the header lives in `[id]/layout.tsx` which loads the client. Fetch the agency's active team members there (RLS-scoped `team_members` where `is_active`), pass them + `client.assigned_to` down. In `client-header.tsx` render `Assigned to: <name>` with the `<AssignClient …/>` control (a "Reassign" affordance). Keep it dense per design.

- [ ] **Step 5: Auto-assign on client creation**

In `src/app/(dashboard)/clients/actions.ts` `createClient` (read it first): after the client row is inserted, count active team members for the agency. If exactly one (the owner), set `assigned_to` to that member's id + `assigned_at = now()`. If a GHL contact custom field `assigned_preparer` name matches an active member (when creating from GHL), assign that member. Otherwise leave unassigned. Reuse the existing insert path — add the `assigned_to`/`assigned_at` to the insert payload or a follow-up update.

- [ ] **Step 6: Add "Assigned To" column + filter to the client list**

In `clients/page.tsx`: include `assigned_to` in the client select and left-join member names (or fetch members once into a `Map<id, name>`). Add a table column rendering the member name or "Unassigned". In `clients-filters.tsx`: add an "Assigned To" `Select` driven by a URL search param `assigned` (values: `unassigned`, or a member id), following the existing status-filter param pattern. Apply the filter in the page query (`.is("assigned_to", null)` for `unassigned`, else `.eq("assigned_to", id)`).

- [ ] **Step 7: Build the team caseload dashboard**

In `team/page.tsx` (read first): for each active team member, compute active-client count (clients where `assigned_to = member.id` and status in active set), rounds due this week (dispute_rounds `awaiting_response` with `response_deadline` within 7 days for those clients), total deletions (sum `clients.total_items_deleted`), and success rate (deleted disputes / non-pending disputes for their clients). Render the card layout from the spec with a "View Caseload" link to `/clients?assigned=<memberId>`. Use plain SQL aggregation via multiple scoped queries (RLS keeps it agency-isolated); keep it readable over clever.

- [ ] **Step 8: Verify typecheck + lint + build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 9: Manual smoke**

Assign a seeded client to a member; confirm header, list column, `?assigned=` filter, and team dashboard counts all update.

- [ ] **Step 10: Commit**

```bash
git add "src/app/(dashboard)/clients/[id]/assign-actions.ts" "src/app/(dashboard)/clients/[id]/assign-client.tsx" "src/app/(dashboard)/clients/[id]/client-header.tsx" "src/app/(dashboard)/clients/[id]/layout.tsx" "src/app/(dashboard)/clients/actions.ts" "src/app/(dashboard)/clients/page.tsx" "src/app/(dashboard)/clients/clients-filters.tsx" "src/app/(dashboard)/team/page.tsx"
git commit -m "feat: client → team-member assignment + team caseload dashboard"
```

---

## Task 5: Success Rate by Bureau + Type + Retention Reporting

Pure queries + aggregation. No schema change. `disputes` already has `bureau` + `result`; RLS scopes reads to the agency via `createServerSupabaseClient()` — do NOT add manual `agency_id` filters (mirrors existing `reports/page.tsx`).

**Files:**
- Create: `src/lib/reports/metrics.ts`
- Modify: `src/app/(dashboard)/reports/page.tsx`

**Interfaces:**
- Produces: `bureauBreakdown(disputes)`, `typeBreakdown(items)`, `clientMetrics({ clients, rounds, scoreHistory })` pure functions returning display-ready objects.

- [ ] **Step 1: Write aggregation helpers**

Create `src/lib/reports/metrics.ts` with pure functions over already-fetched rows:

```ts
import type { Bureau, NegativeType } from "@/types";

export interface BureauStat {
  bureau: Bureau;
  totalDisputed: number;
  totalDeleted: number;
  successRate: number; // 0-100, one decimal
}

export function bureauBreakdown(
  rows: { bureau: Bureau; result: string }[]
): BureauStat[] {
  const bureaus: Bureau[] = ["equifax", "experian", "transunion"];
  return bureaus.map((bureau) => {
    const forBureau = rows.filter((r) => r.bureau === bureau && r.result !== "pending");
    const totalDisputed = forBureau.length;
    const totalDeleted = forBureau.filter((r) => r.result === "deleted").length;
    const successRate =
      totalDisputed > 0 ? Math.round((totalDeleted / totalDisputed) * 1000) / 10 : 0;
    return { bureau, totalDisputed, totalDeleted, successRate };
  });
}

export interface TypeStat {
  type: NegativeType;
  count: number;
  pct: number; // 0-100 rounded
}

export function typeBreakdown(
  items: { negative_type: NegativeType }[]
): TypeStat[] {
  const total = items.length;
  const counts = new Map<NegativeType, number>();
  for (const i of items) counts.set(i.negative_type, (counts.get(i.negative_type) ?? 0) + 1);
  return [...counts.entries()]
    .map(([type, count]) => ({ type, count, pct: total > 0 ? Math.round((count / total) * 100) : 0 }))
    .sort((a, b) => b.count - a.count);
}

export interface ClientMetrics {
  retentionRate: number;  // 0-100
  cancelled: number;
  totalClients: number;
  avgScoreIncrease: number | null;
}

export function clientMetrics(input: {
  clients: { status: string; score_eq_start: number | null; score_eq_current: number | null }[];
}): ClientMetrics {
  const { clients } = input;
  const totalClients = clients.length;
  const cancelled = clients.filter((c) => c.status === "cancelled").length;
  const retentionRate =
    totalClients > 0 ? Math.round(((totalClients - cancelled) / totalClients) * 100) : 100;

  const deltas = clients
    .map((c) =>
      c.score_eq_start != null && c.score_eq_current != null
        ? c.score_eq_current - c.score_eq_start
        : null
    )
    .filter((d): d is number => d != null);
  const avgScoreIncrease =
    deltas.length > 0 ? Math.round(deltas.reduce((a, b) => a + b, 0) / deltas.length) : null;

  return { retentionRate, cancelled, totalClients, avgScoreIncrease };
}
```

- [ ] **Step 2: Fetch + render the new sections**

In `reports/page.tsx`, add to the `Promise.all` a disputes fetch (`.select("bureau, result")`), a negative-items type fetch (`.select("negative_type")`), and a clients fetch that includes `status, score_eq_start, score_eq_current` (extend the existing clients select). Then render three new `Card` sections below the existing charts:
1. **Success Rate by Bureau** — three columns from `bureauBreakdown`, using `BUREAU_STYLES` for accents and `getBureauLabel`. Show `N disputed`, `N deleted`, `X% success`.
2. **Most Common Negative Items** — bars from `typeBreakdown` using `getNegativeTypeLabel`, each with a proportional width bar (`style={{ width: pct% }}`) and `count`.
3. **Client Metrics** — retention rate, avg score increase from `clientMetrics`.

Keep "Avg rounds" / "time to first deletion" out of scope unless the rounds data is already fetched — the spec's core asks (bureau success, type breakdown, retention, avg score) are covered; note any deferred sub-metric in the commit body rather than faking it.

- [ ] **Step 3: Verify typecheck + lint + build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 4: Manual smoke**

Seed data, open `/reports`, confirm the three new sections render with sensible numbers (or graceful zeros/empty states).

- [ ] **Step 5: Commit**

```bash
git add src/lib/reports/metrics.ts "src/app/(dashboard)/reports/page.tsx"
git commit -m "feat: bureau success-rate, negative-type, and retention reporting"
```

---

## Task 6: Auto-Create Next Round (cron) + Payment Gate

Cron runs daily in service-role context. Also add the payment gate to `createRound` (Task 8 in spec, folded here because both touch round creation and must stay consistent).

**Files:**
- Create: `src/app/api/cron/auto-create-rounds/route.ts`
- Modify: `vercel.json` (add cron)
- Modify: `src/app/(dashboard)/clients/[id]/rounds/actions.ts` (`createRound` payment gate)
- Modify: `src/app/(dashboard)/settings/general-form.tsx` + `settings/actions.ts` (automation toggle)

**Interfaces:**
- Consumes: `AgencySettings.auto_create_rounds`, `auto_round_delay_days` (Task 1); `suggestLetterType` (existing helper).
- Produces: `GET /api/cron/auto-create-rounds` → JSON summary; `updateAutomationSettings(input)` server action.

- [ ] **Step 1: Add the payment gate to createRound**

In `rounds/actions.ts` `createRound`, immediately after resolving `supabase` (after line 77), fetch the client's payment status and block:

```ts
const { data: gateClient } = await supabase
  .from("clients")
  .select("payment_status")
  .eq("id", clientId)
  .single();
if (gateClient?.payment_status === "failed" || gateClient?.payment_status === "paused") {
  return {
    success: false,
    error: "Cannot create a new round — client payment is not active. Update payment status in client settings.",
  };
}
```

- [ ] **Step 2: Add the payment-failed warning banner to the client header**

In `client-header.tsx`, when `client.payment_status === "failed" || "paused"`, render an amber/red banner: "⚠️ Payment {failed|paused} — new rounds cannot be created until resolved." with links to the client edit/settings page. Reuse existing badge/color conventions.

- [ ] **Step 3: Write the auto-round cron**

Create `src/app/api/cron/auto-create-rounds/route.ts`. Logic mirrors `check-deadlines/route.ts` (admin client, `isAuthorizedCron`). For each agency with `settings.auto_create_rounds === true`, find clients that: status `active`, `payment_status` NOT in (`failed`,`paused`), have a most-recent round with status `complete` whose `date_responses_received` is ≥ `auto_round_delay_days` ago, have no newer round, and still have active items (`dispute_status` in `verified`,`no_response`→stored as `in_dispute`,`updated`). For each eligible client, create a `preparing` round + disputes for those items, bump `current_round`, add GHL tag `next-round-ready` + a staff task, log activity. Wrap heavy GHL in try/catch.

```ts
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/cron/auth";
import { addGHLTag, createGHLTask } from "@/lib/ghl/api";
import { suggestLetterType } from "@/lib/utils/helpers";
import type { DisputeStatus, LetterType } from "@/types";

export const maxDuration = 60;

// Items that were disputed but not removed still need another round.
const RE_DISPUTE_STATUSES: DisputeStatus[] = ["verified", "updated", "in_dispute"];

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();

  const { data: agencies } = await admin
    .from("agencies")
    .select("id, settings, ghl_api_key, ghl_location_id");

  let created = 0;
  const nowMs = Date.now();

  for (const agency of agencies ?? []) {
    const settings = (agency.settings ?? {}) as {
      auto_create_rounds?: boolean; auto_round_delay_days?: number;
    };
    if (!settings.auto_create_rounds) continue;
    const delayDays = settings.auto_round_delay_days ?? 5;

    const { data: clients } = await admin
      .from("clients")
      .select("id, current_round, ghl_contact_id, first_name, last_name, payment_status, status")
      .eq("agency_id", agency.id)
      .eq("status", "active");

    for (const client of clients ?? []) {
      if (client.payment_status === "failed" || client.payment_status === "paused") continue;

      const { data: lastRound } = await admin
        .from("dispute_rounds")
        .select("round_number, status, date_responses_received")
        .eq("client_id", client.id)
        .order("round_number", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!lastRound || lastRound.status !== "complete" || !lastRound.date_responses_received) continue;

      const daysSince = (nowMs - new Date(lastRound.date_responses_received).getTime()) / 86400000;
      if (daysSince < delayDays) continue;

      const { data: items } = await admin
        .from("negative_items")
        .select("id, bureau")
        .eq("client_id", client.id)
        .in("dispute_status", RE_DISPUTE_STATUSES);
      if (!items || items.length === 0) continue;

      const roundNumber = (lastRound.round_number ?? 0) + 1;
      const { data: round } = await admin
        .from("dispute_rounds")
        .insert({
          client_id: client.id,
          agency_id: agency.id,
          round_number: roundNumber,
          status: "preparing",
          total_items_disputed: items.length,
        })
        .select("id")
        .single();
      if (!round) continue;

      const letterType = suggestLetterType(roundNumber, "verified") as LetterType;
      await admin.from("disputes").insert(
        items.map((it) => ({
          round_id: round.id,
          client_id: client.id,
          agency_id: agency.id,
          negative_item_id: it.id,
          bureau: it.bureau,
          letter_type: letterType,
          result: "pending",
        }))
      );
      await admin.from("negative_items")
        .update({ dispute_status: "in_dispute", round_disputed: roundNumber })
        .in("id", items.map((it) => it.id));
      await admin.from("clients").update({ current_round: roundNumber }).eq("id", client.id);

      await admin.from("activity_log").insert({
        agency_id: agency.id,
        client_id: client.id,
        actor_type: "system",
        action: `Round ${roundNumber} auto-created`,
        description: `Round ${roundNumber} auto-prepared with ${items.length} remaining item(s).`,
      });

      const opts = agency.ghl_api_key && agency.ghl_location_id
        ? { apiKey: agency.ghl_api_key, locationId: agency.ghl_location_id }
        : null;
      if (opts && client.ghl_contact_id) {
        try {
          await addGHLTag(client.ghl_contact_id, ["next-round-ready"], opts);
          await createGHLTask(
            client.ghl_contact_id,
            `Round ${roundNumber} is ready for ${client.first_name} ${client.last_name} — review and generate letters`,
            new Date().toISOString(),
            opts
          );
        } catch (e) { console.error("auto-create-rounds: GHL sync failed", e); }
      }
      created++;
    }
  }

  return NextResponse.json({ roundsCreated: created });
}
```

- [ ] **Step 4: Register the cron**

In `vercel.json`, add to the `crons` array:

```json
{ "path": "/api/cron/auto-create-rounds", "schedule": "0 14 * * *" }
```

- [ ] **Step 5: Add the automation settings action**

In `settings/actions.ts`, add `updateAutomationSettings` that merges `auto_create_rounds`, `auto_round_delay_days`, `google_review_link`, `referral_bonus`, `referral_link` into `agencies.settings` (spread existing settings, same pattern as `updateGeneralSettings`), then `revalidatePath("/settings")`.

- [ ] **Step 6: Add the automation + review UI to the general settings form**

In `general-form.tsx`, add an "Automation Settings" section with the auto-round toggle + delay `Select` (1/5/7/14 days), and a "Client Wins" section with the Google review link, referral bonus, and referral link inputs. Wire to `updateAutomationSettings`. Match existing form styling.

- [ ] **Step 7: Verify + local cron test**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Then locally: `curl "http://localhost:3000/api/cron/auto-create-rounds?secret=$CRON_SECRET"` (requires `CRON_SECRET` set) — expect JSON `{ roundsCreated: N }`; 401 without the secret.

- [ ] **Step 8: Commit**

```bash
git add src/app/api/cron/auto-create-rounds/route.ts vercel.json "src/app/(dashboard)/clients/[id]/rounds/actions.ts" "src/app/(dashboard)/clients/[id]/client-header.tsx" "src/app/(dashboard)/settings/actions.ts" "src/app/(dashboard)/settings/general-form.tsx"
git commit -m "feat: auto-create-rounds cron + payment gate + automation settings"
```

---

## Task 7: AI Dispute Strategy Assistant

Client detail gets an "AI Strategy" button opening a panel that calls a route returning Claude's recommendations.

**Files:**
- Create: `src/lib/claude/strategy.ts`
- Create: `src/app/api/ai/strategy/route.ts`
- Create: `src/app/(dashboard)/clients/[id]/ai-strategy-panel.tsx`
- Modify: `src/app/(dashboard)/clients/[id]/client-header.tsx` (button)

**Interfaces:**
- Produces: `buildStrategyContext({ client, items, rounds, disputes })` + `generateStrategy(context): Promise<string>`.
- Produces: `POST /api/ai/strategy` `{ clientId }` → `{ ok: true; strategy: string }` or `{ ok: false; error }`.

- [ ] **Step 1: Write the strategy lib**

Create `src/lib/claude/strategy.ts` with a context builder over already-fetched rows and a `generateStrategy` that calls Claude (`claude-sonnet-4-6`, `max_tokens: 1500`) with the strategist system/user prompt from the spec. When `ANTHROPIC_API_KEY` is unset, return a clear "AI strategy is unavailable — add ANTHROPIC_API_KEY to enable." string (never throw).

```ts
import type { Client, NegativeItem, DisputeRound, Dispute } from "@/types";

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
```

- [ ] **Step 2: Write the route**

Create `src/app/api/ai/strategy/route.ts` (`maxDuration = 60`): auth via `getSessionContext`; parse `{ clientId }`; fetch client + items + rounds + disputes with `createServerSupabaseClient` (RLS-scoped); build context; return `{ ok: true, strategy }`. Wrap Claude call in try/catch returning `{ ok: false, error }`.

- [ ] **Step 3: Build the panel**

Create `ai-strategy-panel.tsx` — a `"use client"` component with `clientId`; on open, `fetch("/api/ai/strategy", { method: "POST", body: JSON.stringify({ clientId }) })`, show a loading state, then render the returned text (preserve line breaks with `whitespace-pre-wrap`). Use a `Modal` or slide-over. Header "🤖 AI Dispute Advisor". Include a close button. (Non-streaming full response — simplest, within 60s.)

- [ ] **Step 4: Add the trigger button to the header**

In `client-header.tsx`, add a `<Button variant="secondary">` with the `Bot` icon labeled "AI Strategy" that opens the panel (lift open-state into a small client wrapper if the header is a server component — check first and mount the panel in the client portion).

- [ ] **Step 5: Verify + smoke**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Manual: open a client, click "AI Strategy" — with no key shows the unavailable message; with a key shows recommendations.

- [ ] **Step 6: Commit**

```bash
git add src/lib/claude/strategy.ts src/app/api/ai/strategy/route.ts "src/app/(dashboard)/clients/[id]/ai-strategy-panel.tsx" "src/app/(dashboard)/clients/[id]/client-header.tsx"
git commit -m "feat: AI dispute strategy advisor"
```

---

## Task 8: Case Completion → Review Request + Portal Completion State

Extend `syncClientCompleted`, add a review-request API route + button, and upgrade the portal completed state. Also add migration 015 for the personal-info letter template.

**Files:**
- Create: `supabase/migrations/015_personal_info_template.sql`
- Create: `src/app/api/ghl/send-review-request/route.ts`
- Modify: `src/lib/ghl/api.ts` (`syncClientCompleted`)
- Modify: `src/app/(dashboard)/clients/[id]/client-header.tsx` (completion actions / "Send Review Request")
- Modify: `src/app/portal/(client)/dashboard/page.tsx` (completion celebration + links)

**Interfaces:**
- Produces: `POST /api/ghl/send-review-request` `{ clientId }` → adds `send-review-sms` tag; returns `{ ok }`.

- [ ] **Step 1: Extend syncClientCompleted**

In `src/lib/ghl/api.ts`, update `syncClientCompleted` to also add tags `review-requested` and `upsell-candidate`, and create a follow-up task. Since `createGHLTask` needs the same opts, add the task call inside the function:

```ts
export async function syncClientCompleted(
  contactId: string,
  opts: GHLRequestOptions
) {
  await Promise.allSettled([
    addGHLTag(contactId, ["goal-achieved", "review-requested", "upsell-candidate"], opts),
    removeGHLTag(contactId, ["active-client"], opts),
    addGHLNote(
      contactId,
      `[ClientDeck Pro] Client has achieved their credit goal! Case completed.`,
      opts
    ),
    createGHLTask(
      contactId,
      "Follow up about Google review — 3 days",
      new Date(Date.now() + 3 * 86400000).toISOString(),
      opts
    ),
  ]);
}
```

- [ ] **Step 2: Write the review-request route**

Create `src/app/api/ghl/send-review-request/route.ts`: auth via `getSessionContext`; parse `{ clientId }`; look up the client's `ghl_contact_id`; if GHL configured, `addGHLTag(contactId, ["send-review-sms"], opts)` and log activity; return `{ ok: true }`. Best-effort — if GHL isn't configured return `{ ok: false, error: "GHL is not connected." }`.

- [ ] **Step 3: Add the "Send Review Request" button**

In `client-header.tsx`, when `client.status === "completed"`, surface a completion card (from the spec: results summary + "Send Review Request via GHL" button) that POSTs to `/api/ghl/send-review-request` and toasts the result. Reuse existing client-side button pattern.

- [ ] **Step 4: Upgrade the portal completion state**

In `portal/(client)/dashboard/page.tsx`, when `client.status === "completed"`, render the celebration block: started→finished scores, items removed, and — when set in `agency.settings` — a "Leave a Google Review" link (`settings.google_review_link`) and "Refer a Friend → Earn {referral_bonus}" link (`settings.referral_link`). Guard each link so it only renders when the URL is non-empty. `agency.settings` is already on the portal session.

- [ ] **Step 5: Write migration 015 (personal-info template)**

Create `supabase/migrations/015_personal_info_template.sql`:

```sql
-- 015_personal_info_template.sql — personal information correction letter
INSERT INTO letter_templates
  (agency_id, name, description, negative_type, letter_type, round_suggestion, prompt_template, is_system, is_active)
VALUES (
  NULL,
  'Personal Information Correction',
  'Dispute letter for incorrect personal information on a credit report',
  'personal_info_error',
  'initial_dispute',
  1,
  'Draft a formal letter to {{bureau_name}} from {{client_name}} at {{client_address}} requesting correction of inaccurate personal information on their credit report. Cite the consumer''s right under FCRA Section 611 (15 U.S.C. § 1681i) to have inaccurate information investigated and corrected. Identify the specific inaccurate personal detail (name spelling, address, or date of birth) as recorded for {{creditor_name}} where applicable, request its correction or deletion, and ask for written confirmation of the results within 30 days. Include date {{today_date}}, the bureau address {{bureau_address}}, a RE line, salutation, and a signature block for the client. Output only the letter.',
  true,
  true
);
```

Run this SQL in the Supabase SQL editor (like prior migrations) before relying on the template in the app.

- [ ] **Step 6: Verify + smoke**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Manual: mark a seeded client completed → header completion card appears; portal (via a portal token) shows the celebration + links (when settings populated).

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/015_personal_info_template.sql src/app/api/ghl/send-review-request/route.ts src/lib/ghl/api.ts "src/app/(dashboard)/clients/[id]/client-header.tsx" "src/app/portal/(client)/dashboard/page.tsx"
git commit -m "feat: case-completion review request + portal completion state + personal-info template"
```

---

## Task 9: Final verification + docs

- [ ] **Step 1: Full typecheck + lint + build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: all PASS, zero TS errors.

- [ ] **Step 2: Update CLAUDE.md build status**

Add a "Session 5" bullet under "Shipped since" summarizing: AI credit-report parser, auto-round cron + payment gate, team assignment + caseload dashboard, bureau/type/retention reporting, AI strategy advisor, completion review automation, personal-info/duplicate item types (migrations 013–015).

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: record Session 5 features in CLAUDE.md"
```

- [ ] **Step 4 (only if the user asks): deploy**

`git push origin master:main`

---

## Self-Review

**Spec coverage:**
- Task 1 (AI parser) → Plan Tasks 2 + 3 ✅
- Task 2 (auto round) → Plan Task 6 ✅
- Task 3 (team assignment) → Plan Task 4 ✅
- Task 4 (bureau reporting) → Plan Task 5 ✅
- Task 5 (AI strategy) → Plan Task 7 ✅
- Task 6 (completion → review) → Plan Task 8 ✅
- Task 7 (personal-info + duplicate types) → Plan Task 1 (types/constants/labels) + Task 8 (template) ✅
- Task 8 (payment gate) → folded into Plan Task 6 ✅
- Migrations 013/014 (applied) recorded in Task 1; 015 template in Task 8 ✅

**Type consistency:** `ParsedItem` defined in Task 2 and consumed in Task 3. `assignClient` signature identical across Task 4 steps. `NegativeType`/`Client`/`AgencySettings` extensions from Task 1 are relied on by Tasks 3–8. `suggestLetterType` reused (existing) in Task 6. GHL helpers (`addGHLTag`, `createGHLTask`) reused with the existing `{ apiKey, locationId }` opts shape everywhere.

**Deferred (flagged, not faked):** "Avg rounds per bureau", "avg time to first deletion", and "avg case duration" from spec Task 4 are noted as deferrable in Plan Task 5 (require extra rounds-date math) — core bureau success %, type breakdown, retention, and avg score increase are implemented. Original-PDF file storage in Plan Task 3 depends on the existing documents upload action's shape (verified in Task 3 Step 1); item insertion is the critical path and always runs.
