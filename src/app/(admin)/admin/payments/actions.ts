"use server";

import { revalidatePath } from "next/cache";
import { isAdmin, getAdminEmail } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";

type Result = { success: boolean; error?: string };

export async function recordManualPayment(input: {
  agencyId: string;
  amount: number;
  method: string;
  reference?: string;
  notes?: string;
}): Promise<Result> {
  if (!(await isAdmin())) return { success: false, error: "Forbidden." };
  if (!input.agencyId) return { success: false, error: "Select an agency." };
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { success: false, error: "Enter a valid amount." };
  }

  const admin = createAdminClient();
  const email = await getAdminEmail();

  const { error: payErr } = await admin.from("manual_payments").insert({
    agency_id: input.agencyId,
    amount: input.amount,
    payment_method: input.method,
    reference_number: input.reference?.trim() || null,
    notes: input.notes?.trim() || null,
    recorded_by: email,
  });
  if (payErr) return { success: false, error: payErr.message };

  await admin
    .from("agencies")
    .update({ plan_status: "active" })
    .eq("id", input.agencyId);

  await admin.from("activity_log").insert({
    agency_id: input.agencyId,
    actor_type: "system",
    actor_id: email,
    action: "Manual payment recorded",
    description: `$${input.amount.toFixed(2)} via ${input.method}${
      input.reference ? ` (ref ${input.reference})` : ""
    }. Status set to active.`,
  });

  revalidatePath("/admin/payments");
  return { success: true };
}

export async function markPaid(agencyId: string): Promise<Result> {
  if (!(await isAdmin())) return { success: false, error: "Forbidden." };
  const admin = createAdminClient();
  const email = await getAdminEmail();
  const { error } = await admin
    .from("agencies")
    .update({ plan_status: "active" })
    .eq("id", agencyId);
  if (error) return { success: false, error: error.message };
  await admin.from("activity_log").insert({
    agency_id: agencyId,
    actor_type: "system",
    actor_id: email,
    action: "Marked as paid (admin)",
    description: "Status set to active by super-admin.",
  });
  revalidatePath("/admin/payments");
  return { success: true };
}

export async function cancelAgency(agencyId: string): Promise<Result> {
  if (!(await isAdmin())) return { success: false, error: "Forbidden." };
  const admin = createAdminClient();
  const email = await getAdminEmail();
  const { error } = await admin
    .from("agencies")
    .update({ plan_status: "cancelled" })
    .eq("id", agencyId);
  if (error) return { success: false, error: error.message };
  await admin.from("activity_log").insert({
    agency_id: agencyId,
    actor_type: "system",
    actor_id: email,
    action: "Cancelled (admin)",
    description: "Status set to cancelled by super-admin.",
  });
  revalidatePath("/admin/payments");
  return { success: true };
}

export async function extendTrialDays(
  agencyId: string,
  days: number
): Promise<Result> {
  if (!(await isAdmin())) return { success: false, error: "Forbidden." };
  const admin = createAdminClient();
  const { data } = await admin
    .from("agencies")
    .select("trial_ends_at")
    .eq("id", agencyId)
    .single();
  const base =
    data?.trial_ends_at && new Date(data.trial_ends_at) > new Date()
      ? new Date(data.trial_ends_at)
      : new Date();
  base.setDate(base.getDate() + (Number.isFinite(days) ? days : 14));
  const { error } = await admin
    .from("agencies")
    .update({ trial_ends_at: base.toISOString() })
    .eq("id", agencyId);
  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/payments");
  return { success: true };
}

export async function addPaymentNote(
  agencyId: string,
  note: string
): Promise<Result> {
  if (!(await isAdmin())) return { success: false, error: "Forbidden." };
  if (!note.trim()) return { success: false, error: "Note is empty." };

  const admin = createAdminClient();
  const { data } = await admin
    .from("agencies")
    .select("settings")
    .eq("id", agencyId)
    .single();
  const settings = (data?.settings ?? {}) as Record<string, unknown>;
  settings.payment_notes = note.trim();

  const { error } = await admin
    .from("agencies")
    .update({ settings })
    .eq("id", agencyId);
  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/payments");
  return { success: true };
}
