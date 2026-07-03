"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isAdmin, getAdminEmail } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { maxClientsForPlan } from "@/lib/billing/plans";
import type { Plan, PlanStatus } from "@/types";

type Result = { success: boolean; error?: string };

async function guard(): Promise<boolean> {
  return isAdmin();
}

async function logAgency(
  agencyId: string,
  action: string,
  description: string
) {
  const admin = createAdminClient();
  const email = await getAdminEmail();
  await admin.from("activity_log").insert({
    agency_id: agencyId,
    actor_type: "system",
    actor_id: email,
    action,
    description,
  });
}

export async function updateAgencyPlan(
  agencyId: string,
  plan: Plan,
  status: PlanStatus
): Promise<Result> {
  if (!(await guard())) return { success: false, error: "Forbidden." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("agencies")
    .update({ plan, plan_status: status, max_clients: maxClientsForPlan(plan) })
    .eq("id", agencyId);
  if (error) return { success: false, error: error.message };

  await logAgency(
    agencyId,
    "Plan updated (admin)",
    `Plan set to ${plan} / ${status} by super-admin.`
  );
  revalidatePath(`/admin/agencies/${agencyId}`);
  return { success: true };
}

export async function updateMaxClients(
  agencyId: string,
  maxClients: number
): Promise<Result> {
  if (!(await guard())) return { success: false, error: "Forbidden." };
  if (!Number.isFinite(maxClients) || maxClients < 0) {
    return { success: false, error: "Invalid client limit." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("agencies")
    .update({ max_clients: Math.round(maxClients) })
    .eq("id", agencyId);
  if (error) return { success: false, error: error.message };
  revalidatePath(`/admin/agencies/${agencyId}`);
  return { success: true };
}

export async function updateTrialEnd(
  agencyId: string,
  isoDate: string
): Promise<Result> {
  if (!(await guard())) return { success: false, error: "Forbidden." };

  const admin = createAdminClient();
  const value = isoDate ? new Date(isoDate).toISOString() : null;
  const { error } = await admin
    .from("agencies")
    .update({ trial_ends_at: value })
    .eq("id", agencyId);
  if (error) return { success: false, error: error.message };
  revalidatePath(`/admin/agencies/${agencyId}`);
  return { success: true };
}

export async function extendTrial(agencyId: string): Promise<Result> {
  if (!(await guard())) return { success: false, error: "Forbidden." };

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
  base.setDate(base.getDate() + 14);

  const { error } = await admin
    .from("agencies")
    .update({ trial_ends_at: base.toISOString() })
    .eq("id", agencyId);
  if (error) return { success: false, error: error.message };

  await logAgency(agencyId, "Trial extended (admin)", "Trial extended by 14 days.");
  revalidatePath(`/admin/agencies/${agencyId}`);
  return { success: true };
}

export async function resetToTrial(agencyId: string): Promise<Result> {
  if (!(await guard())) return { success: false, error: "Forbidden." };

  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 14);

  const admin = createAdminClient();
  const { error } = await admin
    .from("agencies")
    .update({ plan_status: "trialing", trial_ends_at: trialEnd.toISOString() })
    .eq("id", agencyId);
  if (error) return { success: false, error: error.message };

  await logAgency(agencyId, "Reset to trial (admin)", "Status reset to trialing (+14 days).");
  revalidatePath(`/admin/agencies/${agencyId}`);
  return { success: true };
}

export async function deleteAgency(
  agencyId: string,
  confirmName: string
): Promise<Result> {
  if (!(await guard())) return { success: false, error: "Forbidden." };

  const admin = createAdminClient();
  const { data } = await admin
    .from("agencies")
    .select("name")
    .eq("id", agencyId)
    .single();
  if (!data) return { success: false, error: "Agency not found." };
  if (confirmName.trim() !== data.name) {
    return { success: false, error: "Name did not match. Deletion cancelled." };
  }

  const { error } = await admin.from("agencies").delete().eq("id", agencyId);
  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/agencies");
  redirect("/admin/agencies");
}
