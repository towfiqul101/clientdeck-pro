"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { verifyGHLConnection } from "@/lib/ghl/api";
import type { AgencySettings } from "@/types";

export interface ActionResult {
  success: boolean;
  error?: string;
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
    return {
      ok: true,
      message: result.locationName
        ? `Connected to "${result.locationName}".`
        : "Connection successful.",
    };
  }
  return { ok: false, message: result.error };
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
