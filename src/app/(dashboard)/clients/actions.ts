"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { checkClientLimit } from "@/lib/utils/license";
import { createGHLContact } from "@/lib/ghl/api";
import { markOnboardingStep } from "@/lib/onboarding/mark";
import type { CreditGoal } from "@/types";

export interface ClientFormValues {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  dob: string;
  ssn_last4: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  zip: string;
  score_eq_start: number | null;
  score_exp_start: number | null;
  score_tu_start: number | null;
  score_goal: number | null;
  credit_goal: CreditGoal | "";
  monthly_fee: number;
  referral_source: string;
  notes: string;
}

export type CreateClientResult =
  | { success: true; clientId: string }
  | { success: false; error: string; limitReached?: boolean };

const nullable = (v: string) => (v.trim() ? v.trim() : null);

function validate(values: ClientFormValues): string | null {
  if (!values.first_name.trim()) return "First name is required.";
  if (!values.last_name.trim()) return "Last name is required.";
  if (values.ssn_last4 && !/^\d{4}$/.test(values.ssn_last4))
    return "SSN last 4 must be exactly 4 digits.";
  const scores = [
    values.score_eq_start,
    values.score_exp_start,
    values.score_tu_start,
    values.score_goal,
  ];
  for (const s of scores) {
    if (s !== null && (s < 300 || s > 850))
      return "Credit scores must be between 300 and 850.";
  }
  return null;
}

export async function createClient(
  values: ClientFormValues,
  createInGhl: boolean
): Promise<CreateClientResult> {
  const session = await getSessionContext();
  if (!session) return { success: false, error: "Not authenticated." };

  const validationError = validate(values);
  if (validationError) return { success: false, error: validationError };

  // Enforce plan client limit.
  const limit = await checkClientLimit(session.agency.id);
  if (!limit.allowed) {
    return {
      success: false,
      limitReached: true,
      error: `You've reached your plan limit of ${limit.max} active clients. Upgrade to add more.`,
    };
  }

  const supabase = await createServerSupabaseClient();

  // Best-effort GHL contact creation before insert so we can store the id.
  let ghlContactId: string | null = null;
  if (
    createInGhl &&
    session.agency.ghl_api_key &&
    session.agency.ghl_location_id
  ) {
    ghlContactId = await createGHLContact(
      {
        firstName: values.first_name.trim(),
        lastName: values.last_name.trim(),
        email: nullable(values.email),
        phone: nullable(values.phone),
        address1: nullable(values.address_line1),
        city: nullable(values.city),
        state: nullable(values.state),
        postalCode: nullable(values.zip),
      },
      {
        apiKey: session.agency.ghl_api_key,
        locationId: session.agency.ghl_location_id,
      }
    );
  }

  const { data, error } = await supabase
    .from("clients")
    .insert({
      agency_id: session.agency.id,
      ghl_contact_id: ghlContactId,
      first_name: values.first_name.trim(),
      last_name: values.last_name.trim(),
      email: nullable(values.email),
      phone: nullable(values.phone),
      dob: nullable(values.dob),
      ssn_last4: nullable(values.ssn_last4),
      address_line1: nullable(values.address_line1),
      address_line2: nullable(values.address_line2),
      city: nullable(values.city),
      state: nullable(values.state),
      zip: nullable(values.zip),
      // Current scores start equal to the starting scores.
      score_eq_start: values.score_eq_start,
      score_exp_start: values.score_exp_start,
      score_tu_start: values.score_tu_start,
      score_eq_current: values.score_eq_start,
      score_exp_current: values.score_exp_start,
      score_tu_current: values.score_tu_start,
      score_goal: values.score_goal,
      credit_goal: values.credit_goal || null,
      monthly_fee: values.monthly_fee,
      referral_source: nullable(values.referral_source),
      notes: nullable(values.notes),
      status: "onboarding",
      total_items_start: 0,
      total_items_current: 0,
      total_items_deleted: 0,
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Could not create client.",
    };
  }

  await supabase.from("activity_log").insert({
    agency_id: session.agency.id,
    client_id: data.id,
    actor_type: "staff",
    actor_id: session.userId,
    action: "Client created",
    description: `Client created: ${values.first_name.trim()} ${values.last_name.trim()}`,
    metadata: ghlContactId ? { ghl_contact_id: ghlContactId } : {},
  });

  // Seed a baseline score-history point (round 0) so the portal chart has a
  // starting datapoint as soon as scores are updated later.
  if (
    values.score_eq_start !== null ||
    values.score_exp_start !== null ||
    values.score_tu_start !== null
  ) {
    await supabase.from("score_history").insert({
      client_id: data.id,
      agency_id: session.agency.id,
      score_eq: values.score_eq_start,
      score_exp: values.score_exp_start,
      score_tu: values.score_tu_start,
      round_number: 0,
      notes: "Starting scores",
    });
  }

  await markOnboardingStep(session.agency.id, "first_client_added", true);

  revalidatePath("/clients");
  return { success: true, clientId: data.id };
}

export async function updateClient(
  clientId: string,
  values: ClientFormValues
): Promise<{ success: boolean; error?: string }> {
  const session = await getSessionContext();
  if (!session) return { success: false, error: "Not authenticated." };

  const validationError = validate(values);
  if (validationError) return { success: false, error: validationError };

  const supabase = await createServerSupabaseClient();

  const { error } = await supabase
    .from("clients")
    .update({
      first_name: values.first_name.trim(),
      last_name: values.last_name.trim(),
      email: nullable(values.email),
      phone: nullable(values.phone),
      dob: nullable(values.dob),
      ssn_last4: nullable(values.ssn_last4),
      address_line1: nullable(values.address_line1),
      address_line2: nullable(values.address_line2),
      city: nullable(values.city),
      state: nullable(values.state),
      zip: nullable(values.zip),
      score_eq_start: values.score_eq_start,
      score_exp_start: values.score_exp_start,
      score_tu_start: values.score_tu_start,
      score_goal: values.score_goal,
      credit_goal: values.credit_goal || null,
      monthly_fee: values.monthly_fee,
      referral_source: nullable(values.referral_source),
      notes: nullable(values.notes),
    })
    .eq("id", clientId);

  if (error) return { success: false, error: error.message };

  await supabase.from("activity_log").insert({
    agency_id: session.agency.id,
    client_id: clientId,
    actor_type: "staff",
    actor_id: session.userId,
    action: "Client updated",
    description: `Client details updated: ${values.first_name.trim()} ${values.last_name.trim()}`,
  });

  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/clients");
  return { success: true };
}

/** Lightweight notes autosave from the Overview tab. */
export async function updateClientNotes(
  clientId: string,
  notes: string
): Promise<{ success: boolean; error?: string }> {
  const session = await getSessionContext();
  if (!session) return { success: false, error: "Not authenticated." };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("clients")
    .update({ notes: notes.trim() || null })
    .eq("id", clientId);

  if (error) return { success: false, error: error.message };
  revalidatePath(`/clients/${clientId}`);
  return { success: true };
}
