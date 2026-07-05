"use server";

import { randomBytes } from "crypto";
import { isAdmin, getAdminEmail } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { maxClientsForPlan } from "@/lib/billing/plans";
import { sendAgencyWelcomeEmail } from "@/lib/admin/welcome-email";
import type { Plan, PlanStatus } from "@/types";

export interface CreateAgencyInput {
  name: string;
  ownerName: string;
  ownerEmail: string;
  phone?: string;
  plan: Plan;
  status: PlanStatus;
  maxClients?: number;
  trialEndDate?: string; // "YYYY-MM-DD" or ""
  ghlLocationId?: string;
  ghlApiKey?: string;
  adminNotes?: string;
  sendWelcomeEmail: boolean;
}

export type CreateAgencyResult =
  | { success: true; agencyId: string }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function generateTempPassword(): string {
  return randomBytes(18).toString("base64url");
}

export async function adminCreateAgency(
  input: CreateAgencyInput
): Promise<CreateAgencyResult> {
  if (!(await isAdmin())) return { success: false, error: "Forbidden." };

  const name = input.name.trim();
  const ownerName = input.ownerName.trim();
  const ownerEmail = input.ownerEmail.trim().toLowerCase();

  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = "Agency name is required.";
  if (!ownerName) fieldErrors.ownerName = "Owner name is required.";
  if (!ownerEmail) fieldErrors.ownerEmail = "Owner email is required.";
  else if (!isValidEmail(ownerEmail)) fieldErrors.ownerEmail = "Enter a valid email.";
  if (Object.keys(fieldErrors).length > 0) {
    return { success: false, error: "Fix the highlighted fields.", fieldErrors };
  }

  const admin = createAdminClient();

  // Create (or recover) the Supabase Auth user — same pattern as agency signup.
  let userId: string;
  const tempPassword = generateTempPassword();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: ownerEmail,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { name: ownerName },
  });

  if (created?.user) {
    userId = created.user.id;
  } else if (createError && /already.*(registered|exists)|email.*exists/i.test(createError.message)) {
    let existing: { id: string } | null = null;
    for (let page = 1; page <= 5; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error || !data) break;
      const match = data.users.find((u) => u.email?.toLowerCase() === ownerEmail);
      if (match) {
        existing = { id: match.id };
        break;
      }
      if (data.users.length < 200) break;
    }
    if (!existing) {
      return { success: false, error: "This email is already registered but could not be found." };
    }
    userId = existing.id;
  } else {
    return { success: false, error: createError?.message ?? "Could not create the owner's account." };
  }

  const maxClients =
    input.maxClients !== undefined && Number.isFinite(input.maxClients) && input.maxClients >= 0
      ? Math.round(input.maxClients)
      : maxClientsForPlan(input.plan);

  const { data: agency, error: agencyError } = await admin
    .from("agencies")
    .insert({
      name,
      owner_name: ownerName,
      owner_email: ownerEmail,
      owner_user_id: userId,
      phone: input.phone?.trim() || null,
      plan: input.plan,
      plan_status: input.status,
      max_clients: maxClients,
      trial_ends_at: input.trialEndDate ? new Date(input.trialEndDate).toISOString() : null,
      ghl_location_id: input.ghlLocationId?.trim() || null,
      ghl_api_key: input.ghlApiKey?.trim() || null,
      settings: input.adminNotes?.trim() ? { admin_notes: input.adminNotes.trim() } : {},
    })
    .select("id")
    .single();

  if (agencyError || !agency) {
    return { success: false, error: agencyError?.message ?? "Could not create the agency." };
  }

  const { error: memberError } = await admin.from("team_members").insert({
    agency_id: agency.id,
    user_id: userId,
    name: ownerName,
    email: ownerEmail,
    role: "owner",
  });
  if (memberError) {
    return { success: false, error: `Agency created but owner could not be linked: ${memberError.message}` };
  }

  const actor = await getAdminEmail();
  await admin.from("activity_log").insert({
    agency_id: agency.id,
    actor_type: "system",
    actor_id: actor,
    action: "Agency created manually by super-admin",
    description: `${name} (${ownerEmail}) — plan ${input.plan}/${input.status}.`,
  });

  if (input.sendWelcomeEmail) {
    await sendAgencyWelcomeEmail({ name, owner_name: ownerName, owner_email: ownerEmail });
  }

  return { success: true, agencyId: agency.id };
}
