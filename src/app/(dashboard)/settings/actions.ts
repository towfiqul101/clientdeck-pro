"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { verifyGHLConnection, getGHLCustomFields } from "@/lib/ghl/api";
import { detectFieldKeys } from "@/lib/ghl/field-detect";
import { markOnboardingStep } from "@/lib/onboarding/mark";
import { isMaskedSecret } from "@/lib/utils/secrets";
import type { AgencySettings, GhlFieldKeys } from "@/types";
import type { PipelineStageKey } from "@/lib/ghl/pipeline";
import { testConnection } from "@/lib/credit-monitoring";
import type { CreditMonitoringService } from "@/types";

export interface ActionResult {
  success: boolean;
  error?: string;
}

/** Validates that a trimmed string is either empty or an absolute http(s) URL. */
function safeHttpUrl(raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:" ? v : "";
  } catch {
    return "";
  }
}

/** Updates general agency profile: name, phone, website, and timezone (in settings JSONB). */
export async function updateGeneralSettings(input: {
  name: string;
  phone: string;
  website: string;
  timezone: string;
}): Promise<ActionResult> {
  const session = await getSessionContext();
  if (!session) return { success: false, error: "Not authenticated." };

  if (!input.name.trim()) {
    return { success: false, error: "Agency name is required." };
  }

  const supabase = await createServerSupabaseClient();

  const nextSettings: AgencySettings = {
    ...session.agency.settings,
    timezone: input.timezone,
  };

  const { error } = await supabase
    .from("agencies")
    .update({
      name: input.name.trim(),
      phone: input.phone.trim() || null,
      website: input.website.trim() || null,
      settings: nextSettings,
    })
    .eq("id", session.agency.id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { success: true };
}

/** Updates auto-round automation + client-wins (review/referral) settings, merged into settings JSONB. */
export async function updateAutomationSettings(input: {
  autoCreateRounds: boolean;
  autoRoundDelayDays: number;
  googleReviewLink: string;
  referralBonus: string;
  referralLink: string;
}): Promise<ActionResult> {
  const session = await getSessionContext();
  if (!session) return { success: false, error: "Not authenticated." };

  const supabase = await createServerSupabaseClient();

  const nextSettings: AgencySettings = {
    ...session.agency.settings,
    auto_create_rounds: input.autoCreateRounds,
    auto_round_delay_days: input.autoRoundDelayDays,
    google_review_link: safeHttpUrl(input.googleReviewLink) || undefined,
    referral_bonus: input.referralBonus.trim() || undefined,
    referral_link: safeHttpUrl(input.referralLink) || undefined,
  };

  const { error } = await supabase
    .from("agencies")
    .update({ settings: nextSettings })
    .eq("id", session.agency.id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/settings");
  return { success: true };
}

/** Saves GHL Location ID + API key. */
export async function updateGHLSettings(input: {
  locationId: string;
  apiKey: string;
}): Promise<ActionResult> {
  const session = await getSessionContext();
  if (!session) return { success: false, error: "Not authenticated." };

  const supabase = await createServerSupabaseClient();

  const update: { ghl_location_id: string | null; ghl_api_key?: string | null } = {
    ghl_location_id: input.locationId.trim() || null,
  };
  // A masked placeholder means the user didn't touch the field — keep the
  // stored key. Only a newly typed value (or a cleared field) updates it.
  if (!isMaskedSecret(input.apiKey)) {
    update.ghl_api_key = input.apiKey.trim() || null;
  }

  const { error } = await supabase
    .from("agencies")
    .update(update)
    .eq("id", session.agency.id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/settings/ghl");
  return { success: true };
}

/** Live credential check for the "Test Connection" button. */
export async function testGHLConnection(input: {
  locationId: string;
  apiKey: string;
}): Promise<{ ok: boolean; message: string }> {
  const session = await getSessionContext();
  if (!session) return { ok: false, message: "Not authenticated." };

  // A masked placeholder means "use the stored key" — the browser never has
  // the real value to send back.
  const apiKey = isMaskedSecret(input.apiKey)
    ? session.agency.ghl_api_key ?? ""
    : input.apiKey;

  if (!input.locationId.trim() || !apiKey.trim()) {
    return { ok: false, message: "Enter both a Location ID and an API key." };
  }

  const result = await verifyGHLConnection({
    locationId: input.locationId.trim(),
    apiKey: apiKey.trim(),
  });

  if (result.ok) {
    await markOnboardingStep(session.agency.id, "ghl_connected", true);
    return {
      ok: true,
      message: result.locationName
        ? `Connected to "${result.locationName}".`
        : "Connection successful.",
    };
  }
  return { ok: false, message: result.error };
}

/** Saves the manual GHL custom-field key mapping (agencies.ghl_field_keys). */
export async function saveGhlFieldKeys(
  keys: GhlFieldKeys
): Promise<ActionResult> {
  const session = await getSessionContext();
  if (!session) return { success: false, error: "Not authenticated." };

  const clean: GhlFieldKeys = {};
  for (const [k, v] of Object.entries(keys)) {
    if (typeof v === "string" && v.trim()) clean[k] = v.trim();
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("agencies")
    .update({ ghl_field_keys: clean })
    .eq("id", session.agency.id);
  if (error) return { success: false, error: error.message };

  revalidatePath("/settings/ghl");
  return { success: true };
}

/** Saves just the owner's GHL contact id — staff alert tags land on this contact. */
export async function updateOwnerGhlContactId(
  ownerGhlContactId: string
): Promise<ActionResult> {
  const session = await getSessionContext();
  if (!session) return { success: false, error: "Not authenticated." };

  const supabase = await createServerSupabaseClient();
  const nextSettings: AgencySettings = {
    ...session.agency.settings,
    owner_ghl_contact_id: ownerGhlContactId.trim() || undefined,
  };

  const { error } = await supabase
    .from("agencies")
    .update({ settings: nextSettings })
    .eq("id", session.agency.id);
  if (error) return { success: false, error: error.message };

  revalidatePath("/settings/ghl");
  return { success: true };
}

/** Saves the agency's GHL pipeline id + stage-id mapping (agencies.settings). */
export async function updatePipelineConfig(input: {
  pipelineId: string;
  stages: Partial<Record<PipelineStageKey, string>>;
}): Promise<ActionResult> {
  const session = await getSessionContext();
  if (!session) return { success: false, error: "Not authenticated." };

  const cleanStages: Partial<Record<PipelineStageKey, string>> = {};
  for (const [key, value] of Object.entries(input.stages)) {
    if (typeof value === "string" && value.trim()) {
      cleanStages[key as PipelineStageKey] = value.trim();
    }
  }

  const supabase = await createServerSupabaseClient();
  const nextSettings: AgencySettings = {
    ...session.agency.settings,
    ghl_pipeline_id: input.pipelineId.trim() || undefined,
    ghl_pipeline_stages: cleanStages,
  };

  const { error } = await supabase
    .from("agencies")
    .update({ settings: nextSettings })
    .eq("id", session.agency.id);
  if (error) return { success: false, error: error.message };

  revalidatePath("/settings/ghl");
  return { success: true };
}

/**
 * Reads the agency's GHL custom fields and heuristically maps them onto CDP
 * data keys by name, merging into the saved mapping. Returns the merged keys
 * so the form can update in place.
 */
export async function autoDetectGhlFields(): Promise<{
  ok: boolean;
  message: string;
  keys?: GhlFieldKeys;
}> {
  const session = await getSessionContext();
  if (!session) return { ok: false, message: "Not authenticated." };

  const { ghl_api_key, ghl_location_id } = session.agency;
  if (!ghl_api_key || !ghl_location_id) {
    return { ok: false, message: "Connect GHL (Location ID + API key) first." };
  }

  let fields;
  try {
    fields = await getGHLCustomFields({
      apiKey: ghl_api_key,
      locationId: ghl_location_id,
    });
  } catch {
    return { ok: false, message: "Could not read GHL custom fields. Check the API key." };
  }

  const detected = detectFieldKeys(fields);
  const merged: GhlFieldKeys = { ...(session.agency.ghl_field_keys ?? {}), ...detected };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("agencies")
    .update({ ghl_field_keys: merged })
    .eq("id", session.agency.id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/settings/ghl");
  const count = Object.keys(detected).length;
  return {
    ok: true,
    message: count
      ? `Auto-detected ${count} field${count === 1 ? "" : "s"} by name. Review and save.`
      : "No matching fields found — enter the keys manually.",
    keys: merged,
  };
}

/** Saves branding: logo URL (already uploaded to Storage) + brand color. */
export async function updateBranding(input: {
  logoUrl: string | null;
  brandColor: string;
}): Promise<ActionResult> {
  const session = await getSessionContext();
  if (!session) return { success: false, error: "Not authenticated." };

  const validColor = /^#[0-9a-fA-F]{6}$/.test(input.brandColor);
  if (!validColor) {
    return { success: false, error: "Brand color must be a valid hex value." };
  }

  const supabase = await createServerSupabaseClient();

  const { error } = await supabase
    .from("agencies")
    .update({
      logo_url: input.logoUrl,
      brand_color: input.brandColor,
    })
    .eq("id", session.agency.id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/settings/branding");
  revalidatePath("/", "layout");
  return { success: true };
}

/** Saves the agency's credit-monitoring provider selection + API credentials. */
export async function updateCreditMonitoringSettings(input: {
  service: CreditMonitoringService | "none";
  apiKey: string;
  apiSecret: string;
  autoPullScores: boolean;
}): Promise<ActionResult> {
  const session = await getSessionContext();
  if (!session) return { success: false, error: "Not authenticated." };

  const supabase = await createServerSupabaseClient();

  const nextSettings: AgencySettings = {
    ...session.agency.settings,
    auto_pull_scores: input.autoPullScores,
  };

  // Masked placeholders mean the user didn't touch the field — keep the
  // stored credential. Only newly typed values (or cleared fields) update it.
  const update: {
    credit_monitoring_service: CreditMonitoringService | "none";
    credit_monitoring_api_key?: string | null;
    credit_monitoring_api_secret?: string | null;
    settings: AgencySettings;
  } = {
    credit_monitoring_service: input.service,
    settings: nextSettings,
  };
  if (!isMaskedSecret(input.apiKey)) {
    update.credit_monitoring_api_key = input.apiKey.trim() || null;
  }
  if (!isMaskedSecret(input.apiSecret)) {
    update.credit_monitoring_api_secret = input.apiSecret.trim() || null;
  }

  const { error } = await supabase
    .from("agencies")
    .update(update)
    .eq("id", session.agency.id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/settings/credit-monitoring");
  return { success: true };
}

/** Live credential check for the Credit Monitoring "Test Connection" button. */
export async function testCreditMonitoringConnection(input: {
  service: CreditMonitoringService | "none";
  apiKey: string;
  apiSecret: string;
}): Promise<{ ok: boolean; message: string }> {
  const session = await getSessionContext();
  if (!session) return { ok: false, message: "Not authenticated." };

  if (input.service === "none") {
    return { ok: false, message: "Select a provider first." };
  }

  // Masked placeholders mean "use the stored credential".
  const apiKey = isMaskedSecret(input.apiKey)
    ? session.agency.credit_monitoring_api_key ?? ""
    : input.apiKey;
  const apiSecret = isMaskedSecret(input.apiSecret)
    ? session.agency.credit_monitoring_api_secret ?? ""
    : input.apiSecret;

  return testConnection(input.service, apiKey, apiSecret);
}
