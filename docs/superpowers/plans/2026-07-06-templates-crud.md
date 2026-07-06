# Letter Templates CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/templates` from a read-only list into full CRUD: create, view, edit, duplicate, and delete custom letter templates, with a variable-inserting prompt editor and a "Preview Letter" button that generates a sample letter from dummy data.

**Architecture:** Server actions in a new `src/app/(dashboard)/templates/actions.ts` handle all mutations (RLS-scoped via `createServerSupabaseClient()`, since `letter_templates` is already agency-isolated). The list page becomes a server component that fetches all templates and hands them to a client component (`TemplatesList`) for filtering/search/card actions. Create and Edit share one client form component (`TemplateForm`) rendered from two thin server pages (`/templates/new`, `/templates/[id]/edit`). Preview reuses the existing `generateDisputeLetter()`/mock-letter machinery with synthesized dummy `Client`/`NegativeItem`/`Dispute` objects.

**Tech Stack:** Next.js 16 App Router Server Actions, Supabase (RLS), TypeScript, existing `@/components/ui/{field,button,modal}` primitives.

## Global Constraints

- System templates (`is_system: true`, `agency_id: null`) are never editable or deletable — only viewable and duplicatable. Every mutation must check `!existing.is_system && existing.agency_id === session.agency.id` before writing.
- The prompt editor's variable list MUST be exactly the 16 keys `buildPromptVariables()` in `src/lib/claude/generate-letter.ts` actually injects — using any other placeholder name silently fails to substitute at letter-generation time.
- No new database migrations — `letter_templates` already has every column this plan needs (`prompt_template`, `is_system`, `is_active`, `negative_type`, `letter_type`, `round_suggestion`).
- No test framework in this repo — verify with `npx tsc --noEmit`, `npm run lint`, `npm run build`, and a manual click-through.
- Follow existing conventions: `Field`/`Input`/`Select`/`Textarea` from `@/components/ui/field`, `Button` from `@/components/ui/button`, `Modal` from `@/components/ui/modal`, `cn()` from `@/lib/utils/helpers`, Lucide icons only.

---

### Task 1: Template CRUD server actions

**Files:**
- Create: `src/app/(dashboard)/templates/actions.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface ActionResult { success: boolean; error?: string }
  export interface TemplateInput {
    name: string;
    description: string;
    negativeType: NegativeType | "";
    letterType: LetterType;
    roundSuggestion: number | null;
    promptTemplate: string;
    isActive: boolean;
  }
  export async function createTemplate(input: TemplateInput): Promise<ActionResult & { id?: string }>
  export async function updateTemplate(id: string, input: TemplateInput): Promise<ActionResult>
  export async function deleteTemplate(id: string): Promise<ActionResult>
  export async function duplicateTemplate(id: string): Promise<ActionResult & { id?: string }>
  export async function previewTemplateLetter(templateId: string): Promise<{ success: boolean; content?: string; error?: string }>
  ```
- Consumes: `getSessionContext` (`@/lib/auth/session`), `createServerSupabaseClient` (`@/lib/supabase/server`), `generateDisputeLetter` (`@/lib/claude/generate-letter`), `Client`/`NegativeItem`/`Dispute`/`LetterTemplate`/`LetterType`/`NegativeType` (`@/types`).

- [ ] **Step 1: Write the file**

Create `src/app/(dashboard)/templates/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { generateDisputeLetter } from "@/lib/claude/generate-letter";
import type {
  Client,
  NegativeItem,
  Dispute,
  LetterTemplate,
  LetterType,
  NegativeType,
} from "@/types";

export interface ActionResult {
  success: boolean;
  error?: string;
}

export interface TemplateInput {
  name: string;
  description: string;
  negativeType: NegativeType | "";
  letterType: LetterType;
  roundSuggestion: number | null;
  promptTemplate: string;
  isActive: boolean;
}

function validateInput(input: TemplateInput): string | null {
  if (!input.name.trim()) return "Name is required.";
  if (!input.promptTemplate.trim()) return "Prompt is required.";
  return null;
}

export async function createTemplate(
  input: TemplateInput
): Promise<ActionResult & { id?: string }> {
  const session = await getSessionContext();
  if (!session) return { success: false, error: "Not authenticated." };

  const validationError = validateInput(input);
  if (validationError) return { success: false, error: validationError };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("letter_templates")
    .insert({
      agency_id: session.agency.id,
      name: input.name.trim(),
      description: input.description.trim() || null,
      negative_type: input.negativeType || null,
      letter_type: input.letterType,
      round_suggestion: input.roundSuggestion,
      prompt_template: input.promptTemplate,
      is_system: false,
      is_active: input.isActive,
    })
    .select("id")
    .single();
  if (error || !data) {
    return { success: false, error: error?.message ?? "Could not create template." };
  }

  revalidatePath("/templates");
  return { success: true, id: data.id };
}

export async function updateTemplate(
  id: string,
  input: TemplateInput
): Promise<ActionResult> {
  const session = await getSessionContext();
  if (!session) return { success: false, error: "Not authenticated." };

  const validationError = validateInput(input);
  if (validationError) return { success: false, error: validationError };

  const supabase = await createServerSupabaseClient();
  const { data: existing } = await supabase
    .from("letter_templates")
    .select("agency_id, is_system")
    .eq("id", id)
    .single();
  if (!existing) return { success: false, error: "Template not found." };
  if (existing.is_system || existing.agency_id !== session.agency.id) {
    return { success: false, error: "System templates can't be edited — duplicate it instead." };
  }

  const { error } = await supabase
    .from("letter_templates")
    .update({
      name: input.name.trim(),
      description: input.description.trim() || null,
      negative_type: input.negativeType || null,
      letter_type: input.letterType,
      round_suggestion: input.roundSuggestion,
      prompt_template: input.promptTemplate,
      is_active: input.isActive,
    })
    .eq("id", id);
  if (error) return { success: false, error: error.message };

  revalidatePath("/templates");
  return { success: true };
}

export async function deleteTemplate(id: string): Promise<ActionResult> {
  const session = await getSessionContext();
  if (!session) return { success: false, error: "Not authenticated." };

  const supabase = await createServerSupabaseClient();
  const { data: existing } = await supabase
    .from("letter_templates")
    .select("agency_id, is_system")
    .eq("id", id)
    .single();
  if (!existing) return { success: false, error: "Template not found." };
  if (existing.is_system || existing.agency_id !== session.agency.id) {
    return { success: false, error: "System templates can't be deleted." };
  }

  const { error } = await supabase.from("letter_templates").delete().eq("id", id);
  if (error) return { success: false, error: error.message };

  revalidatePath("/templates");
  return { success: true };
}

export async function duplicateTemplate(
  id: string
): Promise<ActionResult & { id?: string }> {
  const session = await getSessionContext();
  if (!session) return { success: false, error: "Not authenticated." };

  const supabase = await createServerSupabaseClient();
  const { data: source } = await supabase
    .from("letter_templates")
    .select("*")
    .eq("id", id)
    .single();
  if (!source) return { success: false, error: "Template not found." };

  const { data, error } = await supabase
    .from("letter_templates")
    .insert({
      agency_id: session.agency.id,
      name: `${source.name} (Copy)`,
      description: source.description,
      negative_type: source.negative_type,
      letter_type: source.letter_type,
      round_suggestion: source.round_suggestion,
      prompt_template: source.prompt_template,
      is_system: false,
      is_active: true,
    })
    .select("id")
    .single();
  if (error || !data) {
    return { success: false, error: error?.message ?? "Could not duplicate template." };
  }

  revalidatePath("/templates");
  return { success: true, id: data.id };
}

// ── Preview ──────────────────────────────────────────────────────────────────

function previewClient(): Client {
  return {
    first_name: "Jane",
    last_name: "Doe",
    address_line1: "123 Main St",
    address_line2: null,
    city: "Austin",
    state: "TX",
    zip: "78701",
    ssn_last4: "1234",
  } as unknown as Client;
}

function previewItem(negativeType: NegativeType | null): NegativeItem {
  return {
    bureau: "equifax",
    creditor_name: "Capital One",
    account_type: "credit_card",
    account_number_last4: "4321",
    balance: 850,
    date_of_first_delinquency: "2023-01-15",
    negative_type: negativeType || "collection",
  } as unknown as NegativeItem;
}

function previewDispute(letterType: LetterType): Dispute {
  return { round_id: "preview", letter_type: letterType } as unknown as Dispute;
}

/** Generates a sample letter from dummy client/item data so template authors can check formatting. */
export async function previewTemplateLetter(
  templateId: string
): Promise<{ success: boolean; content?: string; error?: string }> {
  const session = await getSessionContext();
  if (!session) return { success: false, error: "Not authenticated." };

  const supabase = await createServerSupabaseClient();
  const { data: template } = await supabase
    .from("letter_templates")
    .select("*")
    .eq("id", templateId)
    .single();
  if (!template) return { success: false, error: "Template not found." };

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
}
```

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(dashboard)/templates/actions.ts"
git commit -m "feat: add letter template CRUD server actions (create/update/delete/duplicate/preview)"
```

---

### Task 2: Upgrade the templates list page (cards, filter, search, View modal)

**Files:**
- Create: `src/app/(dashboard)/templates/template-view-modal.tsx`
- Create: `src/app/(dashboard)/templates/templates-list.tsx`
- Modify: `src/app/(dashboard)/templates/page.tsx`

**Interfaces:**
- Consumes: `deleteTemplate`, `duplicateTemplate` from `./actions` (Task 1); `Modal` from `@/components/ui/modal`; `LETTER_TYPES` from `@/lib/constants`; `useToast`.
- Produces: `<TemplateViewModal template={LetterTemplate | null} onClose={() => void} onDuplicate={(t: LetterTemplate) => void} />`; `<TemplatesList templates={LetterTemplate[]} />`.

- [ ] **Step 1: Build the View modal**

Create `src/app/(dashboard)/templates/template-view-modal.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import type { LetterTemplate } from "@/types";

export function TemplateViewModal({
  template,
  onClose,
  onDuplicate,
}: {
  template: LetterTemplate | null;
  onClose: () => void;
  onDuplicate: (t: LetterTemplate) => void;
}) {
  const [copiedVar, setCopiedVar] = useState<string | null>(null);

  const variables = template
    ? Array.from(new Set(template.prompt_template.match(/\{\{\w+\}\}/g) ?? []))
    : [];

  function copyVar(v: string) {
    navigator.clipboard?.writeText(v);
    setCopiedVar(v);
    setTimeout(() => setCopiedVar(null), 1500);
  }

  return (
    <Modal
      open={template !== null}
      onClose={onClose}
      title={template?.name ?? ""}
      description={template?.description ?? undefined}
      size="xl"
      footer={
        template ? (
          <button
            onClick={() => {
              onDuplicate(template);
              onClose();
            }}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Duplicate as Custom Template
          </button>
        ) : undefined
      }
    >
      {template && (
        <div className="space-y-4">
          {variables.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-gray-500">Variables (click to copy):</p>
              <div className="flex flex-wrap gap-1.5">
                {variables.map((v) => (
                  <button
                    key={v}
                    onClick={() => copyVar(v)}
                    className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-1 font-mono text-xs text-gray-700 hover:bg-gray-200"
                  >
                    {copiedVar === v ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {v}
                  </button>
                ))}
              </div>
            </div>
          )}
          <textarea
            readOnly
            value={template.prompt_template}
            rows={16}
            className="w-full resize-none rounded-md border border-gray-200 bg-gray-50 p-3 font-mono text-xs text-gray-700"
          />
        </div>
      )}
    </Modal>
  );
}
```

- [ ] **Step 2: Build the cards list with filter/search/actions**

Create `src/app/(dashboard)/templates/templates-list.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Sparkles, Search, Plus, Eye, Pencil, Copy, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils/helpers";
import { LETTER_TYPES } from "@/lib/constants";
import { deleteTemplate, duplicateTemplate } from "./actions";
import { TemplateViewModal } from "./template-view-modal";
import type { LetterTemplate } from "@/types";

const LETTER_TYPE_LABEL = new Map(LETTER_TYPES.map((t) => [t.value, t.label]));
type Filter = "all" | "system" | "custom";

export function TemplatesList({ templates }: { templates: LetterTemplate[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [viewing, setViewing] = useState<LetterTemplate | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return templates.filter((t) => {
      if (filter === "system" && !t.is_system) return false;
      if (filter === "custom" && t.is_system) return false;
      if (query && !t.name.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [templates, filter, query]);

  async function handleDuplicate(t: LetterTemplate) {
    setBusyId(t.id);
    const res = await duplicateTemplate(t.id);
    setBusyId(null);
    if (res.success) {
      toast(`Duplicated as "${t.name} (Copy)".`, "success");
      router.refresh();
      if (res.id) router.push(`/templates/${res.id}/edit`);
    } else {
      toast(res.error ?? "Could not duplicate.", "error");
    }
  }

  async function handleDelete(t: LetterTemplate) {
    if (!window.confirm(`Delete "${t.name}"? This can't be undone.`)) return;
    setBusyId(t.id);
    const res = await deleteTemplate(t.id);
    setBusyId(null);
    if (res.success) {
      toast("Template deleted.", "success");
      router.refresh();
    } else {
      toast(res.error ?? "Could not delete.", "error");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1">
          {(["all", "system", "custom"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors",
                filter === f ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50"
              )}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search templates…"
              className="w-56 rounded-md border border-gray-300 py-1.5 pl-8 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <Link
            href="/templates/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Create Template
          </Link>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-white px-6 py-16 text-center">
          <FileText className="h-8 w-8 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">No templates found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => (
            <div key={t.id} className="flex flex-col rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-gray-900">{t.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                      {LETTER_TYPE_LABEL.get(t.letter_type) ?? t.letter_type}
                    </span>
                    {t.is_system ? (
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
                        System
                      </span>
                    ) : (
                      <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                        Custom
                      </span>
                    )}
                    {!t.is_active && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-400">
                        Inactive
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {t.description && <p className="mt-2 line-clamp-2 text-sm text-gray-500">{t.description}</p>}
              <div className="mt-3 flex items-center gap-1 border-t border-gray-100 pt-3">
                <button
                  onClick={() => setViewing(t)}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  <Eye className="h-3.5 w-3.5" /> View
                </button>
                {!t.is_system && (
                  <Link
                    href={`/templates/${t.id}/edit`}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Link>
                )}
                <button
                  disabled={busyId === t.id}
                  onClick={() => handleDuplicate(t)}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  <Copy className="h-3.5 w-3.5" /> Duplicate
                </button>
                {!t.is_system && (
                  <button
                    disabled={busyId === t.id}
                    onClick={() => handleDelete(t)}
                    className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <TemplateViewModal template={viewing} onClose={() => setViewing(null)} onDuplicate={handleDuplicate} />
    </div>
  );
}
```

- [ ] **Step 3: Rewrite the page to fetch all templates (not just active) and render the list**

Replace the full contents of `src/app/(dashboard)/templates/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { Card, CardHeader } from "@/components/ui/card";
import { TemplatesList } from "./templates-list";
import type { LetterTemplate } from "@/types";

export default async function TemplatesPage() {
  const session = await getSessionContext();
  if (!session) redirect("/login");

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("letter_templates")
    .select("*")
    .order("is_system", { ascending: false })
    .order("name");
  const templates = (data ?? []) as LetterTemplate[];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Letter Templates"
          description="AI prompt templates used to generate dispute letters. System templates ship with ClientDeck Pro; custom templates are specific to your agency."
        />
        <div className="p-5">
          <TemplatesList templates={templates} />
        </div>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Verify types and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/templates/template-view-modal.tsx" "src/app/(dashboard)/templates/templates-list.tsx" "src/app/(dashboard)/templates/page.tsx"
git commit -m "feat: upgrade templates list to cards with filter/search/view/duplicate/delete"
```

---

### Task 3: Create/Edit pages with variable inserter + preview

**Files:**
- Create: `src/app/(dashboard)/templates/template-form.tsx`
- Create: `src/app/(dashboard)/templates/new/page.tsx`
- Create: `src/app/(dashboard)/templates/[id]/edit/page.tsx`

**Interfaces:**
- Consumes: `createTemplate`, `updateTemplate`, `previewTemplateLetter` from `../actions` (Task 1); `Field`/`Input`/`Select`/`Textarea` from `@/components/ui/field`; `Button` from `@/components/ui/button`; `LETTER_TYPES`/`NEGATIVE_TYPES` from `@/lib/constants`.
- Produces: `<TemplateForm template?: LetterTemplate />` — shared by both routes; `template` omitted means create mode.

- [ ] **Step 1: Build the shared form**

Create `src/app/(dashboard)/templates/template-form.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { LETTER_TYPES, NEGATIVE_TYPES } from "@/lib/constants";
import { createTemplate, updateTemplate, previewTemplateLetter } from "./actions";
import type { LetterTemplate, LetterType, NegativeType } from "@/types";

/** Must match exactly the 16 keys buildPromptVariables() injects in src/lib/claude/generate-letter.ts. */
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

export function TemplateForm({ template }: { template?: LetterTemplate }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [previewing, setPreviewing] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);

  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [negativeType, setNegativeType] = useState<NegativeType | "">(
    (template?.negative_type as NegativeType | null) ?? ""
  );
  const [letterType, setLetterType] = useState<LetterType>(template?.letter_type ?? "initial_dispute");
  const [roundSuggestion, setRoundSuggestion] = useState(
    template?.round_suggestion ? String(template.round_suggestion) : ""
  );
  const [promptTemplate, setPromptTemplate] = useState(template?.prompt_template ?? "");
  const [isActive, setIsActive] = useState(template?.is_active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [cursorPos, setCursorPos] = useState(0);

  function insertVariable(v: string) {
    const token = `{{${v}}}`;
    setPromptTemplate((prev) => prev.slice(0, cursorPos) + token + prev.slice(cursorPos));
  }

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
    start(async () => {
      const res = template ? await updateTemplate(template.id, input) : await createTemplate(input);
      if (res.success) {
        toast(template ? "Template updated." : "Template created.", "success");
        router.push("/templates");
        router.refresh();
      } else {
        setError(res.error ?? "Something went wrong.");
      }
    });
  }

  async function handlePreview() {
    if (!template) {
      toast("Save the template first to preview it.", "error");
      return;
    }
    setPreviewing(true);
    const res = await previewTemplateLetter(template.id);
    setPreviewing(false);
    if (res.success) setPreviewContent(res.content ?? "");
    else toast(res.error ?? "Preview failed.", "error");
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Field label="Name" htmlFor="name">
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Description" htmlFor="description">
          <Textarea id="description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Negative Type" htmlFor="negativeType">
            <Select
              id="negativeType"
              value={negativeType}
              onChange={(e) => setNegativeType(e.target.value as NegativeType | "")}
              options={NEGATIVE_TYPES}
              placeholder="Any"
            />
          </Field>
          <Field label="Letter Type" htmlFor="letterType">
            <Select
              id="letterType"
              value={letterType}
              onChange={(e) => setLetterType(e.target.value as LetterType)}
              options={LETTER_TYPES}
            />
          </Field>
          <Field label="Round Suggestion" htmlFor="roundSuggestion">
            <Input
              id="roundSuggestion"
              type="number"
              min={1}
              value={roundSuggestion}
              onChange={(e) => setRoundSuggestion(e.target.value)}
            />
          </Field>
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            Active
          </label>
        </div>
        <Field label="Prompt" htmlFor="promptTemplate">
          <textarea
            id="promptTemplate"
            value={promptTemplate}
            onChange={(e) => setPromptTemplate(e.target.value)}
            onSelect={(e) => setCursorPos(e.currentTarget.selectionStart)}
            onClick={(e) => setCursorPos(e.currentTarget.selectionStart)}
            onKeyUp={(e) => setCursorPos(e.currentTarget.selectionStart)}
            rows={16}
            className="block w-full rounded-md border border-gray-200 bg-white px-3 py-2 font-mono text-xs text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex items-center gap-2">
          <Button onClick={submit} loading={pending}>
            Save
          </Button>
          <Button variant="secondary" onClick={() => router.push("/templates")}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={handlePreview} loading={previewing} className="ml-auto">
            Preview Letter
          </Button>
        </div>
        {previewContent && (
          <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Preview</p>
            <pre className="whitespace-pre-wrap font-mono text-xs text-gray-700">{previewContent}</pre>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Insert Variable</p>
        <div className="flex flex-wrap gap-1.5">
          {VARIABLES.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => insertVariable(v)}
              className="rounded bg-gray-100 px-2 py-1 font-mono text-xs text-gray-700 hover:bg-gray-200"
            >
              {`{{${v}}}`}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the "new template" page**

Create `src/app/(dashboard)/templates/new/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/session";
import { Card, CardHeader } from "@/components/ui/card";
import { TemplateForm } from "../template-form";

export default async function NewTemplatePage() {
  const session = await getSessionContext();
  if (!session) redirect("/login");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Create Template" description="Build a custom AI letter template for your agency." />
        <div className="p-5">
          <TemplateForm />
        </div>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Create the "edit template" page**

Create `src/app/(dashboard)/templates/[id]/edit/page.tsx`:

```tsx
import { redirect, notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { Card, CardHeader } from "@/components/ui/card";
import { TemplateForm } from "../../template-form";
import type { LetterTemplate } from "@/types";

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSessionContext();
  if (!session) redirect("/login");

  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.from("letter_templates").select("*").eq("id", id).single();
  if (!data) notFound();
  const template = data as LetterTemplate;
  if (template.is_system || template.agency_id !== session.agency.id) notFound();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Edit Template" description={template.name} />
        <div className="p-5">
          <TemplateForm template={template} />
        </div>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Verify types, lint, and build**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no new errors.

Run: `npm run build`
Expected: build succeeds — confirms both new routes compile and the shared `TemplateForm` resolves correctly from each.

- [ ] **Step 5: Manual check**

Run `npm run dev`, visit `/templates` → Create Template → fill name + prompt using the variable inserter → Save → redirected to `/templates` with the new card visible → View it → Duplicate it → Edit the duplicate → Preview Letter shows a generated (or mock, if `ANTHROPIC_API_KEY` is unset) letter → Delete the duplicate.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(dashboard)/templates/template-form.tsx" "src/app/(dashboard)/templates/new" "src/app/(dashboard)/templates/[id]/edit"
git commit -m "feat: add template create/edit pages with variable inserter and letter preview"
```

---

## Self-Review Notes

- **Spec coverage:** spec's list page (cards, View/Edit/Duplicate/Delete, filter, search, Create button) → Task 2; View Modal (variables click-to-copy, Duplicate footer button) → Task 2, Step 1; Create/Edit page (fields, variable inserter, Active toggle, Preview Letter, Save/Cancel) → Task 3; server actions → Task 1.
- **Reconciled spec/code mismatch:** the spec's variable list (`{{client_name}} {{bureau_name}} {{creditor_name}} {{balance}} {{today_date}} {{account_last4}} {{negative_type}} {{round_number}} {{previous_result}} {{account_type}} {{client_address}} {{bureau_address}}`, 12 items) omits `bureau_address`... wait — it does include it, but omits `date_of_first_delinquency`, `letter_type`, `agency_name`, and `ssn_last4`, which the real `buildPromptVariables()` also injects. Task 3's `VARIABLES` list uses the real, complete 16-key list so every inserted token actually substitutes at generation time — using the spec's shorter list would silently leave 4 valid-looking placeholders unreplaced in real letters.
- **Type consistency:** `TemplateInput` (Task 1) is the single shape both `createTemplate`/`updateTemplate` and `TemplateForm`'s `submit()` (Task 3) use — no field-name drift between them.
