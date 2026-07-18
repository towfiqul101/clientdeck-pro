"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { LETTER_TYPES, NEGATIVE_TYPES, TEMPLATE_KINDS } from "@/lib/constants";
import { createTemplate, updateTemplate, previewTemplateLetter } from "./actions";
import type { LetterTemplate, LetterType, NegativeType, TemplateKind } from "@/types";

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
  "dispute_reason",
  "instruction",
];

export function TemplateForm({ template }: { template?: LetterTemplate }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [previewing, setPreviewing] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);

  const [name, setName] = useState(template?.name ?? "");
  const [kind, setKind] = useState<TemplateKind>(template?.kind ?? "ai_prompt");
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
      kind,
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
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-white/10"
            />
            Active
          </label>
        </div>
        <Field
          label={kind === "agency_static" ? "Letter Body" : "Prompt"}
          htmlFor="promptTemplate"
        >
          <textarea
            id="promptTemplate"
            value={promptTemplate}
            onChange={(e) => setPromptTemplate(e.target.value)}
            onSelect={(e) => setCursorPos(e.currentTarget.selectionStart)}
            onClick={(e) => setCursorPos(e.currentTarget.selectionStart)}
            onKeyUp={(e) => setCursorPos(e.currentTarget.selectionStart)}
            rows={16}
            className="block w-full rounded-md border border-white/10 bg-[#1a1a2e] px-3 py-2 font-mono text-xs text-slate-100 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </Field>
        {error && <p className="text-sm text-red-400">{error}</p>}
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
          <div className="rounded-md border border-white/10 bg-white/[0.03] p-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Preview</p>
            <pre className="whitespace-pre-wrap font-mono text-xs text-slate-300">{previewContent}</pre>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Insert Variable</p>
        <div className="flex flex-wrap gap-1.5">
          {VARIABLES.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => insertVariable(v)}
              className="rounded bg-white/[0.06] px-2 py-1 font-mono text-xs text-slate-300 hover:bg-white/[0.08]"
            >
              {`{{${v}}}`}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
