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
