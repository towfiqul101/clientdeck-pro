"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { verifyGHLConnection, getGHLCustomFields } from "@/lib/ghl/api";
import { detectFieldKeys } from "@/lib/ghl/field-detect";
import { markOnboardingStep } from "@/lib/onboarding/mark";
import type { AgencySettings, GhlFieldKeys } from "@/types";

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

  const { error } = await supabase
    .from("agencies")
    .update({
      ghl_location_id: input.locationId.trim() || null,
      ghl_api_key: input.apiKey.trim() || null,
    })
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

  if (!input.locationId.trim() || !input.apiKey.trim()) {
    return { ok: false, message: "Enter both a Location ID and an API key." };
  }

  const result = await verifyGHLConnection({
    locationId: input.locationId.trim(),
    apiKey: input.apiKey.trim(),
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
