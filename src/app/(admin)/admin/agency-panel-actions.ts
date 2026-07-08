"use server";

import { revalidatePath } from "next/cache";
import { isAdmin, getAdminEmail } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { maxClientsForPlan } from "@/lib/billing/plans";
import { verifyGHLConnection } from "@/lib/ghl/api";
import { isMaskedSecret } from "@/lib/utils/secrets";
import type { Plan, PlanStatus } from "@/types";

type Result = { success: boolean; error?: string };

async function guard(): Promise<boolean> {
  return isAdmin();
}

async function logAgency(agencyId: string, action: string, description: string) {
  const admin = createAdminClient();
  const actor = await getAdminEmail();
  await admin.from("activity_log").insert({
    agency_id: agencyId,
    actor_type: "system",
    actor_id: actor,
    action,
    description,
  });
}

function revalidateAdmin() {
  revalidatePath("/admin");
  revalidatePath("/admin/agencies");
  revalidatePath("/admin/pending");
}

async function mergeSettings(
  agencyId: string,
  patch: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("agencies")
    .select("settings")
    .eq("id", agencyId)
    .single();
  const settings = (data?.settings ?? {}) as Record<string, unknown>;
  return { ...settings, ...patch };
}

// ── Status tab ───────────────────────────────────────────────────────────────

export async function saveAgencyStatus(
  agencyId: string,
  input: {
    plan: Plan;
    status: PlanStatus;
    maxClients: number;
    trialEnd: string; // "YYYY-MM-DD" or ""
    adminNotes: string;
  }
): Promise<Result> {
  if (!(await guard())) return { success: false, error: "Forbidden." };

  const maxClients =
    Number.isFinite(input.maxClients) && input.maxClients >= 0
      ? Math.round(input.maxClients)
      : maxClientsForPlan(input.plan);

  const settings = await mergeSettings(agencyId, {
    admin_notes: input.adminNotes.trim() || null,
  });

  const admin = createAdminClient();
  const { error } = await admin
    .from("agencies")
    .update({
      plan: input.plan,
      plan_status: input.status,
      max_clients: maxClients,
      trial_ends_at: input.trialEnd ? new Date(input.trialEnd).toISOString() : null,
      settings,
    })
    .eq("id", agencyId);
  if (error) return { success: false, error: error.message };

  await logAgency(
    agencyId,
    "Account updated (admin)",
    `Plan ${input.plan} / ${input.status}, max ${maxClients} clients.`
  );
  revalidateAdmin();
  return { success: true };
}

export async function extendTrial14(agencyId: string): Promise<Result> {
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
  revalidateAdmin();
  return { success: true };
}

// ── GHL Config tab ─────────────────────────────────────────────────────────

export async function saveGhlConfig(
  agencyId: string,
  input: { locationId: string; apiKey: string }
): Promise<Result> {
  if (!(await guard())) return { success: false, error: "Forbidden." };

  const admin = createAdminClient();
  const update: { ghl_location_id: string | null; ghl_api_key?: string | null } = {
    ghl_location_id: input.locationId.trim() || null,
  };
  // The panel pre-fills the key field with a masked placeholder — only a
  // newly typed value (or a cleared field) should overwrite the stored key.
  if (!isMaskedSecret(input.apiKey)) {
    update.ghl_api_key = input.apiKey.trim() || null;
  }
  const { error } = await admin.from("agencies").update(update).eq("id", agencyId);
  if (error) return { success: false, error: error.message };

  await logAgency(agencyId, "GHL config updated (admin)", "Location ID / API key updated.");
  revalidateAdmin();
  return { success: true };
}

export async function testConnection(
  agencyId: string
): Promise<{ ok: boolean; message: string }> {
  if (!(await guard())) return { ok: false, message: "Forbidden." };

  const admin = createAdminClient();
  const { data } = await admin
    .from("agencies")
    .select("ghl_api_key, ghl_location_id")
    .eq("id", agencyId)
    .single();

  if (!data?.ghl_api_key || !data?.ghl_location_id) {
    return { ok: false, message: "Add the Location ID and API key, then save first." };
  }

  const res = await verifyGHLConnection({
    apiKey: data.ghl_api_key,
    locationId: data.ghl_location_id,
  });
  if (res.ok) {
    return { ok: true, message: `Connected${res.locationName ? ` to ${res.locationName}` : ""}.` };
  }
  return { ok: false, message: res.error };
}

// ── Branding tab ─────────────────────────────────────────────────────────────

export async function saveBranding(
  agencyId: string,
  input: { logoUrl: string; brandColor: string; poweredByVisible: boolean }
): Promise<Result> {
  if (!(await guard())) return { success: false, error: "Forbidden." };

  const color = input.brandColor.trim();
  if (color && !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color)) {
    return { success: false, error: "Brand color must be a hex value like #2563EB." };
  }

  const settings = await mergeSettings(agencyId, {
    portal_branding_visible: input.poweredByVisible,
  });

  const admin = createAdminClient();
  const { error } = await admin
    .from("agencies")
    .update({
      logo_url: input.logoUrl.trim() || null,
      brand_color: color || "#2563EB",
      settings,
    })
    .eq("id", agencyId);
  if (error) return { success: false, error: error.message };

  await logAgency(agencyId, "Branding updated (admin)", "Logo / brand color / portal footer updated.");
  revalidateAdmin();
  return { success: true };
}

// ── Payments tab ─────────────────────────────────────────────────────────────

export async function recordAgencyPayment(
  agencyId: string,
  input: { amount: number; method: string; reference?: string; notes?: string }
): Promise<Result> {
  if (!(await guard())) return { success: false, error: "Forbidden." };
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { success: false, error: "Enter a valid amount." };
  }

  const admin = createAdminClient();
  const actor = await getAdminEmail();

  const { error } = await admin.from("manual_payments").insert({
    agency_id: agencyId,
    amount: input.amount,
    payment_method: input.method,
    reference_number: input.reference?.trim() || null,
    notes: input.notes?.trim() || null,
    recorded_by: actor,
  });
  if (error) return { success: false, error: error.message };

  await admin.from("agencies").update({ plan_status: "active" }).eq("id", agencyId);

  await logAgency(
    agencyId,
    "Manual payment recorded (admin)",
    `$${input.amount.toFixed(2)} via ${input.method}${
      input.reference ? ` (ref ${input.reference})` : ""
    }. Status set to active.`
  );

  revalidateAdmin();
  revalidatePath("/admin/payments");
  return { success: true };
}

// ── Danger zone ──────────────────────────────────────────────────────────────

export async function deleteAgencyAdmin(
  agencyId: string,
  confirmName: string
): Promise<Result> {
  if (!(await guard())) return { success: false, error: "Forbidden." };

  const admin = createAdminClient();
  const { data } = await admin.from("agencies").select("name").eq("id", agencyId).single();
  if (!data) return { success: false, error: "Agency not found." };
  if (confirmName.trim() !== data.name) {
    return { success: false, error: "Name did not match. Deletion cancelled." };
  }

  const { error } = await admin.from("agencies").delete().eq("id", agencyId);
  if (error) return { success: false, error: error.message };

  revalidatePath("/admin");
  revalidatePath("/admin/agencies");
  revalidatePath("/admin/pending");
  revalidatePath("/admin/payments");
  revalidatePath("/admin/clients");
  return { success: true };
}
