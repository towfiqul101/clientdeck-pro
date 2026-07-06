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
